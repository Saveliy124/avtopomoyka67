import { query, withTransaction } from '../db/query.js';
import { AppError } from '../utils/errors.js';
import bcrypt from 'bcryptjs';
import { writeAuditLog } from '../services/auditService.js';

export const getUsers = async (_req, res, next) => {
  try {
    const result = await query(
      `SELECT u.id, u.last_name, u.first_name, u.patronymic, u.phone, u.email,
              u.is_active, u.registration_date, u.employee_permissions,
              COUNT(al.id)::int AS total_actions,
              COUNT(al.id) FILTER (
                WHERE al.action_type = 'update_booking_status'
                  AND al.target LIKE '%:completed'
              )::int AS completed_washes,
              COUNT(al.id) FILTER (
                WHERE al.action_type = 'update_booking_status'
                  AND al.target LIKE '%:in_progress'
              )::int AS started_washes,
              COUNT(al.id) FILTER (
                WHERE DATE(al.action_time AT TIME ZONE 'Europe/Moscow') = CURRENT_DATE AT TIME ZONE 'Europe/Moscow'
              )::int AS today_actions,
              COALESCE(
                ARRAY_AGG(r.role_name) FILTER (WHERE r.role_name IS NOT NULL),
                ARRAY[]::text[]
              ) AS roles
       FROM users u
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id
       LEFT JOIN audit_log al ON al.user_id = u.id
       GROUP BY u.id
       ORDER BY u.id`
    );

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

export const getWashers = async (_req, res, next) => {
  try {
    const result = await query(
      `SELECT u.id, u.last_name, u.first_name, u.patronymic, u.phone, u.email,
              u.is_active, u.registration_date, u.employee_permissions,
              COUNT(al.id)::int AS total_actions,
              COUNT(al.id) FILTER (
                WHERE al.action_type = 'update_booking_status'
                  AND al.target LIKE '%:completed'
              )::int AS completed_washes,
              COUNT(al.id) FILTER (
                WHERE al.action_type = 'update_booking_status'
                  AND al.target LIKE '%:in_progress'
              )::int AS started_washes,
              COUNT(al.id) FILTER (
                WHERE DATE(al.action_time AT TIME ZONE 'Europe/Moscow') = CURRENT_DATE AT TIME ZONE 'Europe/Moscow'
              )::int AS today_actions,
              COALESCE(
                ARRAY_AGG(r.role_name) FILTER (WHERE r.role_name IS NOT NULL),
                ARRAY[]::text[]
              ) AS roles
       FROM users u
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id
       LEFT JOIN audit_log al ON al.user_id = u.id
       WHERE u.employee_permissions->>'can_do_washing' = 'true'
         AND NOT EXISTS (
           SELECT 1
           FROM user_roles admin_ur
           JOIN roles admin_role ON admin_role.id = admin_ur.role_id
           WHERE admin_ur.user_id = u.id
             AND admin_role.role_name = 'admin'
         )
       GROUP BY u.id
       ORDER BY u.is_active DESC, u.last_name, u.first_name`
    );

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

export const createUser = async (req, res, next) => {
  try {
    const { phone, password, first_name, last_name, patronymic, roles, employee_permissions } = req.body;

    if (!phone) {
      throw new AppError(400, 'Phone is required');
    }

    const passwordHash = await bcrypt.hash(password || 'default123', 10);
    const defaultPerms = {
      can_manage_bookings: false, can_manage_cash: false,
      can_manage_services: false, can_view_reports: false,
      can_manage_schedule: false, can_manage_employees: false,
      can_do_washing: false
    };

    const userRoles = roles || ['client'];
    const effectivePermissions = userRoles.includes('admin')
      ? { ...(employee_permissions || defaultPerms), can_do_washing: false }
      : (employee_permissions || defaultPerms);

    const newUser = await withTransaction(async (client) => {
      const userResult = await client.query(
        `INSERT INTO users (last_name, first_name, patronymic, phone, password, employee_permissions)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [last_name || 'Пользователь', first_name || 'Новый', patronymic || null,
         phone, passwordHash, JSON.stringify(effectivePermissions)]
      );

      const userId = userResult.rows[0].id;

      for (const roleName of userRoles) {
        await client.query(
          `INSERT INTO user_roles (user_id, role_id)
           SELECT $1, id FROM roles WHERE role_name = $2
           ON CONFLICT DO NOTHING`,
          [userId, roleName]
        );
      }

      await writeAuditLog(client, {
        userId: req.user.id,
        actionType: 'create_user',
        target: `user:${userId}`,
        result: true
      });

      const finalResult = await client.query(
        `SELECT u.id, u.last_name, u.first_name, u.patronymic, u.phone, u.email,
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
      const userCheck = await client.query(
        `SELECT u.id,
                EXISTS (
                  SELECT 1
                  FROM user_roles ur
                  JOIN roles r ON r.id = ur.role_id
                  WHERE ur.user_id = u.id AND r.role_name = 'admin'
                ) AS is_admin
         FROM users u
         WHERE u.id = $1`,
        [id]
      );
      if (!userCheck.rowCount) throw new AppError(404, 'User not found');

      const safePerms = userCheck.rows[0].is_admin && perms?.can_do_washing
        ? { ...perms, can_do_washing: false }
        : perms;

      await client.query(
        `UPDATE users
         SET employee_permissions = employee_permissions || COALESCE($1::jsonb, '{}'::jsonb),
             is_active = COALESCE($2, is_active)
         WHERE id = $3`,
        [safePerms ? JSON.stringify(safePerms) : null, is_active ?? null, id]
      );

      await writeAuditLog(client, {
        userId: req.user.id,
        actionType: 'update_user_permissions',
        target: `user:${id}`,
        result: true
      });

      const finalResult = await client.query(
        `SELECT u.id, u.last_name, u.first_name, u.patronymic, u.phone, u.email,
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

      if (roles.includes('admin')) {
        await client.query(
          `UPDATE users
           SET employee_permissions = employee_permissions || '{"can_do_washing": false}'::jsonb
           WHERE id = $1`,
          [id]
        );
      }

      await writeAuditLog(client, {
        userId: req.user.id,
        actionType: 'update_user_roles',
        target: `user:${id}:${roles.join(',')}`,
        result: true
      });

      const finalResult = await client.query(
        `SELECT u.id, u.last_name, u.first_name, u.patronymic, u.phone, u.email,
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
export const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    await withTransaction(async (client) => {
      const userCheck = await client.query('SELECT id FROM users WHERE id = $1', [id]);
      if (!userCheck.rowCount) throw new AppError(404, 'User not found');

      // Due to ON DELETE CASCADE in user_roles and other tables,
      // deleting user will automatically cleanup roles.
      await client.query('DELETE FROM users WHERE id = $1', [id]);

      await writeAuditLog(client, {
        userId: req.user.id,
        actionType: 'delete_user',
        target: `user:${id}`,
        result: true
      });
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
