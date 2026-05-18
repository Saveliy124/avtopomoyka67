import bcrypt from 'bcryptjs';
import { query, withTransaction } from '../db/query.js';
import { AppError } from '../utils/errors.js';
import { signToken } from '../utils/jwt.js';
import { getUserByPhone, getUserById, toPublicUser } from '../services/userService.js';

const normalizePhone = (phone) => String(phone || '').replace(/[^\d+]/g, '');

const isValidPhone = (phone) => {
  const normalized = normalizePhone(phone);

  if (/^\+79\d{9}$/.test(normalized)) return true;
  if (/^\+77\d{9}$/.test(normalized)) return true;
  if (/^\+375(25|29|33|44)\d{7}$/.test(normalized)) return true;
  if (/^\+374\d{8}$/.test(normalized)) return true;

  return false;
};

export const register = async (req, res, next) => {
  try {
    const { last_name, first_name, patronymic = null, password } = req.body;
    const phone = normalizePhone(req.body.phone);

    if (!isValidPhone(phone)) {
      throw new AppError(400, 'Invalid phone number');
    }

    const existing = await getUserByPhone(phone);
    if (existing) {
      throw new AppError(409, 'User with this phone already exists');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const createdUser = await withTransaction(async (client) => {
      const userResult = await client.query(
        `INSERT INTO users (last_name, first_name, patronymic, phone, password)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [last_name, first_name, patronymic, phone, passwordHash]
      );

      const userId = userResult.rows[0].id;

      await client.query(
        `INSERT INTO user_roles (user_id, role_id)
         SELECT $1, id
         FROM roles
         WHERE role_name = 'client'`,
        [userId]
      );

      return userId;
    });

    const user = await getUserById(createdUser);
    const token = signToken({ userId: user.id });

    res.status(201).json({ token, user: toPublicUser(user) });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { phone, password } = req.body;
    console.log('[DEBUG LOGIN] Request phone:', phone, 'password:', password);

    const user = await getUserByPhone(phone);
    console.log('[DEBUG LOGIN] Found user?', !!user);

    if (!user) throw new AppError(401, 'Invalid phone or password');
    if (!user.is_active) throw new AppError(403, 'User is inactive');

    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log('[DEBUG LOGIN] isPasswordValid?', isPasswordValid);
    if (!isPasswordValid) throw new AppError(401, 'Invalid phone or password');

    const token = signToken({ userId: user.id });

    res.json({ token, user: toPublicUser(user) });
  } catch (error) {
    next(error);
  }
};

export const me = async (req, res) => {
  res.json(req.user);
};
