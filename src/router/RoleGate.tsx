import { useAuthStore } from '@/store/auth.store';
import { hasRole } from '@/utils/permissions';

interface Props {
  roles: string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RoleGate({ roles, children, fallback = null }: Props) {
  const user = useAuthStore((s) => s.user);
  const allowed = roles.some((r) => hasRole(user, r));
  return allowed ? <>{children}</> : <>{fallback}</>;
}
