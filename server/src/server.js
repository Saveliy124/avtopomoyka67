import cors from 'cors';
import express from 'express';
import morgan from 'morgan';
import cron from 'node-cron';
import authRoutes from './routes/authRoutes.js';
import serviceRoutes from './routes/serviceRoutes.js';
import extraServiceRoutes from './routes/extraServiceRoutes.js';
import boxRoutes from './routes/boxRoutes.js';
import slotRoutes from './routes/slotRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import userRoutes from './routes/userRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import cashRoutes from './routes/cashRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import { generateTestBookings } from './controllers/bookingController.js';
import { authRequired } from './middleware/auth.js';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { query } from './db/query.js';
import { startNoShowJob } from './services/noShowJob.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Health check
app.get('/api/health', async (_req, res, next) => {
  try {
    const result = await query('SELECT NOW() AS now');
    res.json({ success: true, message: 'API is working', dbTime: result.rows[0].now });
  } catch (error) {
    next(error);
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/extra-services', extraServiceRoutes);
app.use('/api/boxes', boxRoutes);
app.use('/api/slots', slotRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/cash', cashRoutes);
app.use('/api/audit', auditRoutes);

// Test endpoint for generating bookings
app.post('/api/tests/generate-bookings', authRequired, generateTestBookings);

// CRON for AI predictions (placeholder)
cron.schedule('0 0 * * *', () => {
  console.log('CRON: here you can trigger Python AI module and save predictions');
});

app.use(notFound);
app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`Server started on http://localhost:${env.port}`);

  // Migrations on startup
  const migrations = [
    `ALTER TABLE schedule ADD COLUMN IF NOT EXISTS is_maintenance BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE services ADD COLUMN IF NOT EXISTS description TEXT`,
    `ALTER TABLE extra_services ADD COLUMN IF NOT EXISTS description TEXT`,
    `ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_service_id_fkey`,
    `ALTER TABLE bookings ADD CONSTRAINT bookings_service_id_fkey FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20) UNIQUE`,
    `ALTER TABLE users ALTER COLUMN email DROP NOT NULL`,
    `CREATE TABLE IF NOT EXISTS audit_log (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      action_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      action_type VARCHAR(50) NOT NULL,
      target TEXT,
      result BOOLEAN
    )`,
  ];
  Promise.all(migrations.map(sql => query(sql)))
    .then(() => {
      console.log('Migrations OK');
      // Start no_show auto-assignment job after DB is ready
      startNoShowJob();
    })
    .catch(err => console.error('Migration FAILED:', err));
});

// CRON: закрывать прошедшие слоты каждую минуту для клиентов
// Слот помечается is_available=false только если на нём нет активной записи
// (adminCreate игнорирует is_available, поэтому admin может записать в любой слот)
cron.schedule('* * * * *', async () => {
  try {
    await query(`
      UPDATE schedule
      SET is_available = FALSE
      WHERE appointment_time < NOW()
        AND is_available = TRUE
        AND is_maintenance = FALSE
        AND NOT EXISTS (
          SELECT 1 FROM bookings b
          WHERE b.schedule_id = schedule.id
            AND b.status NOT IN ('cancelled', 'cancelled_tech')
        )
    `);
  } catch (err) {
    console.error('CRON [close-past-slots] error:', err.message);
  }
});
