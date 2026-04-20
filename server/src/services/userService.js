import { query } from '../db/query.js';

const USER_SELECT = `
  SELECT
    u.id,
    u.last_name,
    u.first_name,
    u.patronymic,
    u.email,
    u.password,
    u.is_active,
    u.registration_date,
    u.employee_permissions,
    COALESCE(
      ARRAY_AGG(r.role_name) FILTER (WHERE r.role_name IS NOT NULL),
      ARRAY[]::text[]
    ) AS roles
  FROM users u
  LEFT JOIN user_roles ur ON ur.user_id = u.id
  LEFT JOIN roles r ON r.id = ur.role_id
`;

export const getUserById = async (id) => {
  const result = await query(
    `${USER_SELECT}
     WHERE u.id = $1
     GROUP BY u.id`,
    [id]
  );

  return result.rows[0] || null;
};

export const getUserByEmail = async (email) => {
  const result = await query(
    `${USER_SELECT}
     WHERE u.email = $1
     GROUP BY u.id`,
    [email]
  );

  return result.rows[0] || null;
};

export const toPublicUser = (user) => {
  if (!user) return null;

  const { password, ...publicUser } = user;
  return publicUser;
};
