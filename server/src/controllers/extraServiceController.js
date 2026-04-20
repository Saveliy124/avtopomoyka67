import { query } from '../db/query.js';
import { AppError } from '../utils/errors.js';

export const getExtraServices = async (_req, res, next) => {
  try {
    const result = await query('SELECT * FROM extra_services ORDER BY id');
    const services = result.rows.map(s => ({ ...s, price: Number(s.price) }));
    res.json(services);
  } catch (error) {
    next(error);
  }
};

export const createExtraService = async (req, res, next) => {
  try {
    const { service_name, price, duration_minutes } = req.body;

    const result = await query(
      `INSERT INTO extra_services (service_name, price, duration_minutes)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [service_name, price, duration_minutes]
    );

    const svc = { ...result.rows[0], price: Number(result.rows[0].price) };
    res.status(201).json(svc);
  } catch (error) {
    next(error);
  }
};

export const updateExtraService = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { service_name, price, duration_minutes } = req.body;

    const result = await query(
      `UPDATE extra_services
       SET service_name = COALESCE($1, service_name),
           price = COALESCE($2, price),
           duration_minutes = COALESCE($3, duration_minutes)
       WHERE id = $4
       RETURNING *`,
      [service_name ?? null, price ?? null, duration_minutes ?? null, id]
    );

    if (!result.rowCount) throw new AppError(404, 'Extra service not found');
    const svc = { ...result.rows[0], price: Number(result.rows[0].price) };
    res.json(svc);
  } catch (error) {
    next(error);
  }
};
