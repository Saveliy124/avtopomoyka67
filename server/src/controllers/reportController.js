import { query } from '../db/query.js';
import { buildLstmLoadForecast } from '../services/lstmLoadForecaster.js';

export const getDashboardStats = async (_req, res, next) => {
  try {
    const [total, confirmed, completed, revenue, today, todayOccupied, todaySlots] = await Promise.all([
      query(`SELECT COUNT(*)::int AS total FROM bookings`),
      query(`SELECT COUNT(*)::int AS total FROM bookings WHERE status = 'confirmed'`),
      query(`SELECT COUNT(*)::int AS total FROM bookings WHERE status = 'completed'`),
      query(`SELECT COALESCE(SUM(sv.price), 0)::numeric AS total
             FROM bookings b
             JOIN services sv ON sv.id = b.service_id
             WHERE b.status = 'completed'`),
      query(`SELECT COUNT(*)::int AS total FROM bookings
             WHERE DATE(created_at AT TIME ZONE 'Europe/Moscow') = CURRENT_DATE AT TIME ZONE 'Europe/Moscow'`),
      query(`SELECT COUNT(*)::int AS total FROM bookings b
             JOIN schedule s ON s.id = b.schedule_id
             WHERE b.status IN ('confirmed', 'in_progress', 'completed')
             AND b.status <> 'cancelled_tech'
             AND DATE(s.appointment_time AT TIME ZONE 'Europe/Moscow') = CURRENT_DATE AT TIME ZONE 'Europe/Moscow'`),
      query(`SELECT COUNT(*)::int AS total FROM schedule WHERE DATE(appointment_time AT TIME ZONE 'Europe/Moscow') = CURRENT_DATE AT TIME ZONE 'Europe/Moscow'`)
    ]);

    const confirmedCount = confirmed.rows[0].total;
    const completedCount = completed.rows[0].total;
    const occupiedCount = todayOccupied.rows[0].total;
    const totalSlotsCount = todaySlots.rows[0].total || 1;
    const occupancyRate = Math.round((occupiedCount / totalSlotsCount) * 100);

    res.json({
      total_bookings: total.rows[0].total,
      confirmed_bookings: confirmedCount,
      completed_bookings: completedCount,
      total_revenue: Number(revenue.rows[0].total),
      today_bookings: today.rows[0].total,
      occupancy_rate: occupancyRate
    });
  } catch (error) {
    next(error);
  }
};

export const getMyStats = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [actions, completed, started, todayActions, latest] = await Promise.all([
      query(
        `SELECT COUNT(*)::int AS total
         FROM audit_log
         WHERE user_id = $1`,
        [userId]
      ),
      query(
        `SELECT COUNT(*)::int AS total
         FROM audit_log
         WHERE user_id = $1
           AND action_type = 'update_booking_status'
           AND target LIKE '%:completed'`,
        [userId]
      ),
      query(
        `SELECT COUNT(*)::int AS total
         FROM audit_log
         WHERE user_id = $1
           AND action_type = 'update_booking_status'
           AND target LIKE '%:in_progress'`,
        [userId]
      ),
      query(
        `SELECT COUNT(*)::int AS total
         FROM audit_log
         WHERE user_id = $1
           AND DATE(action_time AT TIME ZONE 'Europe/Moscow') = CURRENT_DATE AT TIME ZONE 'Europe/Moscow'`,
        [userId]
      ),
      query(
        `SELECT id, action_time, action_type, target, result
         FROM audit_log
         WHERE user_id = $1
         ORDER BY action_time DESC
         LIMIT 10`,
        [userId]
      )
    ]);

    res.json({
      total_actions: actions.rows[0].total,
      completed_washes: completed.rows[0].total,
      started_washes: started.rows[0].total,
      today_actions: todayActions.rows[0].total,
      latest_actions: latest.rows
    });
  } catch (error) {
    next(error);
  }
};

export const getPredictions = async (req, res, next) => {
  try {
    const source = await query(
      `WITH slot_load AS (
         SELECT
           s.id,
         bx.wash_type,
         DATE(s.appointment_time AT TIME ZONE 'Europe/Moscow') AS appointment_date,
         EXTRACT(HOUR FROM s.appointment_time)::int AS hour,
         EXTRACT(DOW FROM s.appointment_time)::int AS day_of_week,
         s.appointment_time >= NOW() AS is_future,
         EXISTS (
             SELECT 1
             FROM bookings bk
             WHERE bk.schedule_id = s.id
               AND bk.status IN ('confirmed', 'in_progress', 'completed')
           ) AS is_occupied
         FROM schedule s
         JOIN boxes bx ON bx.id = s.box_id
         WHERE s.appointment_time >= NOW() - INTERVAL '180 days'
           AND s.appointment_time < NOW() + INTERVAL '21 days'
           AND bx.is_active = TRUE
           AND s.is_maintenance = FALSE
       )
       SELECT
         wash_type,
         appointment_date,
         hour,
         day_of_week,
         is_future,
         COUNT(*)::int AS total_slots,
         COUNT(*) FILTER (WHERE is_occupied)::int AS occupied_slots
       FROM slot_load
       GROUP BY appointment_date, hour, day_of_week, is_future, wash_type
       ORDER BY appointment_date, hour, wash_type`
    );

    res.json(buildLstmLoadForecast(source.rows, { forceRefresh: req.query.refresh === 'true' }));
  } catch (error) {
    next(error);
  }
};
