import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { CalendarDays, X, ArrowRight } from 'lucide-react';
import { bookingApi } from '@/api/booking.api';
import { useAuthStore } from '@/store/auth.store';
import { formatFullName, formatDateOnly, formatTimeOnly, formatPrice } from '@/utils/format';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import { ErrorMessage } from '@/components/shared/ErrorMessage';

function calcEndTime(appointmentTime: string, durationMinutes: number): string {
  const start = new Date(appointmentTime);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return end.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export function CabinetPage() {
  const user = useAuthStore((s) => s.user)!;
  const queryClient = useQueryClient();

  const { data: bookings, isLoading, isError } = useQuery({
    queryKey: ['bookings'],
    queryFn: bookingApi.getMyBookings,
  });

  const cancelMutation = useMutation({
    mutationFn: bookingApi.cancelBooking,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      toast.success('Запись отменена');
    },
    onError: () => toast.error('Ошибка при отмене'),
  });

  const sortedBookings = bookings
    ? [...bookings].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    : [];

  const PAGE_SIZE = 10;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const visibleBookings = sortedBookings.slice(0, visibleCount);
  const hasMore = visibleCount < sortedBookings.length;

  return (
    <div className="container max-w-4xl py-10">
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold text-gray-900 mb-1">Личный кабинет</h1>
        <p className="text-gray-500 mb-8">{formatFullName(user)} · {user.phone || 'Телефон не указан'}</p>
      </motion.div>

      <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <CalendarDays className="h-5 w-5 text-blue-600" />
        Мои записи
      </h2>

      {isLoading && <PageLoader />}
      {isError && <ErrorMessage message="Не удалось загрузить записи" />}

      {!isLoading && !isError && (
        <div className="space-y-3">
          {sortedBookings.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>У вас пока нет записей</p>
              <Button className="mt-4" asChild>
                <a href="/booking">Записаться</a>
              </Button>
            </div>
          ) : (
            <>
              {visibleBookings.map((booking) => {
                const startTimeStr = formatTimeOnly(booking.appointment_time);
                // Total duration = base service + all extra services
                const extrasDuration = booking.extra_services?.reduce(
                  (sum: number, es: { duration_minutes: number }) => sum + (es.duration_minutes || 0),
                  0
                ) ?? 0;
                const totalDuration = (booking.duration_minutes || 0) + extrasDuration;
                const endTimeStr = totalDuration > 0
                  ? calcEndTime(booking.appointment_time, totalDuration)
                  : null;


                return (
                  <motion.div
                    key={booking.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card>
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-gray-900">{booking.service_name}</h3>
                              <StatusBadge status={booking.status} />
                            </div>

                            <p className="text-sm text-gray-500 flex items-center gap-1 flex-wrap">
                              📅 {formatDateOnly(booking.appointment_time)}
                              &nbsp;·&nbsp;
                              {startTimeStr}
                              {endTimeStr && (
                                <>
                                  <ArrowRight className="h-3 w-3 text-gray-400 inline" />
                                  {endTimeStr}
                                </>
                              )}
                              &nbsp;·&nbsp;Бокс {booking.box_number}
                            </p>

                            {booking.car_info && (
                              <p className="text-sm text-gray-500">🚗 {booking.car_info}</p>
                            )}
                            {!!booking.extra_services?.length && (
                              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                <span className="text-xs font-medium text-gray-500">Доп. услуги:</span>
                                {booking.extra_services.map((extra) => (
                                  <span
                                    key={extra.id}
                                    className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
                                  >
                                    {extra.service_name}
                                  </span>
                                ))}
                              </div>
                            )}
                            <p className="text-sm font-semibold text-blue-600">{formatPrice(booking.price)}</p>
                          </div>

                          {booking.status === 'confirmed' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 border-red-200 hover:bg-red-50"
                              onClick={() => cancelMutation.mutate(booking.id)}
                              disabled={cancelMutation.isPending}
                            >
                              <X className="h-3.5 w-3.5" />
                              Отменить
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}

              {hasMore && (
                <div className="flex justify-center pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                  >
                    Показать ещё ({sortedBookings.length - visibleCount})
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
