import api from './axios';
import type { DashboardStats, AiPredictionResponse, MyStats } from '@/types';

export const reportApi = {
  getDashboard: () => api.get<DashboardStats>('/reports/dashboard').then((r) => r.data),

  getMyStats: () => api.get<MyStats>('/reports/my-stats').then((r) => r.data),

  getPredictions: (refresh = false) =>
    api.get<AiPredictionResponse>('/reports/predictions', { params: refresh ? { refresh: 'true' } : undefined }).then((r) => r.data),
};
