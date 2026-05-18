export interface AuditLog {
  id: number;
  user_id: number | null;
  action_time: string;
  action_type: string;
  target: string | null;
  result: boolean;
  user_name: string | null;
  user_roles: string[];
}
