import { query } from '../db/query.js';

export const getDashboardStats = async (_req, res, next) => {
  try {
    const [total, confirmed, completed, cancelled, revenue, today, totalSlots] = await Promise.all([
      query(`SELECT COUNT(*)::int AS total FROM bookings`),
      query(`SELECT COUNT(*)::int AS total FROM bookings WHERE status = 'confirmed'`),
      query(`SELECT COUNT(*)::int AS total FROM bookings WHERE status = 'completed'`),
      query(`SELECT COUNT(*)::int AS total FROM bookings WHERE status = 'cancelled'`),
      query(`SELECT COALESCE(SUM(sv.price), 0)::numeric AS total
             FROM bookings b
             JOIN services sv ON sv.id = b.service_id
             WHERE b.status = 'completed'`),
      query(`SELECT COUNT(*)::int AS total FROM bookings
             WHERE DATE(created_at) = CURRENT_DATE`),
      query(`SELECT COUNT(*)::int AS total FROM schedule WHERE DATE(appointment_time) = CURRENT_DATE`)
    ]);

    const confirmedCount = confirmed.rows[0].total;
    const completedCount = completed.rows[0].total;
    const totalSlotsCount = totalSlots.rows[0].total || 1; // avoid div by zero
    const occupancyRate = Math.round(((confirmedCount + completedCount) / totalSlotsCount) * 100);

    res.json({
      total_bookings: total.rows[0].total,
      confirmed_bookings: confirmedCount,
      completed_bookings: completedCount,
      cancelled_bookings: cancelled.rows[0].total,
      total_revenue: Number(revenue.rows[0].total),
      today_bookings: today.rows[0].total,
      occupancy_rate: occupancyRate
    });
  } catch (error) {
    next(error);
  }
};

export const getPredictions = async (_req, res, next) => {
  try {
    const result = await query(
      `SELECT ap.*, s.appointment_time, s.box_id, b.box_number
       FROM ai_predictions ap
       JOIN schedule s ON s.id = ap.schedule_id
       LEFT JOIN boxes b ON b.id = s.box_id
       ORDER BY ap.prediction_date DESC, ap.id DESC`
    );

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};
