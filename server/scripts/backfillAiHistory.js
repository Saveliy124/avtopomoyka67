import { pool } from '../src/db/pool.js';

const DAYS_BACK = Number(process.argv[2] || 60);
const MIN_LOAD = 30;
const MAX_LOAD = 80;

const pad = (value) => String(value).padStart(2, '0');

const formatDate = (date) => {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  return `${year}-${month}-${day}`;
};

const seededRandom = (seed) => {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
};

const targetLoadForDay = (dayIndex, boxId) => {
  const weekendBoost = dayIndex % 7 === 5 || dayIndex % 7 === 6 ? 10 : 0;
  const randomLoad = MIN_LOAD + Math.round(seededRandom(dayIndex * 31 + boxId) * (MAX_LOAD - MIN_LOAD));
  return Math.max(MIN_LOAD, Math.min(MAX_LOAD, randomLoad + weekendBoost));
};

const buildSlotTimes = (dateStr, washType) => {
  const minutes = washType === 'robot' ? [0, 15, 30, 45] : [0, 30];
  const times = [];

  for (let hour = 9; hour <= 23; hour += 1) {
    minutes.forEach((minute) => {
      if (hour === 23 && minute > 30 && washType !== 'robot') return;
      times.push(`${dateStr} ${pad(hour)}:${pad(minute)}:00`);
    });
  }

  return times;
};

const ensurePastSlots = async (client, box) => {
  const interval = box.wash_type === 'robot' ? '15 minutes' : '30 minutes';
  const slots = buildSlotTimes(box.dateStr, box.wash_type);

  for (const appointmentTime of slots) {
    await client.query(
      `INSERT INTO schedule (appointment_time, is_available, is_maintenance, box_id)
       SELECT $1::timestamp, FALSE, FALSE, $2
       WHERE NOT EXISTS (
         SELECT 1 FROM schedule
         WHERE appointment_time = $1::timestamp
           AND box_id = $2
       )`,
      [appointmentTime, box.id]
    );
  }

  return interval;
};

const main = async () => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const userResult = await client.query(
      `SELECT id FROM users ORDER BY id LIMIT 1`
    );
    if (!userResult.rowCount) {
      throw new Error('No users found. Run npm run db:seed first.');
    }
    const userId = userResult.rows[0].id;

    const boxesResult = await client.query(
      `SELECT id, wash_type FROM boxes WHERE is_active = TRUE ORDER BY id`
    );
    if (!boxesResult.rowCount) {
      throw new Error('No active boxes found.');
    }

    const servicesResult = await client.query(
      `SELECT id, wash_type FROM services ORDER BY id`
    );
    const servicesByType = new Map();
    servicesResult.rows.forEach((service) => {
      if (!servicesByType.has(service.wash_type)) servicesByType.set(service.wash_type, []);
      servicesByType.get(service.wash_type).push(service.id);
    });

    let createdBookings = 0;
    let touchedDays = 0;

    for (let offset = DAYS_BACK; offset >= 1; offset -= 1) {
      const date = new Date();
      date.setDate(date.getDate() - offset);
      const dateStr = formatDate(date);
      touchedDays += 1;

      for (const box of boxesResult.rows) {
        const washType = box.wash_type || 'manual';
        const serviceIds = servicesByType.get(washType) || servicesByType.get('manual') || [];
        if (!serviceIds.length) continue;

        await ensurePastSlots(client, { ...box, wash_type: washType, dateStr });

        const slotsResult = await client.query(
          `SELECT s.id
           FROM schedule s
           WHERE s.box_id = $1
             AND DATE(s.appointment_time AT TIME ZONE 'Europe/Moscow') = $2
             AND s.is_maintenance = FALSE
             AND NOT EXISTS (
               SELECT 1 FROM bookings b
               WHERE b.schedule_id = s.id
                 AND b.status IN ('confirmed', 'in_progress', 'completed')
             )
           ORDER BY s.appointment_time`,
          [box.id, dateStr]
        );

        const load = targetLoadForDay(offset, box.id);
        const needed = Math.round(slotsResult.rows.length * (load / 100));
        const selectedSlots = slotsResult.rows
          .map((slot, index) => ({ slot, score: seededRandom(offset * 1000 + box.id * 100 + index) }))
          .sort((a, b) => a.score - b.score)
          .slice(0, needed)
          .map((item) => item.slot);

        for (const slot of selectedSlots) {
          const serviceId = serviceIds[Math.floor(seededRandom(slot.id) * serviceIds.length)];
          await client.query(
            `INSERT INTO bookings (user_id, service_id, schedule_id, box_id, car_info, status, is_paid, created_at)
             VALUES ($1, $2, $3, $4, $5, 'completed', TRUE, NOW() - INTERVAL '1 day')
             ON CONFLICT (schedule_id, box_id) DO NOTHING`,
            [userId, serviceId, slot.id, box.id, `AIHIST${slot.id}`]
          );
          await client.query(
            `UPDATE schedule SET is_available = FALSE WHERE id = $1`,
            [slot.id]
          );
          createdBookings += 1;
        }
      }
    }

    await client.query('COMMIT');
    console.log(`AI history backfilled: ${createdBookings} bookings across ${touchedDays} days.`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Failed to backfill AI history:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
};

main();
