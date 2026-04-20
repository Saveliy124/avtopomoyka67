import bcrypt from 'bcryptjs';
import { pool } from '../src/db/pool.js';

const adminPassword = await bcrypt.hash('admin123', 10);
const employeePassword = await bcrypt.hash('employee123', 10);
const clientPassword = await bcrypt.hash('client123', 10);

try {
  // Users
  await pool.query(`
    INSERT INTO users (last_name, first_name, patronymic, email, password, employee_permissions)
    VALUES
      ('Иванов', 'Иван', 'Иванович', 'admin@carwash.local', '${adminPassword}', '{"can_manage_bookings": true, "can_manage_cash": true, "can_manage_services": true, "can_view_reports": true, "can_manage_schedule": true, "can_manage_employees": true, "can_do_washing": true}'),
      ('Сидоров', 'Пётр', 'Алексеевич', 'employee@carwash.local', '${employeePassword}', '{"can_manage_bookings": true, "can_manage_cash": false, "can_manage_services": false, "can_view_reports": true, "can_manage_schedule": true, "can_manage_employees": false, "can_do_washing": true}'),
      ('Петрова', 'Анна', NULL, 'client@carwash.local', '${clientPassword}', '{"can_manage_bookings": false, "can_manage_cash": false, "can_manage_services": false, "can_view_reports": false, "can_manage_schedule": false, "can_manage_employees": false, "can_do_washing": false}')
    ON CONFLICT (email) DO NOTHING;

    INSERT INTO user_roles (user_id, role_id)
    SELECT u.id, r.id
    FROM users u
    JOIN roles r ON (
      (u.email = 'admin@carwash.local' AND r.role_name = 'admin') OR
      (u.email = 'employee@carwash.local' AND r.role_name = 'employee') OR
      (u.email = 'client@carwash.local' AND r.role_name = 'client')
    )
    ON CONFLICT DO NOTHING;
  `);

  // Services with wash_type
  await pool.query(`
    INSERT INTO services (service_name, price, duration_minutes, wash_type)
    VALUES
      ('Комплексная мойка', 1200, 60, 'manual'),
      ('Экспресс мойка', 600, 30, 'manual'),
      ('Мойка кузова', 400, 30, 'manual'),
      ('Робот — Стандарт', 350, 15, 'robot'),
      ('Робот — Премиум', 500, 15, 'robot')
    ON CONFLICT DO NOTHING;
  `);

  // Extra services
  await pool.query(`
    INSERT INTO extra_services (service_name, price, duration_minutes)
    VALUES
      ('Полировка кузова', 1500, 40),
      ('Химчистка салона', 3500, 120),
      ('Чернение резины', 300, 10),
      ('Обработка воском', 500, 15),
      ('Мойка двигателя', 800, 30)
    ON CONFLICT DO NOTHING;
  `);

  // Boxes with wash_type
  await pool.query(`
    INSERT INTO boxes (box_number, is_active, wash_type)
    VALUES ('1', TRUE, 'manual'), ('2', TRUE, 'manual'), ('R1', TRUE, 'robot')
    ON CONFLICT (box_number) DO NOTHING;
  `);

  // Generate schedule slots for today
  await pool.query(`
    INSERT INTO schedule (appointment_time, is_available, box_id)
    SELECT * FROM (
      SELECT CURRENT_DATE + (h || ':' || m || ':00')::time AS appointment_time,
             TRUE AS is_available,
             b.id AS box_id
      FROM boxes b
      CROSS JOIN generate_series(9, 20) AS h
      CROSS JOIN (SELECT 0 AS m UNION SELECT 30) AS mins(m)
      WHERE b.wash_type = 'manual'
      UNION ALL
      SELECT CURRENT_DATE + (h || ':' || m || ':00')::time,
             TRUE,
             b.id
      FROM boxes b
      CROSS JOIN generate_series(9, 20) AS h
      CROSS JOIN (SELECT 0 AS m UNION SELECT 15 UNION SELECT 30 UNION SELECT 45) AS mins(m)
      WHERE b.wash_type = 'robot'
    ) seed_schedule
    WHERE NOT EXISTS (
      SELECT 1 FROM schedule s
      WHERE s.appointment_time = seed_schedule.appointment_time
        AND s.box_id = seed_schedule.box_id
    );
  `);

  // Cash operations seed (empty per user request)
  /*
  await pool.query(`
    INSERT INTO cash_operations (type, amount, description, user_id)
    VALUES
      ('income', 1200, 'Комплексная мойка #1', 1),
      ('income', 600, 'Экспресс мойка #2', 1),
      ('expense', 5000, 'Закупка автохимии', 1);
  `);
  */

  // AI prediction seed
  const scheduleResult = await pool.query('SELECT id FROM schedule ORDER BY id LIMIT 1');
  if (scheduleResult.rowCount > 0) {
    await pool.query(
      `INSERT INTO ai_predictions (schedule_id, prediction_date, predicted_occupancy, confidence)
       VALUES ($1, CURRENT_DATE, 0.85, 0.92)
       ON CONFLICT DO NOTHING`,
      [scheduleResult.rows[0].id]
    );
  }

  console.log('Seed data inserted successfully');
} catch (error) {
  console.error('Failed to seed database:', error.message);
} finally {
  await pool.end();
}
