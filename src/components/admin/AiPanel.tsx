import { useQuery } from '@tanstack/react-query';
import { reportApi } from '@/api/report.api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import { Brain, AlertTriangle } from 'lucide-react';

export function AiPanel() {
  const { data: predictions, isLoading } = useQuery({
    queryKey: ['predictions'],
    queryFn: reportApi.getPredictions,
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-semibold">🤖 Модуль ИИ</h2>
        <Badge variant="warning">Заглушка</Badge>
      </div>

      <Card className="border-dashed border-amber-300 bg-amber-50">
        <CardContent className="p-5 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-amber-800">Демо-режим</p>
            <p className="text-sm text-amber-700 mt-1">
              Модуль искусственного интеллекта в данный момент работает в режиме заглушки.
              Отображаемые прогнозы загруженности являются статическими демо-данными и не отражают реальную ситуацию.
              Для подключения реальной ML-модели необходимо реализовать бэкенд-интеграцию.
            </p>
          </div>
        </CardContent>
      </Card>

      <h3 className="text-lg font-semibold text-gray-800">Прогноз загруженности боксов</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {predictions?.map((pred) => {
          const occupancy = pred.predicted_occupancy;
          const barColor = occupancy > 80 ? 'bg-red-500' : occupancy > 50 ? 'bg-amber-500' : 'bg-green-500';
          const badgeVariant = occupancy > 80 ? 'destructive' as const : occupancy > 50 ? 'warning' as const : 'success' as const;
          const label = occupancy > 80 ? 'Высокая' : occupancy > 50 ? 'Средняя' : 'Низкая';
          const timeStr = new Date(pred.appointment_time).toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
          });

          return (
            <Card key={pred.schedule_id}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-blue-500" />
                    <span className="font-semibold text-gray-900">Бокс {pred.box_id}</span>
                  </div>
                  <Badge variant={badgeVariant}>{label}</Badge>
                </div>

                <p className="text-sm text-gray-500 mb-3">Время: {timeStr}</p>

                {/* Progress bar */}
                <div className="w-full bg-gray-100 rounded-full h-3 mb-2">
                  <div
                    className={`h-3 rounded-full transition-all ${barColor}`}
                    style={{ width: `${occupancy}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Загруженность: {occupancy}%</span>
                  <span>Уверенность: {Math.round(pred.confidence * 100)}%</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardContent className="p-5">
          <h4 className="font-semibold text-gray-800 mb-2">Возможности модуля ИИ (план)</h4>
          <ul className="text-sm text-gray-600 space-y-1.5 list-disc list-inside">
            <li>Прогнозирование загруженности боксов на основе исторических данных</li>
            <li>Рекомендации оптимального времени для записи клиентам</li>
            <li>Автоматическое ценообразование в зависимости от спроса</li>
            <li>Анализ оттока клиентов и персональные предложения</li>
            <li>Оптимизация расписания сотрудников</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
