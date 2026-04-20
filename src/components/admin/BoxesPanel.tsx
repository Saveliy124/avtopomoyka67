import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Power, PowerOff, Trash2 } from 'lucide-react';
import { boxApi } from '@/api/box.api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageLoader } from '@/components/shared/LoadingSpinner';

export function BoxesPanel() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [newBoxNumber, setNewBoxNumber] = useState('');
  const [newWashType, setNewWashType] = useState<'manual' | 'robot'>('manual');

  const { data: boxes, isLoading } = useQuery({
    queryKey: ['boxes-all'],
    queryFn: () => boxApi.getBoxes(),
  });

  const createMutation = useMutation({
    mutationFn: boxApi.createBox,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boxes-all'] });
      toast.success('Бокс добавлен');
      setShowAdd(false);
      setNewBoxNumber('');
    },
    onError: () => toast.error('Ошибка'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      boxApi.updateBox(id, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boxes-all'] });
      toast.success('Статус бокса обновлён');
    },
    onError: () => toast.error('Ошибка'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => boxApi.deleteBox(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boxes-all'] });
      toast.success('Бокс удалён');
    },
    onError: () => toast.error('Не удалось удалить бокс (возможно, есть связанные записи)'),
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Управление боксами</h2>
        <Button size="sm" onClick={() => setShowAdd(!showAdd)}>
          <Plus className="h-4 w-4" /> Добавить бокс
        </Button>
      </div>

      {showAdd && (
        <Card>
          <CardContent className="p-4 flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Номер бокса</label>
              <Input
                placeholder="Например: 3 или R2"
                value={newBoxNumber}
                onChange={(e) => setNewBoxNumber(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Тип</label>
              <select
                value={newWashType}
                onChange={(e) => setNewWashType(e.target.value as 'manual' | 'robot')}
                className="h-9 rounded-md border border-gray-300 px-3 text-sm"
              >
                <option value="manual">Ручная мойка</option>
                <option value="robot">Робот</option>
              </select>
            </div>
            <Button
              size="sm"
              onClick={() => createMutation.mutate({ box_number: newBoxNumber, wash_type: newWashType })}
              disabled={!newBoxNumber || createMutation.isPending}
            >
              Сохранить
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>Отмена</Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {boxes?.map((box) => (
          <Card key={box.id} className={!box.is_active ? 'opacity-60' : ''}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold">Бокс {box.box_number}</h3>
                <Badge variant={box.is_active ? 'success' : 'muted'}>
                  {box.is_active ? 'Активен' : 'Отключён'}
                </Badge>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                Тип: {box.wash_type === 'robot' ? '🤖 Робот' : '🖐️ Ручная мойка'}
              </p>
              <p className="text-xs text-gray-400 mb-3">
                Слоты: каждые {box.wash_type === 'robot' ? '15' : '30'} мин
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={box.is_active ? 'destructive' : 'default'}
                  onClick={() => toggleMutation.mutate({ id: box.id, is_active: !box.is_active })}
                  disabled={toggleMutation.isPending}
                  className="flex-1"
                >
                  {box.is_active ? (
                    <><PowerOff className="h-4 w-4" /> Отключить</>
                  ) : (
                    <><Power className="h-4 w-4" /> Включить</>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (confirm('Вы уверены, что хотите удалить этот бокс?')) {
                      deleteMutation.mutate(box.id);
                    }
                  }}
                  disabled={deleteMutation.isPending}
                  className="px-3 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
