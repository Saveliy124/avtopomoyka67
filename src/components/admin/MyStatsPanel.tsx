import { useQuery } from '@tanstack/react-query';
import { Activity, CheckCircle2, Clock3, ListChecks } from 'lucide-react';
import { reportApi } from '@/api/report.api';
import { Card, CardContent } from '@/components/ui/card';
import { PageLoader } from '@/components/shared/LoadingSpinner';

const ACTION_LABELS: Record<string, string> = {
  create_booking: 'Создание записи',
  cancel_booking: 'Отмена записи',
  update_booking_status: 'Смена статуса записи',
  pay_booking: 'Оплата записи',
  create_cash_operation: 'Операция по кассе',
  enable_slot_maintenance: 'Включение тех. работ',
  disable_slot_maintenance: 'Отключение тех. работ',
};

export function MyStatsPanel() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['my-stats'],
    queryFn: reportApi.getMyStats,
  });

  if (isLoading) return <PageLoader />;
  if (!stats) return <p className="text-gray-400">Нет данных</p>;

  const cards = [
    { icon: CheckCircle2, label: 'Завершено моек', value: stats.completed_washes, tone: 'emerald' },
    { icon: Clock3, label: 'Начато работ', value: stats.started_washes, tone: 'amber' },
    { icon: Activity, label: 'Действий сегодня', value: stats.today_actions, tone: 'blue' },
    { icon: ListChecks, label: 'Всего действий', value: stats.total_actions, tone: 'slate' },
  ];

  const toneMap: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    slate: 'bg-slate-50 text-slate-700 border-slate-200',
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Моя статистика</h2>
        <p className="text-sm text-gray-500 mt-1">Рабочие действия и последние изменения по записям</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ icon: Icon, label, value, tone }) => (
          <Card key={label} className={`border ${toneMap[tone]}`}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className={`h-11 w-11 rounded-lg flex items-center justify-center ${toneMap[tone]}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm opacity-80">{label}</p>
                <p className="text-2xl font-bold">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0 divide-y">
          {stats.latest_actions.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Действий пока нет</p>
          ) : (
            stats.latest_actions.map((action) => (
              <div key={action.id} className="grid grid-cols-1 sm:grid-cols-[160px_1fr_100px] gap-3 p-4 items-center">
                <div>
                  <p className="font-semibold text-slate-800">
                    {new Date(action.action_time).toLocaleDateString('ru-RU')}
                  </p>
                  <p className="text-xs text-slate-500">
                    {new Date(action.action_time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-gray-900">{ACTION_LABELS[action.action_type] || action.action_type}</p>
                  <p className="text-xs text-gray-500">{action.target || 'Без объекта'}</p>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full w-fit ${
                  action.result ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                }`}>
                  {action.result ? 'Успешно' : 'Ошибка'}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
