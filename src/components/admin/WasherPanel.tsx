import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Car, Clock, Sparkles } from 'lucide-react';
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      toast.success('Статус обновлён');
      setSelectedBooking(null); // Close modal on success
    },
    onError: () => toast.error('Ошибка обновления статуса'),
  });

  const todayBookings = bookings?.filter((b) => {
    const d = format(new Date(b.appointment_time), 'yyyy-MM-dd');
    const isToday = d === todayStr && b.status !== 'cancelled';
    if (activeBoxFilter !== 'all') {
      return isToday && b.box_id === activeBoxFilter;
    }
    return isToday;
  })?.sort((a, b) => new Date(a.appointment_time).getTime() - new Date(b.appointment_time).getTime());

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Записи на сегодня</h2>
          <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-1 rounded-full">
            {todayBookings?.length ?? 0}
          </span>
        </div>
        
        {/* Фильтр по боксам */}
        <select 
          value={activeBoxFilter} 
          onChange={(e) => setActiveBoxFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className="h-10 rounded-lg border border-gray-300 px-3 text-sm focus:ring-2 focus:ring-blue-500 max-w-[200px]"
        >
          <option value="all">Все боксы</option>
          {boxes?.filter(b => b.is_active).map(b => (
            <option key={b.id} value={b.id}>Бокс {b.box_number} ({b.wash_type === 'robot' ? 'Робот' : 'Ручная'})</option>
          ))}
        </select>
      </div>

      {todayBookings?.length === 0 && (
        <p className="text-gray-400 text-sm text-center py-10">Нет записей на сегодня</p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {todayBookings?.map((booking) => {
          const timeStr = new Date(booking.appointment_time).toLocaleTimeString('ru-RU', {
            hour: '2-digit', minute: '2-digit'
          });

          return (
            <Card 
              key={booking.id} 
              className="cursor-pointer hover:border-blue-400 transition-all hover:shadow-md aspect-square flex flex-col justify-between"
              onClick={() => setSelectedBooking(booking)}
            >
              <CardContent className="p-4 flex flex-col h-full">
                <div className="flex justify-between items-start mb-3">
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
                  <p className="text-gray-500 text-xs mb-0.5">Время</p>
                  <p className="font-medium">
                    {new Date(selectedBooking.appointment_time).toLocaleTimeString('ru-RU', {
                      hour: '2-digit', minute: '2-digit'
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

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                {selectedBooking.status === 'confirmed' && (
                  <Button
                    className="flex-1 bg-amber-500 hover:bg-amber-600"
                    onClick={() => mutation.mutate({ id: selectedBooking.id, status: 'in_progress' })}
                    disabled={mutation.isPending}
                  >
                    Отметить прибытие
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
                {(selectedBooking.status === 'completed' || selectedBooking.status === 'cancelled') && (
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
