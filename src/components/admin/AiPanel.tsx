import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { reportApi } from '@/api/report.api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import type { AiPredictionPoint } from '@/types';

type ChartMode = 'hourly' | 'weekdays';

function OccupancyChart({
  title,
  data,
  dataKey,
  color,
}: {
  title: string;
  data: AiPredictionPoint[];
  dataKey: 'manual' | 'robot';
  color: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <span className="text-xs font-medium text-gray-500">Загрузка, %</span>
        </div>

        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis domain={[0, 100]} tickLine={false} axisLine={false} fontSize={12} />
              <Tooltip
                formatter={(value: number) => [`${value}%`, title]}
                labelFormatter={(label) => `Период: ${label}`}
              />
              <Bar dataKey={dataKey} fill={color} radius={[6, 6, 0, 0]} maxBarSize={44} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export function AiPanel() {
  const [mode, setMode] = useState<ChartMode>('hourly');
  const [refreshToken, setRefreshToken] = useState(0);
  const { data: predictions, isLoading, isFetching } = useQuery({
    queryKey: ['predictions', refreshToken],
    queryFn: () => reportApi.getPredictions(refreshToken > 0),
  });

  if (isLoading) return <PageLoader />;

  const chartData = mode === 'hourly' ? predictions?.hourly ?? [] : predictions?.weekdays ?? [];
  const trainingInfo = predictions?.trained_on_points
    ? `LSTM-прогноз по истории записей и интервалов: ${predictions.trained_on_points}`
    : predictions?.model;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold">ИИ-прогноз загрузки</h2>
          {trainingInfo && (
            <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
              {trainingInfo}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
            <Button
              size="sm"
              variant={mode === 'hourly' ? 'default' : 'ghost'}
              onClick={() => setMode('hourly')}
            >
              По часам
            </Button>
            <Button
              size="sm"
              variant={mode === 'weekdays' ? 'default' : 'ghost'}
              onClick={() => setMode('weekdays')}
            >
              По дням недели
            </Button>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setRefreshToken((value) => value + 1)}
            disabled={isFetching}
          >
            {isFetching ? 'Обновление...' : 'Обновить'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <OccupancyChart
          title="Ручная мойка"
          data={chartData}
          dataKey="manual"
          color="#2563eb"
        />
        <OccupancyChart
          title="Автоматическая мойка"
          data={chartData}
          dataKey="robot"
          color="#16a34a"
        />
      </div>
    </div>
  );
}
