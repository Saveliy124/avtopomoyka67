import api from './axios';
import type { DashboardStats, AiPrediction } from '@/types';

export const reportApi = {
  getDashboard: () => api.get<DashboardStats>('/reports/dashboard').then((r) => r.data),

  getPredictions: () => api.get<AiPrediction[]>('/reports/predictions').then((r) => r.data),
};
