import { query, withTransaction } from '../db/query.js';
import { AppError } from '../utils/errors.js';
import { writeAuditLog } from '../services/auditService.js';

export const getBoxes = async (req, res, next) => {
  try {
    const { wash_type } = req.query;
    let result;

    if (wash_type) {
      result = await query('SELECT * FROM boxes WHERE wash_type = $1 ORDER BY id', [wash_type]);
    } else {
      result = await query('SELECT * FROM boxes ORDER BY id');
    }

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

export const createBox = async (req, res, next) => {
  try {
    const { box_number, is_active, wash_type } = req.body;

    const box = await withTransaction(async (client) => {
      const result = await client.query(
        `INSERT INTO boxes (box_number, is_active, wash_type)
         VALUES ($1, COALESCE($2, TRUE), COALESCE($3, 'manual'))
         RETURNING *`,
        [box_number, is_active, wash_type]
      );

      await writeAuditLog(client, {
        userId: req.user.id,
        actionType: 'create_box',
        target: `box:${result.rows[0].id}`,
        result: true
      });

      return result.rows[0];
    });

    res.status(201).json(box);
  } catch (error) {
    next(error);
  }
};

export const updateBox = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { box_number, is_active, wash_type } = req.body;

    const box = await withTransaction(async (client) => {
      const result = await client.query(
        `UPDATE boxes
         SET box_number = COALESCE($1, box_number),
             is_active = COALESCE($2, is_active),
             wash_type = COALESCE($3, wash_type)
         WHERE id = $4
         RETURNING *`,
        [box_number ?? null, is_active ?? null, wash_type ?? null, id]
      );

      if (!result.rowCount) throw new AppError(404, 'Box not found');

      await writeAuditLog(client, {
        userId: req.user.id,
        actionType: 'update_box',
        target: `box:${id}`,
        result: true
      });

      return result.rows[0];
    });

    res.json(box);
  } catch (error) {
    next(error);
  }
};

export const deleteBox = async (req, res, next) => {
  try {
    const { id } = req.params;
    const force = req.query.force === 'true';

    const response = await withTransaction(async (client) => {
      // Check if there are active bookings for this box
      const activeBookings = await client.query(
        `SELECT id FROM bookings
         WHERE box_id = $1 AND status NOT IN ('cancelled', 'cancelled_tech', 'completed')`,
        [id]
      );

      if (activeBookings.rowCount > 0 && !force) {
        return {
          status: 409,
          body: {
            message: 'Box has active bookings',
            bookings_count: activeBookings.rowCount,
          }
        };
      }

      if (force && activeBookings.rowCount > 0) {
        // Cancel all active bookings with technical reason status
        await client.query(
          `UPDATE bookings
           SET status = 'cancelled_tech'
           WHERE box_id = $1 AND status NOT IN ('cancelled', 'cancelled_tech', 'completed')`,
          [id]
        );
      }

      // Delete AI predictions for this box's schedule
      await client.query(`
        DELETE FROM ai_predictions 
        WHERE schedule_id IN (
          SELECT id FROM schedule WHERE box_id = $1
        )
      `, [id]);

      // Delete unused slots
      await client.query(`
        DELETE FROM schedule 
        WHERE box_id = $1 
          AND id NOT IN (SELECT schedule_id FROM bookings)
          AND id NOT IN (SELECT unnest(extra_schedule_ids) FROM bookings)
      `, [id]);

      // Unlink remaining slots and bookings from the box to preserve history
      await client.query('UPDATE bookings SET box_id = NULL WHERE box_id = $1', [id]);
      await client.query('UPDATE schedule SET box_id = NULL WHERE box_id = $1', [id]);

      const result = await client.query('DELETE FROM boxes WHERE id = $1 RETURNING *', [id]);

      if (!result.rowCount) throw new AppError(404, 'Box not found');

      await writeAuditLog(client, {
        userId: req.user.id,
        actionType: force ? 'force_delete_box' : 'delete_box',
        target: `box:${id}`,
        result: true
      });

      return { status: 200, body: { message: 'Box deleted successfully' } };
    });

    res.status(response.status).json(response.body);
  } catch (error) {
    next(error);
  }
};
