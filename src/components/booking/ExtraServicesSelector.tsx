import { useQuery } from '@tanstack/react-query';
import { Check, Plus } from 'lucide-react';
import { serviceApi } from '@/api/service.api';
import { useBookingStore } from '@/store/booking.store';
import { formatPrice } from '@/utils/format';
import { Skeleton } from '@/components/ui/skeleton';

export function ExtraServicesSelector() {
  const { selectedExtras, toggleExtra } = useBookingStore();

  const { data: extras, isLoading } = useQuery({
    queryKey: ['extra-services'],
    queryFn: serviceApi.getExtraServices,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
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
              className={`cursor-pointer flex items-center justify-between rounded-lg border-2 p-3 transition-all duration-150 ${
                isSelected
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-300'
              }`}
            >
              <div>
                <p className="text-sm font-medium text-gray-900">{extra.service_name}</p>
                <p className="text-xs text-blue-600 font-semibold">{formatPrice(extra.price)}</p>
              </div>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                isSelected ? 'bg-blue-600' : 'bg-gray-100'
              }`}>
                {isSelected
                  ? <Check className="h-3.5 w-3.5 text-white" />
                  : <Plus className="h-3.5 w-3.5 text-gray-400" />}
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
