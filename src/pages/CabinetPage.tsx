import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { CalendarDays, X } from 'lucide-react';
import { bookingApi } from '@/api/booking.api';
import { useAuthStore } from '@/store/auth.store';
import { formatFullName, formatDateTime, formatPrice } from '@/utils/format';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import { ErrorMessage } from '@/components/shared/ErrorMessage';

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

  return (
    <div className="container max-w-4xl py-10">
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold text-gray-900 mb-1">Личный кабинет</h1>
        <p className="text-gray-500 mb-8">{formatFullName(user)} · {user.email}</p>
      </motion.div>

      <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <CalendarDays className="h-5 w-5 text-blue-600" />
        Мои записи
      </h2>

      {isLoading && <PageLoader />}
      {isError && <ErrorMessage message="Не удалось загрузить записи" />}

      {!isLoading && !isError && (
        <div className="space-y-3">
          {bookings?.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>У вас пока нет записей</p>
              <Button className="mt-4" asChild>
                <a href="/booking">Записаться</a>
              </Button>
            </div>
          ) : (
            bookings?.map((booking) => (
              <motion.div
                key={booking.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">{booking.service_name}</h3>
                          <StatusBadge status={booking.status} />
                        </div>
                        <p className="text-sm text-gray-500">
                          📅 {formatDateTime(booking.appointment_time)} · Бокс {booking.box_number}
                        </p>
                        {booking.car_info && (
                          <p className="text-sm text-gray-500">🚗 {booking.car_info}</p>
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
            ))
          )}
        </div>
      )}
    </div>
  );
}
