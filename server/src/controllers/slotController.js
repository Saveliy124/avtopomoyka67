import { query, withTransaction } from '../db/query.js';
import { writeAuditLog } from '../services/auditService.js';

export const getSlots = async (req, res, next) => {
  try {
    const { date, boxId, washType, onlyFree } = req.query;
    const params = [];
    let where = 'WHERE 1 = 1';

    if (date) {
      params.push(date);
      where += ` AND DATE(s.appointment_time AT TIME ZONE 'Europe/Moscow') = $${params.length}`;
    }

    if (boxId) {
      params.push(boxId);
      where += ` AND s.box_id = $${params.length}`;
    }

    if (washType) {
      params.push(washType);
      where += ` AND b.wash_type = $${params.length}`;
    }

    if (onlyFree === 'true') {
      where += ' AND s.is_available = TRUE';
    }

    // Always exclude slots of inactive boxes
    where += ' AND b.is_active = TRUE';

    const result = await query(
      `SELECT s.*, b.box_number, b.wash_type,
              EXISTS (
                SELECT 1
                FROM bookings bk
                WHERE bk.schedule_id = s.id
                  AND bk.status <> 'cancelled'
              ) AS has_booking
       FROM schedule s
       LEFT JOIN boxes b ON b.id = s.box_id
       ${where}
       ORDER BY s.appointment_time`,
      params
    );

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

export const bulkUpdateSlotsStatus = async (req, res, next) => {
  try {
    const { ids, is_maintenance } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'IDs array is required' });
    }

    const result = await withTransaction(async (client) => {
      const updateResult = await client.query(
        `UPDATE schedule
         SET is_maintenance = $1,
             is_available = $2
         WHERE id = ANY($3::int[])
         RETURNING *`,
        [is_maintenance, !is_maintenance, ids]
      );

      // If setting maintenance, cancel active bookings for these slots
      if (is_maintenance) {
        await client.query(
          `UPDATE bookings
           SET status = 'cancelled_tech'
           WHERE schedule_id = ANY($1::int[])
             AND status NOT IN ('completed', 'cancelled')`,
          [ids]
        );
      }

      await writeAuditLog(client, {
        userId: req.user.id,
        actionType: is_maintenance ? 'enable_slot_maintenance' : 'disable_slot_maintenance',
        target: `slots:${ids.join(',')}`,
        result: true
      });

      return updateResult;
    });

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

export const createSlot = async (req, res, next) => {
  try {
    const { appointment_time, box_id, is_available } = req.body;

    const result = await withTransaction(async (client) => {
      const insertResult = await client.query(
        `INSERT INTO schedule (appointment_time, box_id, is_available)
         VALUES ($1, $2, COALESCE($3, TRUE))
         RETURNING *`,
        [appointment_time, box_id, is_available]
      );

      await writeAuditLog(client, {
        userId: req.user.id,
        actionType: 'create_slot',
        target: `slot:${insertResult.rows[0].id}`,
        result: true
      });

      return insertResult;
    });

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

export const generateSlots = async (req, res, next) => {
  try {
    const { box_id, date, startHour = 9, endHour = 23, intervalMinutes = 30 } = req.body;

    const boxResult = await query('SELECT * FROM boxes WHERE id = $1', [box_id]);
    const box = boxResult.rows[0];
    const interval = box?.wash_type === 'robot' ? 15 : (intervalMinutes || 30);

    const result = await withTransaction(async (client) => {
      const insertResult = await client.query(
        `WITH generated AS (
           SELECT generate_series(
             ($2::date + make_interval(hours => $3::int))::timestamp AT TIME ZONE 'Europe/Moscow',
             ($2::date + make_interval(hours => $4::int) - make_interval(mins => $5::int))::timestamp AT TIME ZONE 'Europe/Moscow',
             make_interval(mins => $5::int)
           ) AS appointment_time
         )
         INSERT INTO schedule (appointment_time, box_id, is_available)
         SELECT g.appointment_time, $1, TRUE
         FROM generated g
         WHERE NOT EXISTS (
           SELECT 1 FROM schedule s
           WHERE s.box_id = $1 AND s.appointment_time = g.appointment_time
         )
         RETURNING *`,
        [box_id, date, startHour, endHour, interval]
      );

      await writeAuditLog(client, {
        userId: req.user.id,
        actionType: 'generate_slots',
        target: `box:${box_id}:date:${date}:created:${insertResult.rowCount}`,
        result: true
      });

      return insertResult;
    });

    res.status(201).json(result.rows);
  } catch (error) {
    next(error);
  }
};

/**
 * Generate day schedule for ALL active boxes.
 * Creates slots only where they don't already exist.
 */
export const generateDaySlots = async (req, res, next) => {
  try {
    const { date, startHour = 9, endHour = 24 } = req.body;

    if (!date) {
      return res.status(400).json({ message: 'date is required' });
    }

    const result = await withTransaction(async (client) => {
      // 1. Get active boxes
      const boxesResult = await client.query('SELECT * FROM boxes WHERE is_active = TRUE ORDER BY box_number');
      const boxes = boxesResult.rows;

      // 2. Find existing slots outside the new shift bounds
      // If endHour is 24, it means up to 23:59.
      const parsedEndHour = endHour === 24 ? 24 : endHour;
      
      const outOfBoundsResult = await client.query(`
        SELECT id FROM schedule 
        WHERE DATE(appointment_time AT TIME ZONE 'Europe/Moscow') = $1
        AND (
          EXTRACT(HOUR FROM appointment_time AT TIME ZONE 'Europe/Moscow') < $2 
          OR 
          EXTRACT(HOUR FROM appointment_time AT TIME ZONE 'Europe/Moscow') >= $3
        )
      `, [date, startHour, parsedEndHour]);
      
      const invalidSlotIds = outOfBoundsResult.rows.map(r => r.id);
      
      if (invalidSlotIds.length > 0) {
        // Cancel active bookings for these invalid slots
        await client.query(`
          UPDATE bookings 
          SET status = 'cancelled_tech' 
          WHERE schedule_id = ANY($1::int[]) 
          AND status NOT IN ('completed', 'cancelled', 'cancelled_tech')
        `, [invalidSlotIds]);
        
        // Delete the invalid slots ONLY if they are not referenced by any bookings (primary or extra)
        await client.query(`
          DELETE FROM schedule 
          WHERE id = ANY($1::int[])
          AND NOT EXISTS (
            SELECT 1 FROM bookings 
            WHERE schedule_id = schedule.id 
            OR schedule.id = ANY(extra_schedule_ids)
          )
        `, [invalidSlotIds]);

        // For slots that couldn't be deleted (because they have bookings), 
        // make them unavailable and in maintenance mode
        await client.query(`
          UPDATE schedule
          SET is_available = FALSE, is_maintenance = TRUE
          WHERE id = ANY($1::int[])
          AND EXISTS (
            SELECT 1 FROM bookings 
            WHERE schedule_id = schedule.id 
            OR schedule.id = ANY(extra_schedule_ids)
          )
        `, [invalidSlotIds]);
      }

      // 3. Generate missing valid slots
      let totalCreated = 0;

      for (const box of boxes) {
        const interval = box.wash_type === 'robot' ? 15 : 30;

        const genResult = await client.query(
          `WITH generated AS (
             SELECT generate_series(
               ($2::date + make_interval(hours => $3::int))::timestamp AT TIME ZONE 'Europe/Moscow',
               ($2::date + make_interval(hours => $4::int) - make_interval(mins => $5::int))::timestamp AT TIME ZONE 'Europe/Moscow',
               make_interval(mins => $5::int)
             ) AS appointment_time
           )
           INSERT INTO schedule (appointment_time, box_id, is_available)
           SELECT g.appointment_time, $1, TRUE
           FROM generated g
           WHERE NOT EXISTS (
             SELECT 1 FROM schedule s
             WHERE s.box_id = $1 AND s.appointment_time = g.appointment_time
           )
           RETURNING *`,
          [box.id, date, startHour, endHour, interval]
        );

        totalCreated += genResult.rowCount;
      }

      // 4. Immediately lock past slots (appointment_time < NOW()) that were just created
      //    or already existed but are still marked as available and have no booking
      await client.query(
        `UPDATE schedule
         SET is_available = FALSE
         WHERE DATE(appointment_time AT TIME ZONE 'Europe/Moscow') = $1
           AND appointment_time < NOW()
           AND is_available = TRUE
           AND is_maintenance = FALSE
           AND NOT EXISTS (
             SELECT 1 FROM bookings
             WHERE schedule_id = schedule.id
               AND status NOT IN ('cancelled', 'cancelled_tech')
           )`,
        [date]
      );

      return {
        boxes_count: boxes.length,
        slots_created: totalCreated,
      };
    });

    await query(
      `INSERT INTO audit_log (user_id, action_type, target, result)
       VALUES ($1, $2, $3, TRUE)`,
      [req.user.id, 'generate_day_slots', `date:${date}:created:${result.slots_created}`]
    );

    res.status(201).json({
      message: 'OK',
      ...result
    });
  } catch (error) {
    next(error);
  }
};
