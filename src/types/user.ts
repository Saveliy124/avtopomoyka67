export interface EmployeePermissions {
  can_manage_bookings: boolean;
  can_manage_cash: boolean;
  can_manage_services: boolean;
  can_view_reports: boolean;
  can_manage_schedule: boolean;
  can_manage_employees: boolean;
  can_do_washing: boolean;
  can_view_ai_audit?: boolean;
}

export interface User {
  id: number;
  last_name: string;
  first_name: string;
  patronymic: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  registration_date: string;
  employee_permissions: EmployeePermissions;
  roles: string[];
  total_actions?: number;
  completed_washes?: number;
  started_washes?: number;
  today_actions?: number;
}
