import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, CheckCircle2, XCircle } from 'lucide-react';
import { auditApi } from '@/api/audit.api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/shared/LoadingSpinner';

const ACTION_LABELS: Record<string, string> = {
  create_booking: 'Создание записи',
  cancel_booking: 'Отмена записи',
  update_booking_status: 'Смена статуса записи',
  pay_booking: 'Оплата записи',
  create_user: 'Создание пользователя',
  update_user_permissions: 'Изменение прав',
  update_user_roles: 'Изменение роли',
  delete_user: 'Удаление пользователя',
  create_box: 'Создание бокса',
  update_box: 'Изменение бокса',
  delete_box: 'Удаление бокса',
  force_delete_box: 'Удаление бокса с отменой записей',
  create_service: 'Создание услуги',
  update_service: 'Изменение услуги',
  delete_service: 'Удаление услуги',
  create_extra_service: 'Создание доп. услуги',
  update_extra_service: 'Изменение доп. услуги',
  delete_extra_service: 'Удаление доп. услуги',
  create_cash_operation: 'Операция по кассе',
  enable_slot_maintenance: 'Включение тех. работ',
  disable_slot_maintenance: 'Отключение тех. работ',
  create_slot: 'Создание слота',
  generate_slots: 'Генерация слотов',
  generate_day_slots: 'Генерация расписания',
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'Админ',
  employee: 'Сотрудник',
  client: 'Клиент',
};

const PAGE_SIZE = 100;

export function AuditPanel() {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => auditApi.getLogs(300),
  });

  if (isLoading) return <PageLoader />;

  const visibleLogs = logs?.slice(0, visibleCount) ?? [];
  const hasMore = (logs?.length ?? 0) > visibleCount;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-2">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Журнал действий</h2>
          <p className="text-sm text-gray-500">
            Показано {visibleLogs.length} из {logs?.length ?? 0} последних действий
          </p>
        </div>
        <div className="h-10 w-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
          <Activity className="h-5 w-5" />
        </div>
      </div>

      {!logs?.length ? (
        <p className="text-gray-400 text-sm text-center py-10">Действий пока нет</p>
      ) : (
        <>
          <Card>
            <CardContent className="p-0 divide-y">
              {visibleLogs.map((log) => {
                const roles = log.user_roles?.map((r) => ROLE_LABELS[r] || r).join(', ');
                return (
                  <div key={log.id} className="grid grid-cols-1 md:grid-cols-[180px_1fr_220px_120px] gap-3 p-4 items-center">
                    <div className="text-sm">
                      <p className="font-semibold text-slate-800">
                        {new Date(log.action_time).toLocaleDateString('ru-RU')}
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Date(log.action_time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>

                    <div>
                      <p className="font-semibold text-gray-900">{ACTION_LABELS[log.action_type] || log.action_type}</p>
                      <p className="text-xs text-gray-500 break-all">{log.target || 'Без объекта'}</p>
                    </div>

                    <div className="text-sm">
                      <p className="font-medium text-slate-800">{log.user_name || 'Система'}</p>
                      <p className="text-xs text-slate-500">{roles || 'Без роли'}</p>
                    </div>

                    <div className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full w-fit ${
                      log.result ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {log.result ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                      {log.result ? 'Успешно' : 'Ошибка'}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              >
                Показать ещё ({Math.min(PAGE_SIZE, (logs?.length ?? 0) - visibleCount)})
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
