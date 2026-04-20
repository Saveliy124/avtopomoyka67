import { query } from '../db/query.js';

export const getOperations = async (_req, res, next) => {
  try {
    const result = await query('SELECT * FROM cash_operations ORDER BY date DESC');
    const ops = result.rows.map(o => ({ ...o, amount: Number(o.amount) }));
    res.json(ops);
  } catch (error) {
    next(error);
  }
};

export const createOperation = async (req, res, next) => {
  try {
    const { type, amount, description, user_id } = req.body;

    const result = await query(
      `INSERT INTO cash_operations (type, amount, description, user_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [type, amount, description, user_id || req.user?.id || null]
    );

    const op = { ...result.rows[0], amount: Number(result.rows[0].amount) };
    res.status(201).json(op);
  } catch (error) {
    next(error);
  }
};
