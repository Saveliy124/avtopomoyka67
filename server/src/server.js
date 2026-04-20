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
import { generateTestBookings } from './controllers/bookingController.js';
import { authRequired } from './middleware/auth.js';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { query } from './db/query.js';

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
});
