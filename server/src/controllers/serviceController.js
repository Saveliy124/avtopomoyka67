import { query, withTransaction } from '../db/query.js';
import { AppError } from '../utils/errors.js';
import { writeAuditLog } from '../services/auditService.js';

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
    const { service_name, price, duration_minutes, wash_type, description } = req.body;

    const svc = await withTransaction(async (client) => {
      const result = await client.query(
        `INSERT INTO services (service_name, price, duration_minutes, wash_type, description)
         VALUES ($1, $2, $3, COALESCE($4, 'manual'), $5)
         RETURNING *`,
        [service_name, price, duration_minutes, wash_type, description ?? null]
      );

      await writeAuditLog(client, {
        userId: req.user.id,
        actionType: 'create_service',
        target: `service:${result.rows[0].id}`,
        result: true
      });

      return { ...result.rows[0], price: Number(result.rows[0].price) };
    });
    res.status(201).json(svc);
  } catch (error) {
    next(error);
  }
};

export const updateService = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { service_name, price, duration_minutes, wash_type, description } = req.body;

    const svc = await withTransaction(async (client) => {
      const result = await client.query(
        `UPDATE services
         SET service_name = COALESCE($1, service_name),
             price = COALESCE($2, price),
             duration_minutes = COALESCE($3, duration_minutes),
             wash_type = COALESCE($4, wash_type),
             description = COALESCE($5, description)
         WHERE id = $6
         RETURNING *`,
        [service_name ?? null, price ?? null, duration_minutes ?? null, wash_type ?? null, description ?? null, id]
      );

      if (!result.rowCount) throw new AppError(404, 'Service not found');

      await writeAuditLog(client, {
        userId: req.user.id,
        actionType: 'update_service',
        target: `service:${id}`,
        result: true
      });

      return { ...result.rows[0], price: Number(result.rows[0].price) };
    });
    res.json(svc);
  } catch (error) {
    next(error);
  }
};

export const deleteService = async (req, res, next) => {
  try {
    const { id } = req.params;
    await withTransaction(async (client) => {
      const result = await client.query('DELETE FROM services WHERE id = $1 RETURNING id', [id]);
      if (!result.rowCount) throw new AppError(404, 'Service not found');

      await writeAuditLog(client, {
        userId: req.user.id,
        actionType: 'delete_service',
        target: `service:${id}`,
        result: true
      });
    });
    res.json({ success: true, id: Number(id) });
  } catch (error) {
    next(error);
  }
};
