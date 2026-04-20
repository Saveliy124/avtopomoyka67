import { query } from '../db/query.js';
import { AppError } from '../utils/errors.js';

export const getServices = async (_req, res, next) => {
  try {
    const result = await query('SELECT * FROM services ORDER BY id');
    const services = result.rows.map(s => ({ ...s, price: Number(s.price) }));
    res.json(services);
  } catch (error) {
    next(error);
  }
};

export const createService = async (req, res, next) => {
  try {
    const { service_name, price, duration_minutes, wash_type } = req.body;

    const result = await query(
      `INSERT INTO services (service_name, price, duration_minutes, wash_type)
       VALUES ($1, $2, $3, COALESCE($4, 'manual'))
       RETURNING *`,
      [service_name, price, duration_minutes, wash_type]
    );

    const svc = { ...result.rows[0], price: Number(result.rows[0].price) };
    res.status(201).json(svc);
  } catch (error) {
    next(error);
  }
};

export const updateService = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { service_name, price, duration_minutes, wash_type } = req.body;

    const result = await query(
      `UPDATE services
       SET service_name = COALESCE($1, service_name),
           price = COALESCE($2, price),
           duration_minutes = COALESCE($3, duration_minutes),
           wash_type = COALESCE($4, wash_type)
       WHERE id = $5
       RETURNING *`,
      [service_name ?? null, price ?? null, duration_minutes ?? null, wash_type ?? null, id]
    );

    if (!result.rowCount) throw new AppError(404, 'Service not found');
    const svc = { ...result.rows[0], price: Number(result.rows[0].price) };
    res.json(svc);
  } catch (error) {
    next(error);
  }
};
