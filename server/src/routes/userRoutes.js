import { Router } from 'express';
import { getUsers, createUser, updateUserPermissions, updateUserRoles } from '../controllers/userController.js';
import { authRequired } from '../middleware/auth.js';
import { requirePermission, requireRole } from '../middleware/role.js';
import { PERMISSIONS } from '../utils/permissions.js';

const router = Router();

router.get('/', authRequired, requireRole('admin'), getUsers);
router.post('/', authRequired, requireRole('admin'), createUser);
router.patch('/:id/permissions', authRequired, requirePermission(PERMISSIONS.MANAGE_EMPLOYEES), updateUserPermissions);
router.patch('/:id/roles', authRequired, requireRole('admin'), updateUserRoles);

export default router;
