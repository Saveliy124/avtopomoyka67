import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Car, Clock, History, Sparkles } from 'lucide-react';
import { boxApi } from '@/api/box.api';
import { bookingApi } from '@/api/booking.api';
import { formatPrice } from '@/utils/format';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import type { Booking } from '@/types';

export function WasherPanel() {
  const queryClient = useQueryClient();
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [activeBoxFilter, setActiveBoxFilter] = useState<number | 'all'>('all');
  const [activeView, setActiveView] = useState<'today' | 'history'>('today');

  const { data: boxes } = useQuery({
    queryKey: ['boxes-all'],
    queryFn: () => boxApi.getBoxes()
  });

  const { data: bookings, isLoading } = useQuery({
    queryKey: ['bookings'],
    queryFn: bookingApi.getMyBookings,
  });

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: Booking['status'] }) =>
      bookingApi.updateBookingStatus(id, status),
    onSuccess: (updatedBooking) => {
      queryClient.setQueryData<Booking[]>(['bookings'], (current) =>
        current?.map((booking) =>
          booking.id === updatedBooking.id
            ? { ...booking, status: updatedBooking.status, actual_arrival: updatedBooking.actual_arrival }
            : booking
        )
      );
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['my-stats'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['washers'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      toast.success('Статус обновлен');
      setSelectedBooking(null);
    },
    onError: () => toast.error('Ошибка обновления статуса'),
  });

  const byBox = (booking: Booking) =>
    activeBoxFilter === 'all' || booking.box_id === activeBoxFilter;

  const todayBookings = bookings?.filter((b) => {
    const d = format(new Date(b.appointment_time), 'yyyy-MM-dd');
    return d === todayStr && b.status !== 'cancelled' && b.status !== 'cancelled_tech' && byBox(b);
  })?.sort((a, b) => {
    if (a.status === 'completed' && b.status !== 'completed') return 1;
    if (a.status !== 'completed' && b.status === 'completed') return -1;
    return new Date(a.appointment_time).getTime() - new Date(b.appointment_time).getTime();
  });

  const historyBookings = bookings?.filter((b) =>
    new Date(b.appointment_time).getTime() < Date.now() && byBox(b)
  )?.sort((a, b) => new Date(b.appointment_time).getTime() - new Date(a.appointment_time).getTime());

  const visibleBookings = activeView === 'today' ? todayBookings : historyBookings;

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 px-2">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-lg font-semibold text-gray-900">
            {activeView === 'today' ? 'Записи на сегодня' : 'Прошедшие записи'}
          </h2>
          <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-1 rounded-full">
            {visibleBookings?.length ?? 0}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={activeView === 'today' ? 'default' : 'outline'}
            size="sm"
            className="h-10 gap-2"
            onClick={() => setActiveView('today')}
          >
            <Clock className="h-4 w-4" />
            Сегодня
          </Button>
          <Button
            variant={activeView === 'history' ? 'default' : 'outline'}
            size="sm"
            className="h-10 gap-2"
            onClick={() => setActiveView('history')}
          >
            <History className="h-4 w-4" />
            История
          </Button>

          <select
            value={activeBoxFilter}
            onChange={(e) => setActiveBoxFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="h-10 rounded-lg border border-gray-300 px-3 text-sm focus:ring-2 focus:ring-blue-500 max-w-[220px]"
          >
            <option value="all">Все боксы</option>
            {boxes?.filter(b => b.is_active).map(b => (
              <option key={b.id} value={b.id}>
                Бокс {b.box_number} ({b.wash_type === 'robot' ? 'Робот' : 'Ручная'})
              </option>
            ))}
          </select>
        </div>
      </div>

      {visibleBookings?.length === 0 && (
        <p className="text-gray-400 text-sm text-center py-10">
          {activeView === 'today' ? 'Нет записей на сегодня' : 'Прошедших записей нет'}
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {visibleBookings?.map((booking) => {
          const timeStr = new Date(booking.appointment_time).toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
          });
          const dateStr = new Date(booking.appointment_time).toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit',
          });
          const isCompleted = booking.status === 'completed';

          return (
            <Card
              key={booking.id}
              className={`cursor-pointer transition-all hover:shadow-md aspect-square flex flex-col justify-between ${
                isCompleted
                  ? 'bg-slate-50 border-slate-200 opacity-70'
                  : 'hover:border-blue-400'
              }`}
              onClick={() => setSelectedBooking(booking)}
            >
              <CardContent className="p-4 flex flex-col h-full">
                <div className="flex justify-between items-start mb-3 gap-2">
                  <div className="bg-slate-100 px-2.5 py-1.5 rounded-md flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-slate-500" />
                    <span className="text-xl font-bold text-slate-800 tracking-tight">{timeStr}</span>
                  </div>
                  <div className="text-xs font-medium bg-slate-100 text-slate-500 px-2 py-1 rounded-md">
                    Бокс {booking.box_number}
                  </div>
                </div>

                <div className="flex-1 mt-1">
                  {booking.car_info ? (
                    <p className="text-lg font-bold text-gray-900 uppercase tracking-widest bg-gray-100 inline-block px-2 py-0.5 rounded border border-gray-200 mb-2">
                      {booking.car_info}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-400 italic mb-2">Без номера</p>
                  )}
                  <p className="font-semibold text-gray-700 text-sm line-clamp-2 leading-tight">{booking.service_name}</p>

                  {booking.extra_services && booking.extra_services.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {booking.extra_services.slice(0, 3).map((es: any) => (
                        <div key={es.id} className="flex items-center gap-0.5 bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded text-[10px] font-medium border border-blue-100">
                          <Sparkles className="w-2.5 h-2.5" />
                          {es.service_name}
                        </div>
                      ))}
                      {booking.extra_services.length > 3 && (
                        <div className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-[10px] font-medium border border-slate-200">
                          + {booking.extra_services.length - 3} еще
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-auto pt-3">
                  {activeView === 'history' && (
                    <p className="text-xs text-slate-500 mb-1">{dateStr}</p>
                  )}
                  <StatusBadge status={booking.status} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!selectedBooking} onOpenChange={(open) => !open && setSelectedBooking(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Детали записи</DialogTitle>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 text-xs mb-0.5">Дата и время</p>
                  <p className="font-medium">
                    {new Date(selectedBooking.appointment_time).toLocaleString('ru-RU', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })} (Бокс {selectedBooking.box_number})
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs mb-0.5">Статус</p>
                  <StatusBadge status={selectedBooking.status} />
                </div>
                <div>
                  <p className="text-gray-500 text-xs mb-0.5">Клиент</p>
                  <p className="font-medium">{selectedBooking.client_name}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs mb-0.5">Стоимость</p>
                  <p className="font-semibold text-blue-600">{formatPrice(selectedBooking.price)}</p>
                </div>
                <div className="col-span-2 flex items-center gap-2 bg-slate-50 p-3 rounded-lg border">
                  <Car className="w-5 h-5 text-slate-400" />
                  <span className="font-medium text-slate-700">{selectedBooking.car_info || 'Автомобиль не указан'}</span>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-500 text-xs mb-0.5">Услуга:</p>
                  <p className="font-semibold">{selectedBooking.service_name}</p>
                </div>
                {selectedBooking.extra_services && selectedBooking.extra_services.length > 0 && (
                  <div className="col-span-2">
                    <p className="text-gray-500 text-xs mb-0.5">Дополнительные услуги:</p>
                    <ul className="list-disc list-inside text-xs text-slate-700 space-y-1">
                      {selectedBooking.extra_services.map((e: any) => (
                        <li key={e.id}>{e.service_name}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                {selectedBooking.status === 'confirmed' && (
                  <Button
                    className="flex-1 bg-amber-500 hover:bg-amber-600"
                    onClick={() => mutation.mutate({ id: selectedBooking.id, status: 'in_progress' })}
                    disabled={mutation.isPending}
                  >
                    Отметить прибытие
                  </Button>
                )}
                {selectedBooking.status === 'confirmed' && (
                  <Button
                    variant="outline"
                    className="flex-1 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                    onClick={() => mutation.mutate({ id: selectedBooking.id, status: 'no_show' })}
                    disabled={mutation.isPending}
                  >
                    Клиент не явился
                  </Button>
                )}
                {selectedBooking.status === 'in_progress' && (
                  <Button
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => mutation.mutate({ id: selectedBooking.id, status: 'completed' })}
                    disabled={mutation.isPending}
                  >
                    Завершить мойку
                  </Button>
                )}
                {(selectedBooking.status === 'completed' || selectedBooking.status === 'cancelled' || selectedBooking.status === 'cancelled_tech' || selectedBooking.status === 'no_show') && (
                  <p className="text-sm text-center w-full text-slate-400 italic">Действия недоступны</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
