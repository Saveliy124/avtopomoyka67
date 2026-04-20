import api from './axios';
import type { Box } from '@/types';

export const boxApi = {
  getBoxes: (washType?: string) =>
    api.get<Box[]>('/boxes', { params: washType ? { wash_type: washType } : {} }).then((r) => r.data),

  createBox: (data: { box_number: string; wash_type: string }) =>
    api.post<Box>('/boxes', data).then((r) => r.data),

  updateBox: (id: number, data: Partial<{ box_number: string; is_active: boolean; wash_type: string }>) =>
    api.patch<Box>(`/boxes/${id}`, data).then((r) => r.data),

  deleteBox: (id: number) =>
    api.delete(`/boxes/${id}`).then((r) => r.data),
};
