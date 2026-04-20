import { query } from '../db/query.js';

export const getSlots = async (req, res, next) => {
  try {
    const { date, boxId, onlyFree } = req.query;
    const params = [];
    let where = 'WHERE 1 = 1';

    if (date) {
      params.push(date);
      where += ` AND DATE(s.appointment_time) = $${params.length}`;
    }

    if (boxId) {
      params.push(boxId);
      where += ` AND s.box_id = $${params.length}`;
    }

    if (onlyFree === 'true') {
      where += ' AND s.is_available = TRUE';
    }

    const result = await query(
      `SELECT s.*, b.box_number,
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

export const createSlot = async (req, res, next) => {
  try {
    const { appointment_time, box_id, is_available } = req.body;

    const result = await query(
      `INSERT INTO schedule (appointment_time, box_id, is_available)
       VALUES ($1, $2, COALESCE($3, TRUE))
       RETURNING *`,
      [appointment_time, box_id, is_available]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

export const generateSlots = async (req, res, next) => {
  try {
    const { box_id, date, startHour = 9, endHour = 21, intervalMinutes = 30 } = req.body;

    const boxResult = await query('SELECT * FROM boxes WHERE id = $1', [box_id]);
    const box = boxResult.rows[0];
    const interval = box?.wash_type === 'robot' ? 15 : (intervalMinutes || 30);

    const result = await query(
      `WITH generated AS (
         SELECT generate_series(
           ($2::date + make_interval(hours => $3::int)),
           ($2::date + make_interval(hours => $4::int) - make_interval(mins => $5::int)),
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

    res.status(201).json(result.rows);
  } catch (error) {
    next(error);
  }
};
