import { Router } from 'express';
import { getExtraServices, createExtraService, updateExtraService } from '../controllers/extraServiceController.js';
import { authRequired } from '../middleware/auth.js';
import { requirePermission } from '../middleware/role.js';
import { requireFields } from '../middleware/validate.js';
import { PERMISSIONS } from '../utils/permissions.js';

const router = Router();

router.get('/', getExtraServices);
router.post('/', authRequired, requirePermission(PERMISSIONS.MANAGE_SERVICES), requireFields(['service_name', 'price', 'duration_minutes']), createExtraService);
router.patch('/:id', authRequired, requirePermission(PERMISSIONS.MANAGE_SERVICES), updateExtraService);

export default router;
