import { Router } from 'express';
import { getUsers, getWashers, createUser, updateUserPermissions, updateUserRoles, deleteUser } from '../controllers/userController.js';
import { authRequired } from '../middleware/auth.js';
import { requirePermission, requireRole } from '../middleware/role.js';
import { PERMISSIONS } from '../utils/permissions.js';

const router = Router();

router.get('/', authRequired, requireRole('admin'), getUsers);
router.get('/washers', authRequired, requirePermission(PERMISSIONS.MANAGE_EMPLOYEES), getWashers);
router.post('/', authRequired, requireRole('admin'), createUser);
router.patch('/:id/permissions', authRequired, requirePermission(PERMISSIONS.MANAGE_EMPLOYEES), updateUserPermissions);
router.patch('/:id/roles', authRequired, requireRole('admin'), updateUserRoles);
router.delete('/:id', authRequired, requireRole('admin'), deleteUser);

export default router;
