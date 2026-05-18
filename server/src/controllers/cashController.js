import { query, withTransaction } from '../db/query.js';
import { writeAuditLog } from '../services/auditService.js';

export const getOperations = async (_req, res, next) => {
  try {
    const result = await query('SELECT * FROM cash_operations ORDER BY date DESC');
    const ops = result.rows.map(o => ({ ...o, amount: Number(o.amount) }));
    res.json(ops);
  } catch (error) {
    next(error);
  }
};

export const resetTodayOperations = async (req, res, next) => {
  try {
    const result = await withTransaction(async (client) => {
      const deleteResult = await client.query(
        `DELETE FROM cash_operations
         WHERE DATE(date AT TIME ZONE 'Europe/Moscow') = CURRENT_DATE AT TIME ZONE 'Europe/Moscow'
         RETURNING id`
      );

      await writeAuditLog(client, {
        userId: req.user.id,
        actionType: 'reset_cash_day',
        target: `cash_operations:${deleteResult.rowCount}`,
        result: true
      });

      return { deleted_count: deleteResult.rowCount };
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const createOperation = async (req, res, next) => {
  try {
    const { type, amount, description, user_id } = req.body;

    const op = await withTransaction(async (client) => {
      const result = await client.query(
        `INSERT INTO cash_operations (type, amount, description, user_id)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [type, amount, description, user_id || req.user?.id || null]
      );

      await writeAuditLog(client, {
        userId: req.user.id,
        actionType: 'create_cash_operation',
        target: `cash_operation:${result.rows[0].id}:${type}:${amount}`,
        result: true
      });

      return { ...result.rows[0], amount: Number(result.rows[0].amount) };
    });
    res.status(201).json(op);
  } catch (error) {
    next(error);
  }
};
