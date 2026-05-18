import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { slotApi } from '@/api/slot.api';
import { useBookingStore } from '@/store/booking.store';
import { useAuthStore } from '@/store/auth.store';
import { Skeleton } from '@/components/ui/skeleton';
import type { WashType } from '@/store/booking.store';
import type { Slot } from '@/types';

const SLOT_INTERVAL: Record<WashType, number> = {
  manual: 30,
  robot: 15,
};

interface Props {
  washType: WashType;
}

export function SlotGrid({ washType }: Props) {
  const { selectedDate, selectedSlot, selectedService, selectedExtras, setSelectedSlot, setSlotConflict } = useBookingStore();
  const user = useAuthStore((s) => s.user);

  const dateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';

  const { data: slots, isLoading } = useQuery({
    queryKey: ['slots', dateStr, washType],
    queryFn: () => slotApi.getSlots({ date: dateStr, washType }),
    enabled: !!selectedDate && !!washType,
  });

  // Total duration = base service + selected extras
  const serviceDuration = selectedService?.duration_minutes ?? 0;
  const extrasDuration = selectedExtras.reduce((sum, e) => sum + (e.duration_minutes ?? 0), 0);
  const totalDuration = serviceDuration + extrasDuration;
  const intervalMins = SLOT_INTERVAL[washType];
  const slotsNeeded = Math.max(1, Math.ceil(totalDuration / intervalMins));

  // Build set of timestamps that would be "covered" by the selected slot
  // Map of timestamp(ms) -> sequential index among covered slots (for wave delay)
  const coveredTimes = new Map<number, number>();
  if (selectedSlot && slotsNeeded > 1) {
    const startMs = new Date(selectedSlot.appointment_time).getTime();
    for (let i = 1; i < slotsNeeded; i++) {
      coveredTimes.set(startMs + i * intervalMins * 60_000, i);
    }
  }

  const canFitService = (slotTime: string): boolean => {
    if (!slots || slotsNeeded <= 1) return true;
    const startMs = new Date(slotTime).getTime();
    const byBox: Record<number, Set<number>> = {};
    for (const s of slots) {
      if (s.is_available && !s.is_maintenance) {
        if (!byBox[s.box_id]) byBox[s.box_id] = new Set();
        byBox[s.box_id].add(new Date(s.appointment_time).getTime());
      }
    }
    for (const times of Object.values(byBox)) {
      let ok = true;
      for (let i = 0; i < slotsNeeded; i++) {
        if (!times.has(startMs + i * intervalMins * 60_000)) { ok = false; break; }
      }
      if (ok) return true;
    }
    return false;
  };

  // De-duplicate by time — prefer available slots
  const uniqueSlots = (() => {
    const map = new Map<string, Slot>();
    if (!slots) return [];
    for (const s of slots) {
      const key = s.appointment_time;
      if (!map.has(key)) {
        map.set(key, s);
      } else {
        if (s.is_available && !s.is_maintenance) map.set(key, s);
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(a.appointment_time).getTime() - new Date(b.appointment_time).getTime()
    );
  })();

  useEffect(() => {
    if (!selectedSlot) { setSlotConflict(false); return; }
    setSlotConflict(!canFitService(selectedSlot.appointment_time));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSlot?.id, slotsNeeded, slots]);

  if (!selectedDate) {
    return <div className="text-gray-400 text-sm text-center py-8">Выберите дату для просмотра доступных слотов</div>;
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
        {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
      </div>
    );
  }

  if (!uniqueSlots.length) {
    return <div className="text-gray-400 text-sm text-center py-8">Нет слотов на выбранную дату</div>;
  }

  return (
    <div>
      {/* Легенда */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-white border border-gray-300 inline-block flex-shrink-0" />
          Доступно
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-gray-200 inline-block flex-shrink-0" />
          Занято
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-red-100 border border-red-300 inline-block flex-shrink-0 opacity-70" />
          Тех. работы
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-amber-100 border border-amber-300 inline-block flex-shrink-0 opacity-70" />
          Не подходит
        </span>
      </div>

      <motion.div
        className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-7 gap-2"
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.03 } } }}
      >
        {uniqueSlots.map((slot) => {
          const slotMs = new Date(slot.appointment_time).getTime();
          const isSelected = selectedSlot?.appointment_time === slot.appointment_time;
          const coveredIdx = coveredTimes.get(slotMs); // undefined if not covered
          const isCovered = coveredIdx !== undefined;
          const waveDelay = isCovered ? `${(coveredIdx! / (slotsNeeded - 1)) * 0.6}s` : '0s';
          const isMaintenance = slot.is_maintenance;
          const isPastUnavailable =
            slotMs < Date.now() && !slot.is_available && !isMaintenance && !slot.has_booking;
          const isOccupied = !slot.is_available && !isMaintenance && !isPastUnavailable;
          const noRoom = slot.is_available && !isMaintenance && !canFitService(slot.appointment_time);
          const isDisabled = isOccupied || isMaintenance || isPastUnavailable || noRoom;

          const timeStr = new Date(slot.appointment_time).toLocaleTimeString('ru-RU', {
            hour: '2-digit', minute: '2-digit',
          });

          return (
            <motion.button
              key={slot.appointment_time}
              variants={{ hidden: { opacity: 0, scale: 0.8 }, visible: { opacity: 1, scale: 1 } }}
              onClick={() => !isDisabled && setSelectedSlot(slot, false)}
              disabled={isDisabled}
              title={
                isMaintenance ? 'Технические работы'
                : noRoom ? `Не хватает ${slotsNeeded} слотов подряд для этой услуги`
                : isCovered ? `Войдёт в промежуток вашей услуги`
                : undefined
              }
              style={isCovered ? { animationDelay: waveDelay } : undefined}
              className={`
                relative h-14 rounded-lg text-sm font-medium transition-all duration-150 border
                ${isCovered ? 'animate-breathe ring-2 ring-blue-300' : ''}
                ${isMaintenance
                  ? 'bg-red-50 text-red-300 border-red-200 cursor-not-allowed opacity-60'
                  : isPastUnavailable
                  ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed opacity-75'
                  : isOccupied
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200'
                  : noRoom
                  ? 'bg-amber-50 text-amber-400 border-amber-200 cursor-not-allowed opacity-75'
                  : isSelected
                  ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-blue-400 hover:bg-blue-50'
                }
              `}
            >
              <span className="block leading-tight">{timeStr}</span>
              {isPastUnavailable && (
                <span className="mt-0.5 block text-[10px] leading-none">Недоступно</span>
              )}
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
}
