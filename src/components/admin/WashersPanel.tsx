import { useQuery } from '@tanstack/react-query';
import { Activity, CheckCircle2, Clock3, Phone, UserRoundCheck } from 'lucide-react';
import { userApi } from '@/api/user.api';
import { Card, CardContent } from '@/components/ui/card';
import { PageLoader } from '@/components/shared/LoadingSpinner';

export function WashersPanel() {
  const { data: washers, isLoading } = useQuery({
    queryKey: ['washers'],
    queryFn: userApi.getWashers,
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Сотрудники</h2>
        <p className="text-sm text-gray-500 mt-1">Мойщики и их рабочая статистика</p>
      </div>

      {!washers?.length ? (
        <p className="text-gray-400 text-sm text-center py-10">Мойщики не найдены</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {washers.map((washer) => {
            const name = [washer.last_name, washer.first_name, washer.patronymic].filter(Boolean).join(' ');

            return (
              <Card key={washer.id} className="border-slate-200">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                        <UserRoundCheck className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{name || 'Сотрудник'}</p>
                        <p className="text-xs text-gray-500">{washer.email || 'Email не указан'}</p>
                      </div>
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      washer.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {washer.is_active ? 'Активен' : 'Отключен'}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-full">Мойщик</span>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Phone className="h-4 w-4 text-slate-400" />
                    <span>{washer.phone || 'Телефон не указан'}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                    <div className="rounded-lg bg-emerald-50 text-emerald-700 p-2">
                      <CheckCircle2 className="h-4 w-4 mb-1" />
                      <p className="text-lg font-bold">{washer.completed_washes ?? 0}</p>
                      <p className="text-[11px]">Завершено</p>
                    </div>
                    <div className="rounded-lg bg-amber-50 text-amber-700 p-2">
                      <Clock3 className="h-4 w-4 mb-1" />
                      <p className="text-lg font-bold">{washer.started_washes ?? 0}</p>
                      <p className="text-[11px]">Начато</p>
                    </div>
                    <div className="rounded-lg bg-blue-50 text-blue-700 p-2">
                      <Activity className="h-4 w-4 mb-1" />
                      <p className="text-lg font-bold">{washer.today_actions ?? 0}</p>
                      <p className="text-[11px]">Сегодня</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
