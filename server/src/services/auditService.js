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
