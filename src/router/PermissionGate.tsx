import { useAuthStore } from '@/store/auth.store';
import { hasPermission, type PermissionKey } from '@/utils/permissions';

interface Props {
  permission: PermissionKey;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function PermissionGate({ permission, children, fallback = null }: Props) {
  const user = useAuthStore((s) => s.user);
  return hasPermission(user, permission) ? <>{children}</> : <>{fallback}</>;
}
