import api from './axios';
import type { Service, ExtraService } from '@/types';

interface ServicePayload {
  service_name: string;
  price: number;
  duration_minutes: number;
  wash_type: 'manual' | 'robot' | 'extra';
}

export const serviceApi = {
  getServices: () => api.get<Service[]>('/services').then((r) => r.data),

  getExtraServices: () => api.get<ExtraService[]>('/extra-services').then((r) => r.data),

  createService: (data: ServicePayload) =>
    api.post<Service>('/services', data).then((r) => r.data),

  updateService: (id: number, data: Partial<ServicePayload>) =>
    api.patch<Service>(`/services/${id}`, data).then((r) => r.data),
};
