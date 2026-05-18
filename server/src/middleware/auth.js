import { AppError } from '../utils/errors.js';
import { verifyToken } from '../utils/jwt.js';
import { getUserById, toPublicUser } from '../services/userService.js';

export const authRequired = async (req, _res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError(401, 'Authorization token is missing');
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    const user = await getUserById(decoded.userId);

    if (!user) throw new AppError(401, 'User not found');
    if (!user.is_active) throw new AppError(403, 'User is inactive');

    req.user = toPublicUser(user);
    next();
  } catch (error) {
    next(error.statusCode ? error : new AppError(401, 'Invalid or expired token'));
  }
};
