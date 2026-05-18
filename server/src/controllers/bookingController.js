import { query, withTransaction } from '../db/query.js';
import { AppError } from '../utils/errors.js';
import { hasPermission, hasRole, PERMISSIONS } from '../utils/permissions.js';
import { writeAuditLog } from '../services/auditService.js';
import { clearLstmForecastCache } from '../services/lstmLoadForecaster.js';

const ACTIVE_STATUSES = ['confirmed', 'in_progress'];

export const getMyBookings = async (req, res, next) => {
  try {
    const canSeeAll =
      hasRole(req.user, 'admin') ||
      hasPermission(req.user, PERMISSIONS.MANAGE_BOOKINGS) ||
      hasPermission(req.user, PERMISSIONS.DO_WASHING);

    const result = await query(
      `SELECT bk.id,
              bk.user_id,
              bk.service_id,
              bk.schedule_id,
              bk.box_id,
              bk.car_info,
              bk.status,
              bk.is_paid,
              bk.created_at,
              bk.actual_arrival,
              s.appointment_time,
              bx.box_number,
              sv.service_name,
              (
                sv.price + COALESCE((
                  SELECT SUM(es.price)
                  FROM booking_extra_services bes
                  JOIN extra_services es ON es.id = bes.extra_service_id
                  WHERE bes.booking_id = bk.id
                ), 0)
              ) AS price,
              sv.duration_minutes,
              bk.extra_schedule_ids,
              CONCAT_WS(' ', u.last_name, u.first_name, u.patronymic) AS client_name,
              COALESCE((
                SELECT json_agg(
                  json_build_object(
                    'id', es.id,
                    'service_name', es.service_name,
                    'price', es.price,
                    'duration_minutes', es.duration_minutes
                  )
                  ORDER BY es.id
                )
                FROM booking_extra_services bes
                JOIN extra_services es ON es.id = bes.extra_service_id
                WHERE bes.booking_id = bk.id
              ), '[]'::json) AS extra_services
       FROM bookings bk
       JOIN schedule s ON s.id = bk.schedule_id
       LEFT JOIN boxes bx ON bx.id = bk.box_id
       JOIN services sv ON sv.id = bk.service_id
       JOIN users u ON u.id = bk.user_id
       ${canSeeAll ? '' : 'WHERE bk.user_id = $1'}
       ORDER BY s.appointment_time DESC`,
      canSeeAll ? [] : [req.user.id]
    );

    const bookings = result.rows.map((booking) => ({
      ...booking,
      price: Number(booking.price),
      extra_services: (booking.extra_services || []).map((extra) => ({
        ...extra,
        price: Number(extra.price),
      })),
    }));

    res.json(bookings);
  } catch (error) {
    next(error);
  }
};

