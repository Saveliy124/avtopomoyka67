import { AppError } from '../utils/errors.js';
import { hasPermission } from '../utils/permissions.js';

export const requireRole = (...roles) => (req, _res, next) => {
  const userRoles = req.user?.roles || [];

  if (!roles.some((role) => userRoles.includes(role))) {
    return next(new AppError(403, 'Access denied'));
  }

  next();
};

export const requirePermission = (permission) => (req, _res, next) => {
  if (!hasPermission(req.user, permission)) {
    return next(new AppError(403, `Permission required: ${permission}`));
  }

  next();
};
