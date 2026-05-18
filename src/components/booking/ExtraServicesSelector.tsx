import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Plus, Info, Clock } from 'lucide-react';
import { serviceApi } from '@/api/service.api';
import { useBookingStore } from '@/store/booking.store';
import { formatPrice, formatDuration } from '@/utils/format';
import { Skeleton } from '@/components/ui/skeleton';

export function ExtraServicesSelector() {
  const { selectedExtras, toggleExtra } = useBookingStore();
  const [hoveredInfo, setHoveredInfo] = useState<number | null>(null);

  const { data: extras, isLoading } = useQuery({
    queryKey: ['extra-services'],
    queryFn: serviceApi.getExtraServices,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-gray-500 mb-3">Выберите дополнительные услуги (необязательно)</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {extras?.map((extra) => {
          const isSelected = selectedExtras.some((e) => e.id === extra.id);
          return (
            <div
              key={extra.id}
              onClick={() => toggleExtra(extra)}
              className={`cursor-pointer flex items-center justify-between rounded-lg border-2 p-3 transition-all duration-150 relative ${
                isSelected
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-300'
              }`}
            >
              <div className="flex-1 min-w-0 pr-2">
                <p className="text-sm font-medium text-gray-900">{extra.service_name}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <p className="text-xs text-blue-600 font-semibold">{formatPrice(extra.price)}</p>
                  {extra.duration_minutes > 0 && (
                    <span className="flex items-center gap-0.5 text-xs text-gray-400">
                      <Clock className="h-3 w-3" />
                      {formatDuration(extra.duration_minutes)}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Иконка ℹ️ с тултипом при наведении */}
                {extra.description && (
                  <div
                    className="relative"
                    onMouseEnter={(e) => { e.stopPropagation(); setHoveredInfo(extra.id); }}
                    onMouseLeave={() => setHoveredInfo(null)}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Info className="h-4 w-4 text-blue-400 cursor-help" />
                    {hoveredInfo === extra.id && (
                      <div className="absolute bottom-full right-0 mb-2 w-56 z-50 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl pointer-events-none">
                        {extra.description}
                        <div className="absolute top-full right-2 border-4 border-transparent border-t-gray-900" />
                      </div>
                    )}
                  </div>
                )}

                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  isSelected ? 'bg-blue-600' : 'bg-gray-100'
                }`}>
                  {isSelected
                    ? <Check className="h-3.5 w-3.5 text-white" />
                    : <Plus className="h-3.5 w-3.5 text-gray-400" />}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {selectedExtras.length > 0 && (
        <p className="text-sm text-gray-600 mt-3">
          Доп. услуги: <span className="font-semibold text-blue-600">
            {formatPrice(selectedExtras.reduce((sum, e) => sum + e.price, 0))}
          </span>
        </p>
      )}
    </div>
  );
}
