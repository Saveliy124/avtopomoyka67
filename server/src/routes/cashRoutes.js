import { Router } from 'express';
import { getOperations, createOperation } from '../controllers/cashController.js';
import { authRequired } from '../middleware/auth.js';
import { requirePermission } from '../middleware/role.js';
import { PERMISSIONS } from '../utils/permissions.js';

const router = Router();

router.get('/', authRequired, requirePermission(PERMISSIONS.MANAGE_CASH), getOperations);
router.post('/', authRequired, requirePermission(PERMISSIONS.MANAGE_CASH), createOperation);

export default router;
