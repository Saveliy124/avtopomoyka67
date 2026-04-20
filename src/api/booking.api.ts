import api from './axios';
import type { Booking, BookingStatus } from '@/types';

interface CreateBookingPayload {
  schedule_id: number;
  service_id: number;
  car_info?: string;
  client_id?: number;
  appointment_time?: string;
  box_id?: number;
  extra_services?: any[];
}

export const bookingApi = {
  getMyBookings: () => api.get<Booking[]>('/bookings').then((r) => r.data),

  createBooking: (data: CreateBookingPayload) =>
    api.post<Booking>('/bookings', data).then((r) => r.data),

  cancelBooking: (id: number) =>
    api.patch<Booking>(`/bookings/${id}/cancel`).then((r) => r.data),

  updateBookingStatus: (id: number, status: BookingStatus) =>
    api.patch<Booking>(`/bookings/${id}/status`, { status }).then((r) => r.data),

  payBooking: (id: number) =>
    api.patch<Booking>(`/bookings/${id}/pay`).then((r) => r.data),

  adminCreateBooking: (data: any) =>
    api.post<Booking>('/bookings', data).then((r) => r.data),

  generateTestBookings: (data: { date: string; load_percentage: number; box_id: number }) =>
    api.post('/tests/generate-bookings', data).then((r) => r.data),
};
