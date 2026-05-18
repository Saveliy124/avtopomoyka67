export interface DashboardStats {
  total_bookings: number;
  confirmed_bookings: number;
  completed_bookings: number;
  cancelled_bookings: number;
  total_revenue: number;
  today_bookings: number;
  occupancy_rate: number;
}

export interface MyStatsAction {
  id: number;
  action_time: string;
  action_type: string;
  target: string | null;
  result: boolean;
}

export interface MyStats {
  total_actions: number;
  completed_washes: number;
  started_washes: number;
  today_actions: number;
  latest_actions: MyStatsAction[];
}

export interface AiPredictionPoint {
  label: string;
  manual: number;
  robot: number;
}

export interface AiPredictionResponse {
  model: string;
  trained_on_points?: number;
  window_size?: number;
  hourly: AiPredictionPoint[];
  weekdays: AiPredictionPoint[];
}
