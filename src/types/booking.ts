export type BookingStatus = 'confirmed' | 'in_progress' | 'completed' | 'cancelled';

export interface Booking {
  id: number;
  user_id: number;
  service_id: number;
  schedule_id: number;
  box_id: number | null;
  car_info: string | null;
  status: BookingStatus;
  created_at: string;
  actual_arrival: boolean | null;
  appointment_time: string;
  box_number: string;
  service_name: string;
  price: number;
  duration_minutes: number;
  client_name: string;
  extra_services?: any[];
  is_paid?: boolean;
}
