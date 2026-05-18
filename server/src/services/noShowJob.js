import { query } from '../db/query.js';

/**
 * Marks as 'no_show' all bookings that:
 *  - have status 'confirmed' or 'in_progress'
 *  - are scheduled for a date strictly before today (yesterday or earlier)
 *
 * Runs once at server startup and then every 60 minutes.
 */
const markNoShows = async () => {
  try {
    const result = await query(
      `UPDATE bookings b
       SET status = 'no_show'
       FROM schedule s
       WHERE b.schedule_id = s.id
         AND b.status IN ('confirmed', 'in_progress')
         AND DATE(s.appointment_time AT TIME ZONE 'Europe/Moscow') < CURRENT_DATE
       RETURNING b.id`,
      []
    );

    if (result.rowCount > 0) {
      console.log(`[noShowJob] Marked ${result.rowCount} booking(s) as no_show.`);
    }
  } catch (err) {
    console.error('[noShowJob] Error marking no_show bookings:', err.message);
  }
};

const INTERVAL_MS = 60 * 60 * 1000; // 60 minutes

export const startNoShowJob = () => {
  // Run immediately on server start to handle any backlog
  markNoShows();

  // Then repeat every hour
  setInterval(markNoShows, INTERVAL_MS);

  console.log('[noShowJob] Started — runs every 60 minutes.');
};
