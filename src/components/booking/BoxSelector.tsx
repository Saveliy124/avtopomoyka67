import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Check, Car } from 'lucide-react';
import { boxApi } from '@/api/box.api';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { WashType } from '@/store/booking.store';

/** Standalone box selector — used in admin flows. Not used in client booking (box auto-assigned). */
export function BoxSelector({ washType, selectedBoxId, onSelect }: {
  washType: WashType;
  selectedBoxId?: number | null;
  onSelect?: (box: any) => void;
}) {
  const { data: boxes, isLoading } = useQuery({
    queryKey: ['boxes', washType],
    queryFn: () => boxApi.getBoxes(washType),
  });

  const activeBoxes = boxes?.filter((b) => b.is_active) ?? [];

  if (isLoading) {
    return (
      <div className="flex gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-28 rounded-xl" />
        ))}
      </div>
    );
  }

  if (activeBoxes.length === 0) {
    return <p className="text-sm text-gray-400">Нет доступных боксов для данного типа мойки</p>;
  }

  return (
    <div className="flex flex-wrap gap-3">
      {activeBoxes.map((box) => {
        const isSelected = selectedBoxId === box.id;
        return (
          <motion.div key={box.id} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
            <Card
              onClick={() => onSelect?.(box)}
              className={`cursor-pointer p-4 min-w-[100px] text-center relative transition-all ${
                isSelected
                  ? 'border-blue-500 border-2 bg-blue-50'
                  : 'hover:border-blue-300'
              }`}
            >
              {isSelected && (
                <div className="absolute top-1 right-1 rounded-full bg-blue-600 p-0.5">
                  <Check className="h-2.5 w-2.5 text-white" />
                </div>
              )}
              <Car className={`h-5 w-5 mx-auto mb-1 ${isSelected ? 'text-blue-600' : 'text-gray-400'}`} />
              <p className="font-semibold text-sm text-gray-900">Бокс {box.box_number}</p>
              <p className="text-xs text-gray-400 mt-0.5">{box.wash_type === 'robot' ? 'Робот' : 'Ручная'}</p>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
