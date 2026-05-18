import type { User, EmployeePermissions } from '@/types';

export type PermissionKey = keyof EmployeePermissions;

export const PERMISSIONS: Record<PermissionKey, PermissionKey> = {
  can_manage_bookings: 'can_manage_bookings',
  can_manage_cash: 'can_manage_cash',
  can_manage_services: 'can_manage_services',
  can_view_reports: 'can_view_reports',
  can_manage_schedule: 'can_manage_schedule',
  can_manage_employees: 'can_manage_employees',
  can_do_washing: 'can_do_washing',
};

export function hasRole(user: User | null, role: string): boolean {
  if (!user) return false;
  return user.roles.includes(role);
}

export function isAdmin(user: User | null): boolean {
  return hasRole(user, 'admin');
}

export function hasPermission(user: User | null, permission: PermissionKey): boolean {
  if (!user) return false;
  if (isAdmin(user)) return true;
  return user.employee_permissions?.[permission] === true;
}
