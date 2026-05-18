import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { toast } from 'sonner';
import { CalendarDays, Car, Clock, Banknote, Sparkles, ArrowRight } from 'lucide-react';
import { bookingApi } from '@/api/booking.api';
import { useBookingStore } from '@/store/booking.store';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatPrice, formatDuration } from '@/utils/format';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BookingConfirmModal({ open, onOpenChange }: Props) {
  const { selectedService, selectedDate, selectedSlot, selectedExtras, carInfo, reset } = useBookingStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const extrasTotal = selectedExtras.reduce((sum, e) => sum + (e.price ?? 0), 0);
  const totalPrice = (selectedService?.price ?? 0) + extrasTotal;

  const extrasDuration = selectedExtras.reduce((sum, e) => sum + (e.duration_minutes ?? 0), 0);
  const totalDuration = (selectedService?.duration_minutes ?? 0) + extrasDuration;

  // Compute end time = start + totalDuration minutes
  const startTime = selectedSlot ? new Date(selectedSlot.appointment_time) : null;
  const endTime = startTime ? new Date(startTime.getTime() + totalDuration * 60_000) : null;
  const fmtTime = (d: Date) => d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

  const mutation = useMutation({
    mutationFn: bookingApi.createBooking,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['slots'] });
      reset();
      onOpenChange(false);
      toast.success('Запись создана! Ждём вас.');
      navigate('/cabinet');
    },
    onError: (err: any) => {
      const status = err?.response?.status;
      if (status === 409) {
        toast.error('Этот слот уже занят. Выберите другое время.');
      } else {
        toast.error('Ошибка при создании записи');
      }
    },
  });

  const handleConfirm = () => {
    if (!selectedSlot || !selectedService) return;
    mutation.mutate({
      schedule_id: selectedSlot.id,
      service_id: selectedService.id,
      appointment_time: selectedSlot.appointment_time,
      car_info: carInfo || undefined,
      extra_services: selectedExtras.length > 0 ? selectedExtras : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Подтверждение записи</DialogTitle>
        </DialogHeader>

        <div className="space-y-2.5">
          {/* Service */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
            <Car className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-gray-500">Услуга</p>
              <p className="text-sm font-medium text-gray-900">{selectedService?.service_name}</p>
            </div>
          </div>

          {/* Date */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
            <CalendarDays className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-gray-500">Дата</p>
              <p className="text-sm font-medium text-gray-900">
                {selectedDate ? format(selectedDate, 'd MMMM yyyy', { locale: ru }) : '—'}
              </p>
            </div>
          </div>

          {/* Time start → end */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
            <Clock className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-gray-500">Время начала → окончания</p>
              <div className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
                {startTime ? fmtTime(startTime) : '—'}
                <ArrowRight className="h-3.5 w-3.5 text-gray-400" />
                {endTime ? fmtTime(endTime) : '—'}
                <span className="text-xs text-gray-400 ml-1">({formatDuration(totalDuration)})</span>
              </div>
            </div>
          </div>

          {/* Extra services */}
          {selectedExtras.length > 0 && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
              <Sparkles className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Доп. услуги</p>
                <p className="text-sm font-medium text-gray-900">
                  {selectedExtras.map((e) => e.service_name).join(', ')}
                </p>
                <p className="text-xs text-blue-600">{formatPrice(extrasTotal)}</p>
              </div>
            </div>
          )}

          {/* Car info */}
          {carInfo && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
              <Car className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Автомобиль</p>
                <p className="text-sm font-medium text-gray-900">{carInfo}</p>
              </div>
            </div>
          )}

          {/* Total */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 border border-blue-200">
            <div className="flex items-center gap-2">
              <Banknote className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">Итого</span>
            </div>
            <span className="text-lg font-bold text-blue-700">{formatPrice(totalPrice)}</span>
          </div>

          <p className="text-xs text-gray-400 text-center">
            Бокс будет назначен автоматически при подтверждении
          </p>
        </div>

        <div className="flex gap-3 mt-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Изменить
          </Button>
          <Button
            className="flex-1"
            onClick={handleConfirm}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Создание...' : 'Подтвердить'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
