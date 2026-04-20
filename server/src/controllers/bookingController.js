import { query, withTransaction } from '../db/query.js';
import { AppError } from '../utils/errors.js';
import { hasPermission, hasRole, PERMISSIONS } from '../utils/permissions.js';
import { writeAuditLog } from '../services/auditService.js';

const ACTIVE_STATUSES = ['confirmed', 'in_progress'];

export const getMyBookings = async (req, res, next) => {
  try {
    const canSeeAll = hasRole(req.user, 'admin') || hasPermission(req.user, PERMISSIONS.MANAGE_BOOKINGS);

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
              sv.price,
              sv.duration_minutes,
              CONCAT_WS(' ', u.last_name, u.first_name, u.patronymic) AS client_name
       FROM bookings bk
       JOIN schedule s ON s.id = bk.schedule_id
       LEFT JOIN boxes bx ON bx.id = bk.box_id
       JOIN services sv ON sv.id = bk.service_id
       JOIN users u ON u.id = bk.user_id
       ${canSeeAll ? '' : 'WHERE bk.user_id = $1'}
       ORDER BY s.appointment_time DESC`,
      canSeeAll ? [] : [req.user.id]
    );

    // Attach extra_services and calculate total price for each booking
    const bookings = result.rows;
    for (const booking of bookings) {
      const extrasResult = await query(
        `SELECT es.id, es.service_name, es.price, es.duration_minutes
         FROM booking_extra_services bes
         JOIN extra_services es ON es.id = bes.extra_service_id
         WHERE bes.booking_id = $1`,
        [booking.id]
      );
      booking.extra_services = extrasResult.rows;
      
      // Calculate total price: base service price + extra services
      const basePrice = Number(booking.price);
      const extrasTotal = booking.extra_services.reduce((sum, es) => sum + Number(es.price), 0);
      booking.price = basePrice + extrasTotal;
    }

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
      const scheduleResult = await client.query(
        `SELECT s.id, s.appointment_time, s.is_available, s.box_id, b.box_number
         FROM schedule s
         LEFT JOIN boxes b ON b.id = s.box_id
         WHERE s.id = $1
         FOR UPDATE OF s`,
        [schedule_id]
      );

      const slot = scheduleResult.rows[0];

      if (!slot) throw new AppError(404, 'Schedule slot not found');
      if (!slot.is_available) throw new AppError(409, 'Selected slot is not available');

      const existingBooking = await client.query(
        `SELECT id
         FROM bookings
         WHERE schedule_id = $1
           AND status = ANY($2::text[])
         LIMIT 1`,
        [schedule_id, ACTIVE_STATUSES]
      );

      if (existingBooking.rowCount > 0) {
        throw new AppError(409, 'This slot is already booked');
      }

      const insertResult = await client.query(
        `INSERT INTO bookings (user_id, service_id, schedule_id, box_id, car_info, status, is_paid)
         VALUES ($1, $2, $3, $4, $5, 'confirmed', FALSE)
         RETURNING *`,
        [effectiveUserId, service_id, schedule_id, slot.box_id, car_info || null]
      );

      await client.query(
        `UPDATE schedule
         SET is_available = FALSE
         WHERE id = $1`,
        [schedule_id]
      );

      // Insert extra services if provided
      const extraServicesData = extra_services || [];
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

      // Get service info for the response
      const svcResult = await client.query('SELECT * FROM services WHERE id = $1', [service_id]);
      const svc = svcResult.rows[0];

      // Get client name
      const userResult = await client.query(
        `SELECT CONCAT_WS(' ', last_name, first_name, patronymic) AS client_name FROM users WHERE id = $1`,
        [effectiveUserId]
      );

      return {
        ...insertResult.rows[0],
        appointment_time: slot.appointment_time,
        box_number: slot.box_number,
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

      await client.query(
        `UPDATE schedule
         SET is_available = TRUE
         WHERE id = $1`,
        [booking.schedule_id]
      );

      await writeAuditLog(client, {
        userId: req.user.id,
        actionType: 'cancel_booking',
        target: `booking:${id}`,
        result: true
      });

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
      }

      await writeAuditLog(client, {
        userId: req.user.id,
        actionType: 'update_booking_status',
        target: `booking:${id}:${status}`,
        result: true
      });

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
         WHERE s.box_id = $1 AND DATE(s.appointment_time) = $2
         ORDER BY s.appointment_time`,
        [box.id, dateStr]
      );

      const allSlots = slotsResult.rows;
      const availableSlots = allSlots.filter(s => s.is_available);
      const numToFill = Math.floor(allSlots.length * (load_percentage / 100));
      const alreadyFilled = allSlots.length - availableSlots.length;
      const needed = Math.max(0, numToFill - alreadyFilled);

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
            await client.query(
              `INSERT INTO bookings (user_id, service_id, schedule_id, box_id, car_info, status, is_paid)
               VALUES ($1, $2, $3, $4, $5, 'confirmed', FALSE)`,
              [req.user.id, svc.id, slot.id, box.id, carInfo]
            );
            await client.query(
              'UPDATE schedule SET is_available = FALSE WHERE id = $1',
              [slot.id]
            );
          });
        }
      }
    }

    res.json({ message: 'OK' });
  } catch (error) {
    next(error);
  }
};
