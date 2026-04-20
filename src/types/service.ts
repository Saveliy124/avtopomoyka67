export interface Service {
  id: number;
  service_name: string;
  price: number;
  duration_minutes: number;
  wash_type: 'manual' | 'robot';
}

export interface ExtraService {
  id: number;
  service_name: string;
  price: number;
  duration_minutes: number;
}
