import { query, withTransaction } from '../db/query.js';
import { AppError } from '../utils/errors.js';
import { writeAuditLog } from '../services/auditService.js';

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
    const { service_name, price, duration_minutes, description } = req.body;

    const svc = await withTransaction(async (client) => {
      const result = await client.query(
        `INSERT INTO extra_services (service_name, price, duration_minutes, description)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [service_name, price, duration_minutes, description ?? null]
      );

      await writeAuditLog(client, {
        userId: req.user.id,
        actionType: 'create_extra_service',
        target: `extra_service:${result.rows[0].id}`,
        result: true
      });

      return { ...result.rows[0], price: Number(result.rows[0].price) };
    });
    res.status(201).json(svc);
  } catch (error) {
    next(error);
  }
};

export const updateExtraService = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { service_name, price, duration_minutes, description } = req.body;

    const svc = await withTransaction(async (client) => {
      const result = await client.query(
        `UPDATE extra_services
         SET service_name = COALESCE($1, service_name),
             price = COALESCE($2, price),
             duration_minutes = COALESCE($3, duration_minutes),
             description = COALESCE($4, description)
         WHERE id = $5
         RETURNING *`,
        [service_name ?? null, price ?? null, duration_minutes ?? null, description ?? null, id]
      );

      if (!result.rowCount) throw new AppError(404, 'Extra service not found');

      await writeAuditLog(client, {
        userId: req.user.id,
        actionType: 'update_extra_service',
        target: `extra_service:${id}`,
        result: true
      });

      return { ...result.rows[0], price: Number(result.rows[0].price) };
    });
    res.json(svc);
  } catch (error) {
    next(error);
  }
};

export const deleteExtraService = async (req, res, next) => {
  try {
    const { id } = req.params;
    await withTransaction(async (client) => {
      const result = await client.query('DELETE FROM extra_services WHERE id = $1 RETURNING id', [id]);
      if (!result.rowCount) throw new AppError(404, 'Extra service not found');

      await writeAuditLog(client, {
        userId: req.user.id,
        actionType: 'delete_extra_service',
        target: `extra_service:${id}`,
        result: true
      });
    });
    res.json({ success: true, id: Number(id) });
  } catch (error) {
    next(error);
  }
};
