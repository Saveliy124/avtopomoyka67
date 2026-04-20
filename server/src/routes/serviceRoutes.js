import { Router } from 'express';
import { createService, getServices, updateService } from '../controllers/serviceController.js';
import { authRequired } from '../middleware/auth.js';
import { requirePermission } from '../middleware/role.js';
import { requireFields } from '../middleware/validate.js';
import { PERMISSIONS } from '../utils/permissions.js';

const router = Router();

router.get('/', getServices);
router.post('/', authRequired, requirePermission(PERMISSIONS.MANAGE_SERVICES), requireFields(['service_name', 'price', 'duration_minutes']), createService);
router.patch('/:id', authRequired, requirePermission(PERMISSIONS.MANAGE_SERVICES), updateService);

export default router;
