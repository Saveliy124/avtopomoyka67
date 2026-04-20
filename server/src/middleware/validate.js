import { AppError } from '../utils/errors.js';

export const requireFields = (fields) => (req, _res, next) => {
  const missing = fields.filter((field) => req.body[field] === undefined || req.body[field] === null || req.body[field] === '');

  if (missing.length) {
    return next(new AppError(400, `Missing required fields: ${missing.join(', ')}`));
  }

  next();
};
