import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Check, Clock, Info } from 'lucide-react';
import { serviceApi } from '@/api/service.api';
import { useBookingStore } from '@/store/booking.store';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatPrice, formatDuration } from '@/utils/format';
import type { WashType } from '@/store/booking.store';

export function ServiceSelector({ washType }: { washType: WashType }) {
  const { selectedService, setSelectedService } = useBookingStore();
  const [hoveredInfo, setHoveredInfo] = useState<number | null>(null);

  const { data: allServices, isLoading } = useQuery({
    queryKey: ['services'],
    queryFn: serviceApi.getServices,
  });

  const services = allServices?.filter((s) => s.wash_type === washType) ?? [];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {services.map((service) => {
        const isSelected = selectedService?.id === service.id;
        return (
          <motion.div key={service.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Card
              onClick={() => setSelectedService(service)}
              className={`cursor-pointer p-4 relative transition-all duration-150 ${
                isSelected
                  ? 'border-blue-500 border-2 bg-blue-50 shadow-blue-100 shadow-md'
                  : 'hover:border-blue-300 hover:shadow-sm'
              }`}
            >
              {isSelected && (
                <div className="absolute top-2 right-2 rounded-full bg-blue-600 p-0.5">
                  <Check className="h-3 w-3 text-white" />
                </div>
              )}
              <h3 className="font-semibold text-gray-900 mb-1 pr-6">{service.service_name}</h3>
              <p className="text-xl font-bold text-blue-600">{formatPrice(service.price)}</p>
              <div className="flex items-center gap-1 text-gray-500 text-sm mt-1">
                <Clock className="h-3.5 w-3.5" />
                {formatDuration(service.duration_minutes)}
              </div>

              {/* Иконка ℹ️ с тултипом при наведении */}
              {service.description && (
                <div
                  className="absolute bottom-2 right-2"
                  onMouseEnter={(e) => { e.stopPropagation(); setHoveredInfo(service.id); }}
                  onMouseLeave={() => setHoveredInfo(null)}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Info className="h-4 w-4 text-blue-400 cursor-help" />
                  {hoveredInfo === service.id && (
                    <div className="absolute bottom-full right-0 mb-2 w-56 z-50 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl pointer-events-none">
                      {service.description}
                      {/* Стрелочка */}
                      <div className="absolute top-full right-2 border-4 border-transparent border-t-gray-900" />
                    </div>
                  )}
                </div>
              )}
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
