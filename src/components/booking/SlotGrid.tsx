import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Brain } from 'lucide-react';
import { slotApi } from '@/api/slot.api';
import { reportApi } from '@/api/report.api';
import { useBookingStore } from '@/store/booking.store';
import { useAuthStore } from '@/store/auth.store';
import { Skeleton } from '@/components/ui/skeleton';
import { hasPermission } from '@/utils/permissions';

export function SlotGrid() {
  const { selectedBox, selectedDate, selectedSlot, setSelectedSlot } = useBookingStore();
  const user = useAuthStore((s) => s.user);

  const canViewPredictions = hasPermission(user, 'can_view_reports');
  const dateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';

  const { data: slots, isLoading } = useQuery({
    queryKey: ['slots', dateStr, selectedBox?.id],
    queryFn: () => slotApi.getSlots({ date: dateStr, boxId: selectedBox!.id }),
    enabled: !!selectedDate && !!selectedBox,
  });

  const { data: predictions } = useQuery({
    queryKey: ['predictions'],
    queryFn: reportApi.getPredictions,
    enabled: canViewPredictions,
  });

  const predictedIds = new Set(predictions?.map((p) => p.schedule_id));

  if (!selectedDate || !selectedBox) {
    return (
      <div className="text-gray-400 text-sm text-center py-8">
        Выберите бокс и дату для просмотра доступных слотов
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-lg" />
        ))}
      </div>
    );
  }

  if (!slots?.length) {
    return (
      <div className="text-gray-400 text-sm text-center py-8">
        Нет слотов на выбранную дату
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-4 text-xs text-gray-500 flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-white border border-gray-300 inline-block" />
          Доступно
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-gray-200 inline-block" />
          Занято
        </span>
        {canViewPredictions && (
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-blue-100 border border-blue-400 inline-block" />
            AI рекомендация
          </span>
        )}
      </div>

      <motion.div
        className="grid grid-cols-4 sm:grid-cols-6 gap-2"
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.03 } } }}
      >
        {slots.map((slot) => {
          const isSelected = selectedSlot?.id === slot.id;
          const isAI = canViewPredictions && predictedIds.has(slot.id);
          const isOccupied = !slot.is_available;
          const timeStr = new Date(slot.appointment_time).toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
          });

          return (
            <motion.button
              key={slot.id}
              variants={{ hidden: { opacity: 0, scale: 0.8 }, visible: { opacity: 1, scale: 1 } }}
              onClick={() => !isOccupied && setSelectedSlot(slot)}
              disabled={isOccupied}
              title={isAI ? 'AI рекомендует этот слот' : undefined}
              className={`
                relative h-12 rounded-lg text-sm font-medium transition-all duration-150 border
                ${isOccupied
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200'
                  : isSelected
                  ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200'
                  : isAI
                  ? 'bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-blue-400 hover:bg-blue-50'
                }
              `}
            >
              {timeStr}
              {isAI && !isOccupied && (
                <Brain className="absolute top-0.5 right-0.5 h-2.5 w-2.5 text-blue-500" />
              )}
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
}
