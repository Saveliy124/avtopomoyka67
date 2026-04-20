export interface DashboardStats {
  total_bookings: number;
  confirmed_bookings: number;
  completed_bookings: number;
  cancelled_bookings: number;
  total_revenue: number;
  today_bookings: number;
  occupancy_rate?: number;
}

export interface AiPrediction {
  schedule_id: number;
  appointment_time: string;
  predicted_occupancy: number;
  confidence: number;
  box_id: number;
}
