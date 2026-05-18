import { query } from '../db/query.js';
import { getAuditLogs } from '../services/auditService.js';

export const listAuditLogs = async (req, res, next) => {
  try {
    const logs = await getAuditLogs({ query }, { limit: req.query.limit });
    res.json(logs);
  } catch (error) {
    next(error);
  }
};
