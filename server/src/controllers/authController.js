import bcrypt from 'bcryptjs';
import { query, withTransaction } from '../db/query.js';
import { AppError } from '../utils/errors.js';
import { signToken } from '../utils/jwt.js';
import { getUserByEmail, getUserById, toPublicUser } from '../services/userService.js';

export const register = async (req, res, next) => {
  try {
    const { last_name, first_name, patronymic = null, email, password } = req.body;

    const existing = await getUserByEmail(email);
    if (existing) {
      throw new AppError(409, 'User with this email already exists');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const createdUser = await withTransaction(async (client) => {
      const userResult = await client.query(
        `INSERT INTO users (last_name, first_name, patronymic, email, password)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [last_name, first_name, patronymic, email, passwordHash]
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
    const { email, password } = req.body;

    const user = await getUserByEmail(email);

    if (!user) throw new AppError(401, 'Invalid email or password');
    if (!user.is_active) throw new AppError(403, 'User is inactive');

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) throw new AppError(401, 'Invalid email or password');

    const token = signToken({ userId: user.id });

    res.json({ token, user: toPublicUser(user) });
  } catch (error) {
    next(error);
  }
};

export const me = async (req, res) => {
  // req.user already has the public user from auth middleware
  res.json(req.user);
};
