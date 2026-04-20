export const PERMISSIONS = {
  MANAGE_BOOKINGS: 'can_manage_bookings',
  MANAGE_CASH: 'can_manage_cash',
  MANAGE_SERVICES: 'can_manage_services',
  VIEW_REPORTS: 'can_view_reports',
  MANAGE_SCHEDULE: 'can_manage_schedule',
  MANAGE_EMPLOYEES: 'can_manage_employees',
  DO_WASHING: 'can_do_washing'
};

export const hasRole = (user, role) => {
  return Boolean(user?.roles?.includes(role));
};

export const hasPermission = (user, permission) => {
  if (!user) return false;
  if (hasRole(user, 'admin')) return true;
  if (!hasRole(user, 'employee')) return false;
  return Boolean(user.employee_permissions?.[permission]);
};
