import { query } from '../db/query.js';
import { AppError } from '../utils/errors.js';

export const getBoxes = async (req, res, next) => {
  try {
    const { wash_type } = req.query;
    let result;

    if (wash_type) {
      result = await query('SELECT * FROM boxes WHERE wash_type = $1 ORDER BY id', [wash_type]);
    } else {
      result = await query('SELECT * FROM boxes ORDER BY id');
    }

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

export const createBox = async (req, res, next) => {
  try {
    const { box_number, is_active, wash_type } = req.body;

    const result = await query(
      `INSERT INTO boxes (box_number, is_active, wash_type)
       VALUES ($1, COALESCE($2, TRUE), COALESCE($3, 'manual'))
       RETURNING *`,
      [box_number, is_active, wash_type]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

export const updateBox = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { box_number, is_active, wash_type } = req.body;

    const result = await query(
      `UPDATE boxes
       SET box_number = COALESCE($1, box_number),
           is_active = COALESCE($2, is_active),
           wash_type = COALESCE($3, wash_type)
       WHERE id = $4
       RETURNING *`,
      [box_number ?? null, is_active ?? null, wash_type ?? null, id]
    );

    if (!result.rowCount) throw new AppError(404, 'Box not found');
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

export const deleteBox = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query('DELETE FROM boxes WHERE id = $1 RETURNING *', [id]);

    if (!result.rowCount) throw new AppError(404, 'Box not found');
    res.json({ message: 'Box deleted successfully' });
  } catch (error) {
    next(error);
  }
};
