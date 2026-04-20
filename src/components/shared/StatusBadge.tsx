import { Badge } from '@/components/ui/badge';
import type { BookingStatus } from '@/types';

const statusMap: Record<BookingStatus, { label: string; variant: 'default' | 'warning' | 'success' | 'muted' }> = {
  confirmed: { label: 'Подтверждено', variant: 'default' },
  in_progress: { label: 'В процессе', variant: 'warning' },
  completed: { label: 'Завершено', variant: 'success' },
  cancelled: { label: 'Отменено', variant: 'muted' },
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  const { label, variant } = statusMap[status];
  return <Badge variant={variant}>{label}</Badge>;
}
