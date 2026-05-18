import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Power, PowerOff, Trash2, AlertTriangle } from 'lucide-react';
import { boxApi } from '@/api/box.api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

export function BoxesPanel() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [newBoxNumber, setNewBoxNumber] = useState('');
  const [newWashType, setNewWashType] = useState<'manual' | 'robot'>('manual');

  // State for delete confirmation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [boxToDelete, setBoxToDelete] = useState<{ id: number; box_number: string; bookings_count?: number } | null>(null);

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
    mutationFn: ({ id, force }: { id: number; force: boolean }) => boxApi.deleteBox(id, force),
    onSuccess: (_, { force }) => {
      queryClient.invalidateQueries({ queryKey: ['boxes-all'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      toast.success(force ? 'Бокс удалён, записи отменены по техническим причинам' : 'Бокс удалён');
      setDeleteDialogOpen(false);
      setBoxToDelete(null);
    },
    onError: (err: any) => {
      // Server returns 409 when box has active bookings — show confirmation dialog with count
      if (err?.response?.status === 409) {
        setBoxToDelete(prev => prev ? { ...prev, bookings_count: err.response.data.bookings_count } : null);
      } else {
        toast.error('Не удалось удалить бокс');
      }
    },
  });

  const handleDeleteClick = (box: { id: number; box_number: string }) => {
    setBoxToDelete({ id: box.id, box_number: box.box_number });
    setDeleteDialogOpen(true);
    // Attempt normal delete first — server returns 409 if bookings exist
    deleteMutation.mutate({ id: box.id, force: false });
  };

  const handleForceDelete = () => {
    if (boxToDelete) {
      deleteMutation.mutate({ id: boxToDelete.id, force: true });
    }
  };

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
                  onClick={() => handleDeleteClick(box)}
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

      {/* Delete confirmation dialog — shown when box has active bookings */}
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => {
        if (!open) { setDeleteDialogOpen(false); setBoxToDelete(null); }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Удаление бокса
            </DialogTitle>
          </DialogHeader>
          {boxToDelete?.bookings_count !== undefined && boxToDelete.bookings_count > 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-700">
                Бокс <strong>№{boxToDelete.box_number}</strong> содержит{' '}
                <strong className="text-red-600">{boxToDelete.bookings_count}</strong>{' '}
                активных записей.
              </p>
              <p className="text-sm text-gray-600">
                При принудительном удалении все активные записи будут помечены как
                <strong> «Удалена по техническим причинам»</strong>, и клиенты увидят
                это в своём личном кабинете.
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-600">
              Вы уверены, что хотите удалить бокс <strong>№{boxToDelete?.box_number}</strong>?
            </p>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setDeleteDialogOpen(false); setBoxToDelete(null); }}>
              Отмена
            </Button>
            {boxToDelete?.bookings_count !== undefined && boxToDelete.bookings_count > 0 && (
              <Button
                variant="destructive"
                onClick={handleForceDelete}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Удаление...' : 'Всё равно удалить'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
