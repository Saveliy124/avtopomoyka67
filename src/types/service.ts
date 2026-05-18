export interface Service {
  id: number;
  service_name: string;
  price: number;
  duration_minutes: number;
  wash_type: 'manual' | 'robot';
  description?: string | null;
}

export interface ExtraService {
  id: number;
  service_name: string;
  price: number;
  duration_minutes: number;
  description?: string | null;
}
