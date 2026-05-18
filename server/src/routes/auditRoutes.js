import { Router } from 'express';
import { listAuditLogs } from '../controllers/auditController.js';
import { authRequired } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';

const router = Router();

router.get('/', authRequired, requireRole('admin'), listAuditLogs);

export default router;
