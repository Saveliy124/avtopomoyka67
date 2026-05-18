import { Router } from 'express';
import { cancelBooking, createBooking, getMyBookings, updateBookingStatus, payBooking, generateTestBookings } from '../controllers/bookingController.js';
import { authRequired } from '../middleware/auth.js';
import { requireFields } from '../middleware/validate.js';
import { requirePermission } from '../middleware/role.js';
import { PERMISSIONS } from '../utils/permissions.js';

const router = Router();

router.get('/', authRequired, getMyBookings);
router.post('/', authRequired, requireFields(['schedule_id', 'service_id']), createBooking);
router.patch('/:id/cancel', authRequired, cancelBooking);
router.patch('/:id/status', authRequired, requirePermission(PERMISSIONS.DO_WASHING), requireFields(['status']), updateBookingStatus);
router.patch('/:id/pay', authRequired, requirePermission(PERMISSIONS.MANAGE_CASH), payBooking);

export default router;
