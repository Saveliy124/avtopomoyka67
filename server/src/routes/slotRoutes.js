import { Router } from 'express';
import { createSlot, generateSlots, generateDaySlots, getSlots, bulkUpdateSlotsStatus } from '../controllers/slotController.js';
import { authRequired } from '../middleware/auth.js';
import { requirePermission } from '../middleware/role.js';
import { requireFields } from '../middleware/validate.js';
import { PERMISSIONS } from '../utils/permissions.js';

const router = Router();

router.get('/', getSlots);
router.patch('/bulk-status', authRequired, requirePermission(PERMISSIONS.MANAGE_SCHEDULE), bulkUpdateSlotsStatus);

router.post('/', authRequired, requirePermission(PERMISSIONS.MANAGE_SCHEDULE), requireFields(['appointment_time', 'box_id']), createSlot);
router.post('/generate', authRequired, requirePermission(PERMISSIONS.MANAGE_SCHEDULE), requireFields(['box_id', 'date']), generateSlots);
router.post('/generate-day', authRequired, requirePermission(PERMISSIONS.MANAGE_SCHEDULE), requireFields(['date']), generateDaySlots);

export default router;
