export interface Slot {
  id: number;
  appointment_time: string;
  is_available: boolean;
  is_maintenance: boolean;
  has_booking?: boolean;
  box_id: number;
}
