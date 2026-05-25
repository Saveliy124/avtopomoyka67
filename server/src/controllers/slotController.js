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
             ($2::text || ' ' || LPAD($3::text, 2, '0') || ':00:00')::timestamp AT TIME ZONE 'Europe/Moscow',
             ($2::text || ' ' || LPAD($4::text, 2, '0') || ':00:00')::timestamp AT TIME ZONE 'Europe/Moscow' - make_interval(mins => $5::int),
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
 * Convert a date string + hour (in Moscow time, UTC+3) to a UTC ISO timestamp.
 * Moscow never observes DST, so offset is always +03:00.
 * hour=24 means next day 00:00 MSK.
 */
function mskToUtc(dateStr, hour) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const overflowDays = Math.floor(hour / 24);
  const localHour = hour % 24;

  // Date.UTC interprets args as UTC; MSK = UTC+3, so UTC = MSK - 3h
  const utcMs = Date.UTC(y, m - 1, d + overflowDays, localHour, 0, 0, 0) - 3 * 3600 * 1000;
  return new Date(utcMs).toISOString();
}

/**
 * Generate (or regenerate) the day schedule for ALL active boxes.
 *
 * Algorithm per box:
 *  1. Delete all UNBOOKED slots for this box on this date.
 *  2. Mark all BOOKED slots outside [startHour, endHour) as maintenance.
 *  3. Insert new slots at the box-specific interval.
 *  4. Lock any newly-created past slots.
 */
export const generateDaySlots = async (req, res, next) => {
  try {
    const {
      date,
      startHour = 9,
      endHour = 24,
      intervalMinutes: clientIntervalManual,
      intervalMinutesRobot: clientIntervalRobot,
    } = req.body;

    if (!date) {
      return res.status(400).json({ message: 'date is required' });
    }

    // Build UTC boundary timestamps
    const startUtc = mskToUtc(date, Number(startHour));        // e.g. 09:00 MSK → UTC
    const endUtc   = mskToUtc(date, Number(endHour));          // e.g. 24:00 MSK = next day 00:00 MSK → UTC

    const result = await withTransaction(async (client) => {
      const boxesResult = await client.query(
        'SELECT * FROM boxes WHERE is_active = TRUE ORDER BY box_number'
      );
      const boxes = boxesResult.rows;

      let totalCreated = 0;

      for (const box of boxes) {
        const interval = box.wash_type === 'robot'
          ? (Number(clientIntervalRobot) || 15)
          : (Number(clientIntervalManual) || 30);

        // ── Step 1: Delete unbooked slots for this box on this date ──────────
        // IMPORTANT: check ANY booking reference (including cancelled) to avoid
        // FK constraint violations. Slots with any booking are kept.
        await client.query(`
          DELETE FROM schedule
          WHERE box_id = $1
            AND DATE(appointment_time AT TIME ZONE 'Europe/Moscow') = $2
            AND NOT EXISTS (
              SELECT 1 FROM bookings
              WHERE schedule_id = schedule.id
            )
            AND NOT EXISTS (
              SELECT 1 FROM bookings
              WHERE schedule.id = ANY(extra_schedule_ids)
            )
        `, [box.id, date]);

        // ── Step 2: Mark booked out-of-range slots as maintenance ─────────────
        // Only affects THIS date's slots (bounded by startUtc/endUtc day boundaries).
        // Day start in UTC for date = mskToUtc(date, 0), day end = mskToUtc(date, 24)
        const dayStartUtc = mskToUtc(date, 0);
        const dayEndUtc   = mskToUtc(date, 24);
        await client.query(`
          UPDATE schedule
          SET is_available = FALSE, is_maintenance = TRUE
          WHERE box_id = $1
            AND appointment_time >= $2::timestamptz
            AND appointment_time <  $3::timestamptz
            AND (
              appointment_time < $4::timestamptz
              OR appointment_time >= $5::timestamptz
            )
            AND EXISTS (
              SELECT 1 FROM bookings
              WHERE schedule_id = schedule.id
                AND status NOT IN ('cancelled', 'cancelled_tech')
            )
        `, [box.id, dayStartUtc, dayEndUtc, startUtc, endUtc]);

        // ── Step 3: Insert new slots at the correct interval ──────────────────
        const genResult = await client.query(`
          WITH generated AS (
            SELECT generate_series(
              $2::timestamptz,
              $3::timestamptz - make_interval(mins => $4::int),
              make_interval(mins => $4::int)
            ) AS appointment_time
          )
          INSERT INTO schedule (appointment_time, box_id, is_available)
          SELECT g.appointment_time, $1, TRUE
          FROM generated g
          WHERE NOT EXISTS (
            SELECT 1 FROM schedule s
            WHERE s.box_id = $1 AND s.appointment_time = g.appointment_time
          )
          RETURNING *
        `, [box.id, startUtc, endUtc, interval]);

        totalCreated += genResult.rowCount;
      }

      // ── Step 4: Lock past unbooked slots for the date ─────────────────────
      await client.query(`
        UPDATE schedule
        SET is_available = FALSE
        WHERE DATE(appointment_time AT TIME ZONE 'Europe/Moscow') = $1
          AND appointment_time < NOW()
          AND is_available = TRUE
          AND is_maintenance = FALSE
          AND NOT EXISTS (
            SELECT 1 FROM bookings
            WHERE schedule_id = schedule.id
              AND status NOT IN ('cancelled', 'cancelled_tech')
          )
      `, [date]);

      return { boxes_count: boxes.length, slots_created: totalCreated };
    });

    await query(
      `INSERT INTO audit_log (user_id, action_type, target, result)
       VALUES ($1, $2, $3, TRUE)`,
      [req.user.id, 'generate_day_slots', `date:${date}:created:${result.slots_created}`]
    );

    res.status(201).json({ message: 'OK', ...result });
  } catch (error) {
    next(error);
  }
};
