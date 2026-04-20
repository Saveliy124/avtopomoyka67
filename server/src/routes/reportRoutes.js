import { Router } from 'express';
import { getDashboardStats, getPredictions } from '../controllers/reportController.js';
import { authRequired } from '../middleware/auth.js';
import { requirePermission } from '../middleware/role.js';
import { PERMISSIONS } from '../utils/permissions.js';

const router = Router();

router.get('/dashboard', authRequired, requirePermission(PERMISSIONS.VIEW_REPORTS), getDashboardStats);
router.get('/predictions', authRequired, requirePermission(PERMISSIONS.VIEW_REPORTS), getPredictions);

export default router;
