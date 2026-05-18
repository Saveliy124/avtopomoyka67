import { Router } from 'express';
import { createBox, getBoxes, updateBox, deleteBox } from '../controllers/boxController.js';
import { authRequired } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { requireFields } from '../middleware/validate.js';

const router = Router();

router.get('/', getBoxes);
router.post('/', authRequired, requireRole('admin'), requireFields(['box_number']), createBox);
router.patch('/:id', authRequired, requireRole('admin'), updateBox);
router.delete('/:id', authRequired, requireRole('admin'), deleteBox);

export default router;
