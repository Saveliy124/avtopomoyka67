import api from './axios';
import type { Slot } from '@/types';

export const slotApi = {
  getSlots: (params: { date: string; boxId?: number; washType?: string }) =>
    api
      .get<Slot[]>('/slots', {
        params: {
          date: params.date,
          ...(params.boxId ? { boxId: params.boxId } : {}),
          ...(params.washType ? { washType: params.washType } : {}),
        },
      })
      .then((r) => r.data),

  createSlot: (data: { appointment_time: string; box_id: number }) =>
    api.post<Slot>('/slots', data).then((r) => r.data),

  generateSlots: (data: { box_id: number; date: string }) =>
    api.post<Slot[]>('/slots/generate', data).then((r) => r.data),

  generateDaySlots: (data: { date: string; startHour?: number; endHour?: number }) =>
    api.post<{ boxes_count: number; slots_created: number }>('/slots/generate-day', data).then((r) => r.data),

  bulkUpdateStatus: (data: { ids: number[]; is_maintenance: boolean }) =>
    api.patch<Slot[]>('/slots/bulk-status', data).then((r) => r.data),
};