export const createBooking = async (req, res, next) => {
  try {
    const { schedule_id, service_id, client_id, car_info, extra_services, appointment_time, box_id, client_name } = req.body;

    const canCreateForOthers = hasRole(req.user, 'admin') || hasPermission(req.user, PERMISSIONS.MANAGE_BOOKINGS);
    const effectiveUserId = hasRole(req.user, 'client') || !client_id ? req.user.id : client_id;

    if (client_id && !canCreateForOthers && client_id !== req.user.id) {
      throw new AppError(403, 'You cannot create bookings for other users');
    }

    const booking = await withTransaction(async (client) => {
      // Get service info to know duration
      const svcResult = await client.query('SELECT * FROM services WHERE id = $1', [service_id]);
      const svc = svcResult.rows[0];
      if (!svc) throw new AppError(404, 'Service not found');

      const durationMinutes = svc.duration_minutes || 30;

      // Add extra services duration (fetched from DB — do not trust client values)
      const extraServicesData = extra_services || [];
      let extrasDurationMinutes = 0;
      if (extraServicesData.length > 0) {
        const extraIds = extraServicesData
          .map(e => e.id || e.extra_service_id)
          .filter(Boolean);
        if (extraIds.length > 0) {
          const extDurResult = await client.query(
            `SELECT COALESCE(SUM(duration_minutes), 0) AS total FROM extra_services WHERE id = ANY($1::int[])`,
            [extraIds]
          );
          extrasDurationMinutes = Number(extDurResult.rows[0].total);
        }
      }
      const totalDurationMinutes = durationMinutes + extrasDurationMinutes;

      // Get the selected slot
      const scheduleResult = await client.query(
        `SELECT s.id, s.appointment_time, s.is_available, s.box_id, b.box_number, b.wash_type
         FROM schedule s
         LEFT JOIN boxes b ON b.id = s.box_id
         WHERE s.id = $1
         FOR UPDATE OF s`,
        [schedule_id]
      );

      let slot = scheduleResult.rows[0];
      if (!slot) throw new AppError(404, 'Schedule slot not found');

      let effectiveBoxId = box_id || null;

      // Auto-assign box: find a box of the right wash_type that has this slot available
      if (!effectiveBoxId) {
        // Find all active boxes of this wash_type
        const boxesResult = await client.query(
          `SELECT id, wash_type FROM boxes WHERE wash_type = $1 AND is_active = TRUE ORDER BY id`,
          [svc.wash_type]
        );

        // Determine slot interval for this wash_type
        const slotIntervalMinutes = svc.wash_type === 'robot' ? 15 : 30;
        const slotsNeeded = Math.ceil(totalDurationMinutes / slotIntervalMinutes);

        let chosenBoxId = null;
        let extraSlotIds = [];

        for (const box of boxesResult.rows) {
          // Find available slots for this box at the given appointment_time
          const boxSlotsResult = await client.query(
            `SELECT s.id, s.appointment_time, s.is_available, s.is_maintenance
             FROM schedule s
             WHERE s.box_id = $1
               AND s.appointment_time >= $2
               AND s.is_available = TRUE
               AND s.is_maintenance = FALSE
             ORDER BY s.appointment_time
             LIMIT $3`,
            [box.id, slot.appointment_time, slotsNeeded]
          );

          const boxSlots = boxSlotsResult.rows;

          // Check that the first slot matches our appointment_time exactly
          if (boxSlots.length === 0 || boxSlots[0].appointment_time.getTime() !== new Date(slot.appointment_time).getTime()) {
            continue;
          }

          // Check that we have enough consecutive slots
          if (boxSlots.length < slotsNeeded) continue;

          // Verify they are truly consecutive (no gaps)
          let consecutive = true;
          for (let i = 1; i < slotsNeeded; i++) {
            const prev = new Date(boxSlots[i - 1].appointment_time).getTime();
            const curr = new Date(boxSlots[i].appointment_time).getTime();
            if (curr - prev !== slotIntervalMinutes * 60 * 1000) {
              consecutive = false;
              break;
            }
          }
          if (!consecutive) continue;

          // This box works — lock additional slots
          chosenBoxId = box.id;
          extraSlotIds = boxSlots.slice(1).map(s => s.id);

          // Re-fetch the primary slot for this box with FOR UPDATE
          const primarySlotResult = await client.query(
            `SELECT s.id, s.appointment_time, s.is_available, s.box_id, b.box_number, b.wash_type
             FROM schedule s
             LEFT JOIN boxes b ON b.id = s.box_id
             WHERE s.box_id = $1 AND s.appointment_time = $2
             FOR UPDATE OF s`,
            [box.id, slot.appointment_time]
          );
          slot = primarySlotResult.rows[0];
          if (!slot || !slot.is_available) continue; // race condition — try next box

          break;
        }

        if (!chosenBoxId) {
          throw new AppError(409, 'No available box found for this time slot and service duration');
        }

        effectiveBoxId = chosenBoxId;

        // Lock extra slots
        if (extraSlotIds.length > 0) {
          await client.query(
            `UPDATE schedule SET is_available = FALSE WHERE id = ANY($1::int[])`,
            [extraSlotIds]
          );
        }
      } else {
        // box_id explicitly provided (admin flow) — check the primary slot
        if (!slot.is_available) throw new AppError(409, 'Selected slot is not available');

        const existingBooking = await client.query(
          `SELECT id FROM bookings WHERE schedule_id = $1 AND status = ANY($2::text[]) LIMIT 1`,
          [schedule_id, ACTIVE_STATUSES]
        );
        if (existingBooking.rowCount > 0) throw new AppError(409, 'This slot is already booked');

        // Lock extra slots for multi-slot services (admin flow)
        const slotIntervalMinutesAdmin = svc.wash_type === 'robot' ? 15 : 30;
        const slotsNeededAdmin = Math.ceil(totalDurationMinutes / slotIntervalMinutesAdmin);

        if (slotsNeededAdmin > 1) {
          const extraAdminResult = await client.query(
            `SELECT id FROM schedule
             WHERE box_id = $1 AND appointment_time > $2
               AND is_available = TRUE AND is_maintenance = FALSE
             ORDER BY appointment_time
             LIMIT $3`,
            [effectiveBoxId, slot.appointment_time, slotsNeededAdmin - 1]
          );
          const extraAdminIds = extraAdminResult.rows.map(r => r.id);
          if (extraAdminIds.length > 0) {
            await client.query(
              `UPDATE schedule SET is_available = FALSE WHERE id = ANY($1::int[])`,
              [extraAdminIds]
            );
          }
        }
      }


      // Double-check primary slot is still available
      if (!slot.is_available) throw new AppError(409, 'Selected slot is not available');

      const existingBooking = await client.query(
        `SELECT id FROM bookings WHERE schedule_id = $1 AND status = ANY($2::text[]) LIMIT 1`,
        [schedule_id, ACTIVE_STATUSES]
      );
      if (existingBooking.rowCount > 0) throw new AppError(409, 'This slot is already booked');

      // Determine extra slot IDs for storage (admin flow has none by default)
      const slotIntervalMinutes = svc.wash_type === 'robot' ? 15 : 30;
      const slotsNeeded = Math.ceil(totalDurationMinutes / slotIntervalMinutes);
      let storedExtraIds = [];

      if (slotsNeeded > 1) {
        // Find the IDs of the extra slots that were (or should be) locked
        const extraResult = await client.query(
          `SELECT id FROM schedule
           WHERE box_id = $1 AND appointment_time > $2
           ORDER BY appointment_time
           LIMIT $3`,
          [effectiveBoxId, slot.appointment_time, slotsNeeded - 1]
        );
        storedExtraIds = extraResult.rows.map(r => r.id);
      }

      // Insert booking
      const insertResult = await client.query(
        `INSERT INTO bookings (user_id, service_id, schedule_id, box_id, car_info, status, is_paid, extra_schedule_ids)
         VALUES ($1, $2, $3, $4, $5, 'confirmed', FALSE, $6)
         RETURNING *`,
        [effectiveUserId, service_id, slot.id, effectiveBoxId, car_info || null, storedExtraIds]
      );

      // Mark primary slot as unavailable
      await client.query(
        `UPDATE schedule SET is_available = FALSE WHERE id = $1`,
        [slot.id]
      );

      // Insert extra services if provided
      for (const es of extraServicesData) {
        const esId = es.id || es.extra_service_id;
        if (esId) {
          await client.query(
            `INSERT INTO booking_extra_services (booking_id, extra_service_id)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [insertResult.rows[0].id, esId]
          );
        }
      }

      await writeAuditLog(client, {
        userId: req.user.id,
        actionType: 'create_booking',
        target: `booking:${insertResult.rows[0].id}`,
        result: true
      });
      clearLstmForecastCache();

      // Get box info
      const boxResult = await client.query('SELECT * FROM boxes WHERE id = $1', [effectiveBoxId]);
      const boxRow = boxResult.rows[0];

      // Get client name
      const userResult = await client.query(
        `SELECT CONCAT_WS(' ', last_name, first_name, patronymic) AS client_name FROM users WHERE id = $1`,
        [effectiveUserId]
      );

      return {
        ...insertResult.rows[0],
        appointment_time: slot.appointment_time,
        box_number: boxRow?.box_number,
        service_name: svc?.service_name || 'Мойка',
        price: Number(svc?.price || 0) + extraServicesData.reduce((sum, e) => sum + (Number(e.price) || 0), 0),
        duration_minutes: svc?.duration_minutes || 60,
        client_name: userResult.rows[0]?.client_name || client_name || 'Клиент',
        extra_services: extraServicesData
      };
    });

    res.status(201).json(booking);
  } catch (error) {
    next(error);
  }
};


export const cancelBooking = async (req, res, next) => {
  try {
    const { id } = req.params;
    const canManageBookings = hasRole(req.user, 'admin') || hasPermission(req.user, PERMISSIONS.MANAGE_BOOKINGS);

    const cancelledBooking = await withTransaction(async (client) => {
      const bookingResult = await client.query(
        `SELECT *
         FROM bookings
         WHERE id = $1
         FOR UPDATE`,
        [id]
      );

      const booking = bookingResult.rows[0];
      if (!booking) throw new AppError(404, 'Booking not found');
      if (booking.is_paid) throw new AppError(409, 'Booking is already paid');

      if (booking.user_id !== req.user.id && !canManageBookings) {
        throw new AppError(403, 'Access denied');
      }

      const updateResult = await client.query(
        `UPDATE bookings
         SET status = 'cancelled'
         WHERE id = $1
         RETURNING *`,
        [id]
      );

      // Restore primary slot
      await client.query(
        `UPDATE schedule
         SET is_available = TRUE
         WHERE id = $1`,
        [booking.schedule_id]
      );

      // Restore extra slots (for multi-slot services)
      if (booking.extra_schedule_ids && booking.extra_schedule_ids.length > 0) {
        await client.query(
          `UPDATE schedule SET is_available = TRUE WHERE id = ANY($1::int[])`,
          [booking.extra_schedule_ids]
        );
      }

      await writeAuditLog(client, {
        userId: req.user.id,
        actionType: 'cancel_booking',
        target: `booking:${id}`,
        result: true
      });
      clearLstmForecastCache();

      return updateResult.rows[0];
    });

    res.json(cancelledBooking);
  } catch (error) {
    next(error);
  }
};

export const updateBookingStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, actual_arrival } = req.body;
    const allowedStatuses = ['confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'];

    if (!allowedStatuses.includes(status)) {
      throw new AppError(400, 'Invalid booking status');
    }

    const updatedBooking = await withTransaction(async (client) => {
      const bookingResult = await client.query(
        `SELECT *
         FROM bookings
         WHERE id = $1
         FOR UPDATE`,
        [id]
      );

      const booking = bookingResult.rows[0];
      if (!booking) throw new AppError(404, 'Booking not found');

      const updateResult = await client.query(
        `UPDATE bookings
         SET status = $1,
             actual_arrival = COALESCE($2, actual_arrival)
         WHERE id = $3
         RETURNING *`,
        [status, actual_arrival ?? null, id]
      );

      if (status === 'cancelled') {
        await client.query(
          `UPDATE schedule
           SET is_available = TRUE
           WHERE id = $1`,
          [booking.schedule_id]
        );
        // Restore extra slots for multi-slot services
        if (booking.extra_schedule_ids && booking.extra_schedule_ids.length > 0) {
          await client.query(
            `UPDATE schedule SET is_available = TRUE WHERE id = ANY($1::int[])`,
            [booking.extra_schedule_ids]
          );
        }
      }

      await writeAuditLog(client, {
        userId: req.user.id,
        actionType: 'update_booking_status',
        target: `booking:${id}:${status}`,
        result: true
      });
      clearLstmForecastCache();

      return updateResult.rows[0];
    });

    res.json(updatedBooking);
  } catch (error) {
    next(error);
  }
};

export const payBooking = async (req, res, next) => {
  try {
    const { id } = req.params;

    const paidBooking = await withTransaction(async (client) => {
      const bookingResult = await client.query(
        `SELECT bk.*, sv.price AS service_price, sv.service_name
         FROM bookings bk
         JOIN services sv ON sv.id = bk.service_id
         WHERE bk.id = $1
         FOR UPDATE`,
        [id]
      );

      const booking = bookingResult.rows[0];
      if (!booking) throw new AppError(404, 'Booking not found');

      // Calculate total price (service + extras)
      const extrasResult = await client.query(
        `SELECT COALESCE(SUM(es.price), 0) AS extras_total
         FROM booking_extra_services bes
         JOIN extra_services es ON es.id = bes.extra_service_id
         WHERE bes.booking_id = $1`,
        [id]
      );
      const totalPrice = Number(booking.service_price) + Number(extrasResult.rows[0].extras_total);

      const updateResult = await client.query(
        `UPDATE bookings
         SET is_paid = TRUE
         WHERE id = $1
         RETURNING *`,
        [id]
      );

      // Auto-create cash income operation
      await client.query(
        `INSERT INTO cash_operations (type, amount, description, user_id)
         VALUES ('income', $1, $2, $3)`,
        [totalPrice, `Оплата записи #${id} (${booking.car_info || ''})`, req.user.id]
      );

      await writeAuditLog(client, {
        userId: req.user.id,
        actionType: 'pay_booking',
        target: `booking:${id}`,
        result: true
      });

      return updateResult.rows[0];
    });

    res.json(paidBooking);
  } catch (error) {
    next(error);
  }
};

export const generateTestBookings = async (req, res, next) => {
  try {
    const { date, load_percentage = 50, box_id } = req.body;
    const dateStr = date || new Date().toISOString().split('T')[0];
    const requestedLoad = Math.max(0, Math.min(100, Number(load_percentage) || 0));
    let totalFreeSlots = 0;
    let totalGenerated = 0;

    // Get target boxes
    let boxesResult;
    if (box_id) {
      boxesResult = await query('SELECT * FROM boxes WHERE id = $1 AND is_active = TRUE', [box_id]);
    } else {
      boxesResult = await query('SELECT * FROM boxes WHERE is_active = TRUE');
    }

    for (const box of boxesResult.rows) {
      // Get all slots for this box on this date
      const slotsResult = await query(
        `SELECT s.* FROM schedule s
         WHERE s.box_id = $1 AND DATE(s.appointment_time AT TIME ZONE 'Europe/Moscow') = $2
         ORDER BY s.appointment_time`,
        [box.id, dateStr]
      );

      const availableSlots = slotsResult.rows.filter(s => s.is_available && !s.is_maintenance);
      const needed = requestedLoad > 0
        ? Math.ceil(availableSlots.length * (requestedLoad / 100))
        : 0;
      totalFreeSlots += availableSlots.length;

      if (needed > 0 && availableSlots.length > 0) {
        // Get services matching box wash_type
        const servicesResult = await query(
          'SELECT * FROM services WHERE wash_type = $1',
          [box.wash_type || 'manual']
        );
        if (servicesResult.rows.length === 0) continue;

        // Select random slots
        const shuffled = availableSlots.sort(() => Math.random() - 0.5);
        const selected = shuffled.slice(0, Math.min(needed, availableSlots.length));

        for (const slot of selected) {
          const svc = servicesResult.rows[Math.floor(Math.random() * servicesResult.rows.length)];
          const carInfo = `TEST${Math.floor(Math.random() * 900) + 100}`;

          await withTransaction(async (client) => {
            const slotCheck = await client.query(
              `SELECT id
               FROM schedule
               WHERE id = $1
                 AND is_available = TRUE
                 AND is_maintenance = FALSE
               FOR UPDATE`,
              [slot.id]
            );

            if (!slotCheck.rowCount) return;

            await client.query(
              `INSERT INTO bookings (user_id, service_id, schedule_id, box_id, car_info, status, is_paid)
               VALUES ($1, $2, $3, $4, $5, 'confirmed', FALSE)`,
              [req.user.id, svc.id, slot.id, box.id, carInfo]
            );
            await client.query(
              'UPDATE schedule SET is_available = FALSE WHERE id = $1',
              [slot.id]
            );
            totalGenerated += 1;
            clearLstmForecastCache();
          });
        }
      }
    }

    res.json({
      message: 'OK',
      free_slots_before: totalFreeSlots,
      generated_bookings: totalGenerated,
      requested_percentage: requestedLoad,
    });
  } catch (error) {
    next(error);
  }
};
