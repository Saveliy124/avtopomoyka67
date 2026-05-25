import bcrypt from 'bcryptjs';
import { pool } from '../src/db/pool.js';

const adminPassword = await bcrypt.hash('admin123', 10);
const employeePassword = await bcrypt.hash('employee123', 10);
const clientPassword = await bcrypt.hash('client123', 10);

try {
  await pool.query(`
    INSERT INTO users (last_name, first_name, patronymic, phone, password, employee_permissions)
    VALUES
      ('Иванов', 'Иван', 'Иванович', '+79001112233', '${adminPassword}', '{"can_manage_bookings": true, "can_manage_cash": true, "can_manage_services": true, "can_view_reports": true, "can_manage_schedule": true, "can_manage_employees": true, "can_do_washing": true}'),
      ('Сидоров', 'Пётр', 'Алексеевич', '+79002223344', '${employeePassword}', '{"can_manage_bookings": true, "can_manage_cash": false, "can_manage_services": false, "can_view_reports": true, "can_manage_schedule": true, "can_manage_employees": false, "can_do_washing": true}'),
      ('Петрова', 'Анна', NULL, '+79003334455', '${clientPassword}', '{"can_manage_bookings": false, "can_manage_cash": false, "can_manage_services": false, "can_view_reports": false, "can_manage_schedule": false, "can_manage_employees": false, "can_do_washing": false}')
    ON CONFLICT (phone) DO UPDATE SET
      password = EXCLUDED.password,
      employee_permissions = EXCLUDED.employee_permissions;

    INSERT INTO user_roles (user_id, role_id)
    SELECT u.id, r.id
    FROM users u
    JOIN roles r ON (
      (u.phone = '+79001112233' AND r.role_name = 'admin') OR
      (u.phone = '+79002223344' AND r.role_name = 'employee') OR
      (u.phone = '+79003334455' AND r.role_name = 'client')
    )
    ON CONFLICT DO NOTHING;
  `);


  // Services with wash_type and descriptions
  await pool.query(`
    INSERT INTO services (service_name, price, duration_minutes, wash_type, description)
    VALUES
      ('Комплексная мойка', 1200, 60, 'manual', 'Полная мойка кузова, стёкол и дисков, чистка порогов и ковриков. Идеально после дальней дороги.'),
      ('Экспресс мойка', 600, 30, 'manual', 'Быстрая мойка кузова и стёкол без внутренних работ. Оптимально для поддержания чистоты.'),
      ('Мойка кузова', 400, 30, 'manual', 'Бережная мойка кузова с профессиональной автохимией без повреждения лакокрасочного покрытия.')
    ON CONFLICT DO NOTHING;

    INSERT INTO services (service_name, price, duration_minutes, wash_type, description)
    VALUES
      ('Робот — Стандарт', 350, 15, 'robot', 'Автоматическая мойка кузова и стёкол за 15 минут. Мягкие щётки, безопасно для любых кузовов.'),
      ('Робот — Премиум', 500, 15, 'robot', 'Мойка с нанесением воска и защитного покрытия. Кузов блестит и отталкивает грязь дольше.')
    ON CONFLICT DO NOTHING;
  `);

  // Extra services with descriptions
  await pool.query(`
    INSERT INTO extra_services (service_name, price, duration_minutes, description)
    VALUES
      ('Полировка кузова', 1500, 60, 'Машинная полировка пастой. Убирает мелкие царапины и возвращает блеск покрытию.'),
      ('Химчистка салона', 3500, 120, 'Глубокая очистка обивки, ковров и пластика с применением профессиональной химии.'),
      ('Чернение резины', 300, 15, 'Нанесение защитного состава для чернения резины. Придаёт колёсам ухоженный вид.'),
      ('Обработка воском', 500, 30, 'Нанесение защитного воска. Обеспечивает гидрофобный эффект на 4–6 недель.'),
      ('Мойка двигателя', 800, 30, 'Бережная очистка двигательного отсека от пыли, масла и грязи.')
    ON CONFLICT DO NOTHING;
  `);


  // Boxes with wash_type
  await pool.query(`
    INSERT INTO boxes (box_number, is_active, wash_type)
    VALUES ('1', TRUE, 'manual'), ('2', TRUE, 'manual'), ('R1', TRUE, 'robot')
    ON CONFLICT (box_number) DO NOTHING;
  `);

  // Generate schedule slots for the next 7 days (today + 6) for each box
  await pool.query(`
    INSERT INTO schedule (appointment_time, is_available, box_id)
    SELECT * FROM (
      -- Manual boxes: slots every 30 minutes, 09:00–20:30
      SELECT (d.day + (h || ':' || m || ':00')::time) AS appointment_time,
             TRUE AS is_available,
             b.id AS box_id
      FROM generate_series(CURRENT_DATE, CURRENT_DATE + INTERVAL '6 days', INTERVAL '1 day') AS d(day)
      CROSS JOIN boxes b
      CROSS JOIN generate_series(9, 20) AS h
      CROSS JOIN (SELECT 0 AS m UNION SELECT 30) AS mins(m)
      WHERE b.wash_type = 'manual'
      UNION ALL
      -- Robot boxes: slots every 15 minutes, 09:00–20:45
      SELECT (d.day + (h || ':' || m || ':00')::time) AS appointment_time,
             TRUE AS is_available,
             b.id AS box_id
      FROM generate_series(CURRENT_DATE, CURRENT_DATE + INTERVAL '6 days', INTERVAL '1 day') AS d(day)
      CROSS JOIN boxes b
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

  console.log('Seed data inserted successfully');
} catch (error) {
  console.error('Failed to seed database:', error.message);
} finally {
  await pool.end();
}
