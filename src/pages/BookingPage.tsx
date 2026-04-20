import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/auth.store';
import { useBookingStore, type WashType } from '@/store/booking.store';
import { ServiceSelector } from '@/components/booking/ServiceSelector';
import { BoxSelector } from '@/components/booking/BoxSelector';
import { DatePickerCalendar } from '@/components/booking/DatePickerCalendar';
import { SlotGrid } from '@/components/booking/SlotGrid';
import { ExtraServicesSelector } from '@/components/booking/ExtraServicesSelector';
import { BookingConfirmModal } from '@/components/booking/BookingConfirmModal';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Hand, Bot } from 'lucide-react';

function StepHeader({ step, label, completed }: { step: number; label: string; completed: boolean }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
        completed ? 'bg-green-100 text-green-700' : 'bg-blue-600 text-white'
      }`}>
        {completed ? '✓' : step}
      </div>
      <h2 className="text-lg font-semibold text-gray-900">{label}</h2>
    </div>
  );
}

const washTypeCards: { type: WashType; icon: React.ReactNode; title: string; desc: string }[] = [
  {
    type: 'manual',
    icon: <Hand className="h-8 w-8" />,
    title: 'Ручная мойка',
    desc: 'Классическая мойка руками. Доп. услуги: полировка, химчистка и др. Слоты каждые 30 мин.',
  },
  {
    type: 'robot',
    icon: <Bot className="h-8 w-8" />,
    title: 'Робот',
    desc: 'Быстрая автоматическая мойка. Слоты каждые 15 мин.',
  },
];

export function BookingPage() {
  const { isAuthenticated } = useAuthStore();
  const { washType, setWashType, selectedService, selectedBox, selectedDate, selectedSlot, carInfo, setCarInfo } = useBookingStore();
  const [modalOpen, setModalOpen] = useState(false);

  const canConfirm = selectedService && selectedBox && selectedDate && selectedSlot && carInfo.trim().length > 0;

  const generatePlate = () => {
    const chars = "АВЕКМНОРСТУХ";
    const nums = Math.floor(100 + Math.random() * 900);
    const region = Math.floor(10 + Math.random() * 89);
    const randomChar = () => chars[Math.floor(Math.random() * chars.length)];
    setCarInfo(`${randomChar()}${nums}${randomChar()}${randomChar()}${region}`);
  };

  return (
    <div className="container max-w-3xl py-10">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Запись на мойку</h1>
        <p className="text-gray-500 mb-8">Выберите тип мойки, услугу, бокс, дату и время</p>
      </motion.div>

      <div className="space-y-6">
        {/* Step 0: Wash Type */}
        <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05, duration: 0.2 }}
          className="bg-white rounded-2xl border p-6 shadow-sm">
          <StepHeader step={1} label="Тип мойки" completed={!!washType} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {washTypeCards.map((card) => {
              const isSelected = washType === card.type;
              return (
                <motion.div key={card.type} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="h-full">
                  <div
                    onClick={() => setWashType(card.type)}
                    className={`h-full cursor-pointer rounded-xl border-2 p-5 transition-all duration-150 ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 shadow-md shadow-blue-100'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <div className={`mb-3 ${isSelected ? 'text-blue-600' : 'text-gray-400'}`}>{card.icon}</div>
                    <h3 className="font-bold text-gray-900 mb-1">{card.title}</h3>
                    <p className="text-sm text-gray-500">{card.desc}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.section>

        {/* Step 1: Service */}
        {washType && (
          <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
            className="bg-white rounded-2xl border p-6 shadow-sm">
            <StepHeader step={2} label="Выберите услугу" completed={!!selectedService} />
            <ServiceSelector washType={washType} />
          </motion.section>
        )}

        {/* Step 2: Box */}
        {washType && selectedService && (
          <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
            className="bg-white rounded-2xl border p-6 shadow-sm">
            <StepHeader step={3} label="Выберите бокс" completed={!!selectedBox} />
            <BoxSelector washType={washType} />
          </motion.section>
        )}

        {/* Step 3: Date & Slots */}
        {selectedBox && (
          <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
            className="bg-white rounded-2xl border p-6 shadow-sm">
            <StepHeader step={4} label="Дата и время" completed={!!(selectedDate && selectedSlot)} />
            <div className="flex flex-col lg:flex-row gap-6">
              <div><DatePickerCalendar /></div>
              <div className="flex-1"><SlotGrid /></div>
            </div>
          </motion.section>
        )}

        {/* Step 4.5: Extra services (manual wash only) */}
        {washType === 'manual' && selectedSlot && (
          <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
            className="bg-white rounded-2xl border p-6 shadow-sm">
            <StepHeader step={5} label="Дополнительные услуги" completed={false} />
            <ExtraServicesSelector />
          </motion.section>
        )}

        {/* Step 5: Car info */}
        {selectedSlot && (
          <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
            className="bg-white rounded-2xl border p-6 shadow-sm">
            <StepHeader step={washType === 'manual' ? 6 : 5} label="Информация об авто" completed={carInfo.trim().length > 0} />
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Гос. номер <span className="text-red-500">* (Обязательно)</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={carInfo}
                  onChange={(e) => setCarInfo(e.target.value)}
                  placeholder="Например: А123БВ77"
                  className="w-full h-10 rounded-lg border border-gray-300 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                />
                <Button variant="outline" onClick={generatePlate} className="shrink-0 h-10">Сгенерировать</Button>
              </div>
            </div>
          </motion.section>
        )}

        {/* Confirm button */}
        <div className="flex justify-end">
          {!isAuthenticated ? (
            <div className="text-right">
              <p className="text-sm text-gray-500 mb-2">Для записи необходимо войти в аккаунт</p>
              <Button asChild><Link to="/login">Войти для записи</Link></Button>
            </div>
          ) : (
            <Button size="lg" disabled={!canConfirm} onClick={() => setModalOpen(true)} className="px-8">
              Перейти к подтверждению →
            </Button>
          )}
        </div>
      </div>

      <BookingConfirmModal open={modalOpen} onOpenChange={setModalOpen} />
    </div>
  );
}
