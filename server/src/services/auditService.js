export const writeAuditLog = async (client, {
  userId = null,
  actionType,
  target,
  result = true
}) => {
  await client.query(
    `INSERT INTO audit_log (user_id, action_type, target, result)
     VALUES ($1, $2, $3, $4)`,
    [userId, actionType, target, result]
  );
};

export const getAuditLogs = async (client, { limit = 100 } = {}) => {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 300));

  const result = await client.query(
    `SELECT al.id,
            al.user_id,
            al.action_time,
            al.action_type,
            al.target,
            al.result,
            CONCAT_WS(' ', u.last_name, u.first_name, u.patronymic) AS user_name,
            COALESCE(
              ARRAY_AGG(r.role_name) FILTER (WHERE r.role_name IS NOT NULL),
              ARRAY[]::text[]
            ) AS user_roles
     FROM audit_log al
     LEFT JOIN users u ON u.id = al.user_id
     LEFT JOIN user_roles ur ON ur.user_id = u.id
     LEFT JOIN roles r ON r.id = ur.role_id
     GROUP BY al.id, u.id
     ORDER BY al.action_time DESC
     LIMIT $1`,
    [safeLimit]
  );

  return result.rows;
};
