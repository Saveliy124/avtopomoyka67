import api from './axios';
import type { Slot } from '@/types';

export const slotApi = {
  getSlots: (params: { date: string; boxId: number }) =>
    api
      .get<Slot[]>('/slots', { params: { date: params.date, boxId: params.boxId } })
      .then((r) => r.data),

  createSlot: (data: { appointment_time: string; box_id: number }) =>
    api.post<Slot>('/slots', data).then((r) => r.data),

  generateSlots: (data: { box_id: number; date: string }) =>
    api.post<Slot[]>('/slots/generate', data).then((r) => r.data),
};
