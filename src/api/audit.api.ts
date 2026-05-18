import api from './axios';
import type { AuditLog } from '@/types';

export const auditApi = {
  getLogs: (limit = 100) =>
    api.get<AuditLog[]>('/audit', { params: { limit } }).then((r) => r.data),
};
