import { Router } from 'express';
import { login, me, register } from '../controllers/authController.js';
import { authRequired } from '../middleware/auth.js';
import { requireFields } from '../middleware/validate.js';

const router = Router();

router.post('/register', requireFields(['last_name', 'first_name', 'email', 'password']), register);
router.post('/login', requireFields(['email', 'password']), login);
router.get('/me', authRequired, me);

export default router;
