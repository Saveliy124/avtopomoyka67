import { useQuery } from '@tanstack/react-query';
import { reportApi } from '@/api/report.api';
import { formatPrice } from '@/utils/format';
import { Card, CardContent } from '@/components/ui/card';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import { TrendingUp, Users, CalendarCheck, Briefcase, BarChart3, Percent } from 'lucide-react';

export function ReportsPanel() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: reportApi.getDashboard,
  });

  if (isLoading) return <PageLoader />;
  if (!stats) return <p className="text-gray-400">Нет данных</p>;

  const cards = [
    { icon: CalendarCheck, label: 'Всего записей', value: stats.total_bookings, color: 'blue' },
    { icon: Users, label: 'Оставшиеся записи', value: stats.confirmed_bookings, color: 'green' },
    { icon: TrendingUp, label: 'Завершённых', value: stats.completed_bookings, color: 'emerald' },
    { icon: Briefcase, label: 'Общая выручка', value: formatPrice(stats.total_revenue), color: 'violet' },
    { icon: BarChart3, label: 'Записей сегодня', value: stats.today_bookings, color: 'orange' },
    { icon: Percent, label: 'Загруженность', value: `${stats.occupancy_rate ?? 0}%`, color: 'pink' },
  ];

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    violet: 'bg-violet-50 text-violet-700 border-violet-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
    pink: 'bg-pink-50 text-pink-700 border-pink-200',
  };

  const iconColorMap: Record<string, string> = {
    blue: 'text-blue-500',
    green: 'text-green-500',
    emerald: 'text-emerald-500',
    violet: 'text-violet-500',
    orange: 'text-orange-500',
    pink: 'text-pink-500',
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Отчётность</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(({ icon: Icon, label, value, color }) => (
          <Card key={label} className={`border ${colorMap[color]}`}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
                <Icon className={`h-6 w-6 ${iconColorMap[color]}`} />
              </div>
              <div>
                <p className="text-sm opacity-80">{label}</p>
                <p className="text-2xl font-bold">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
