import { query, withTransaction } from '../db/query.js';
import { AppError } from '../utils/errors.js';
import bcrypt from 'bcryptjs';

export const getUsers = async (_req, res, next) => {
  try {
    const result = await query(
      `SELECT u.id, u.last_name, u.first_name, u.patronymic, u.email,
              u.is_active, u.registration_date, u.employee_permissions,
              COALESCE(
                ARRAY_AGG(r.role_name) FILTER (WHERE r.role_name IS NOT NULL),
                ARRAY[]::text[]
              ) AS roles
       FROM users u
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id
       GROUP BY u.id
       ORDER BY u.id`
    );

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

export const createUser = async (req, res, next) => {
  try {
    const { email, password, first_name, last_name, patronymic, roles, employee_permissions } = req.body;

    const passwordHash = await bcrypt.hash(password || 'default123', 10);
    const defaultPerms = {
      can_manage_bookings: false, can_manage_cash: false,
      can_manage_services: false, can_view_reports: false,
      can_manage_schedule: false, can_manage_employees: false,
      can_do_washing: false
    };

    const newUser = await withTransaction(async (client) => {
      const userResult = await client.query(
        `INSERT INTO users (last_name, first_name, patronymic, email, password, employee_permissions)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [last_name || 'Пользователь', first_name || 'Новый', patronymic || null,
         email, passwordHash, JSON.stringify(employee_permissions || defaultPerms)]
      );

      const userId = userResult.rows[0].id;
      const userRoles = roles || ['client'];

      for (const roleName of userRoles) {
        await client.query(
          `INSERT INTO user_roles (user_id, role_id)
           SELECT $1, id FROM roles WHERE role_name = $2
           ON CONFLICT DO NOTHING`,
          [userId, roleName]
        );
      }

      const finalResult = await client.query(
        `SELECT u.id, u.last_name, u.first_name, u.patronymic, u.email,
                u.is_active, u.registration_date, u.employee_permissions,
                COALESCE(
                  ARRAY_AGG(r.role_name) FILTER (WHERE r.role_name IS NOT NULL),
                  ARRAY[]::text[]
                ) AS roles
         FROM users u
         LEFT JOIN user_roles ur ON ur.user_id = u.id
         LEFT JOIN roles r ON r.id = ur.role_id
         WHERE u.id = $1
         GROUP BY u.id`,
        [userId]
      );

      return finalResult.rows[0];
    });

    res.status(201).json(newUser);
  } catch (error) {
    next(error);
  }
};

export const updateUserPermissions = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { permissions, employee_permissions, is_active } = req.body;
    const perms = permissions || employee_permissions;

    const updatedUser = await withTransaction(async (client) => {
      const userCheck = await client.query('SELECT id FROM users WHERE id = $1', [id]);
      if (!userCheck.rowCount) throw new AppError(404, 'User not found');

      await client.query(
        `UPDATE users
         SET employee_permissions = COALESCE($1::jsonb, employee_permissions),
             is_active = COALESCE($2, is_active)
         WHERE id = $3`,
        [perms ? JSON.stringify(perms) : null, is_active ?? null, id]
      );

      const finalResult = await client.query(
        `SELECT u.id, u.last_name, u.first_name, u.patronymic, u.email,
                u.is_active, u.registration_date, u.employee_permissions,
                COALESCE(
                  ARRAY_AGG(r.role_name) FILTER (WHERE r.role_name IS NOT NULL),
                  ARRAY[]::text[]
                ) AS roles
         FROM users u
         LEFT JOIN user_roles ur ON ur.user_id = u.id
         LEFT JOIN roles r ON r.id = ur.role_id
         WHERE u.id = $1
         GROUP BY u.id`,
        [id]
      );

      return finalResult.rows[0];
    });

    res.json(updatedUser);
  } catch (error) {
    next(error);
  }
};

export const updateUserRoles = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { roles } = req.body;

    if (!roles || !Array.isArray(roles)) {
      throw new AppError(400, 'roles must be an array');
    }

    const updatedUser = await withTransaction(async (client) => {
      const userCheck = await client.query('SELECT id FROM users WHERE id = $1', [id]);
      if (!userCheck.rowCount) throw new AppError(404, 'User not found');

      await client.query('DELETE FROM user_roles WHERE user_id = $1', [id]);

      for (const roleName of roles) {
        await client.query(
          `INSERT INTO user_roles (user_id, role_id)
           SELECT $1, id FROM roles WHERE role_name = $2`,
          [id, roleName]
        );
      }

      const finalResult = await client.query(
        `SELECT u.id, u.last_name, u.first_name, u.patronymic, u.email,
                u.is_active, u.registration_date, u.employee_permissions,
                COALESCE(
                  ARRAY_AGG(r.role_name) FILTER (WHERE r.role_name IS NOT NULL),
                  ARRAY[]::text[]
                ) AS roles
         FROM users u
         LEFT JOIN user_roles ur ON ur.user_id = u.id
         LEFT JOIN roles r ON r.id = ur.role_id
         WHERE u.id = $1
         GROUP BY u.id`,
        [id]
      );

      return finalResult.rows[0];
    });

    res.json(updatedUser);
  } catch (error) {
    next(error);
  }
};
