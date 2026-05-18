import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/auth.store';
import { useBookingStore, type WashType } from '@/store/booking.store';
import { ServiceSelector } from '@/components/booking/ServiceSelector';
import { DatePickerCalendar } from '@/components/booking/DatePickerCalendar';
import { SlotGrid } from '@/components/booking/SlotGrid';
import { ExtraServicesSelector } from '@/components/booking/ExtraServicesSelector';
import { BookingConfirmModal } from '@/components/booking/BookingConfirmModal';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Hand, Bot } from 'lucide-react';
import { formatPrice, formatDuration } from '@/utils/format';

function StepHeader({ step, label, completed }: { step: number; label: string; completed: boolean }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${completed ? 'bg-green-100 text-green-700' : 'bg-blue-600 text-white'
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

// Статичные круги на фоне (позиции по бокам, но ближе к центру)
const bubbles = [
  // Левая сторона
  { size: 380, top: -50, left: '2%' },
  { size: 180, top: 350, left: '5%' },
  { size: 320, top: 580, left: '0%' },
  { size: 140, top: 850, left: '8%' },
  { size: 160, top: 1100, left: '3%' },
  { size: 240, top: 1400, left: '6%' },
  { size: 190, top: 1620, left: '1%' },
  { size: 130, top: 2050, left: '7%' },
  { size: 210, top: 2200, left: '0%' },
  { size: 300, top: 2650, left: '4%' },
  { size: 150, top: 2850, left: '2%' },
  { size: 120, top: 3250, left: '6%' },
  { size: 270, top: 3550, left: '1%' },
  { size: 200, top: 4050, left: '5%' },
  { size: 350, top: 4450, left: '0%' },

  // Правая сторона
  { size: 260, top: 20, right: '15%' },
  { size: 200, top: 420, right: '12%' },
  { size: 280, top: 920, right: '0%' },
  { size: 110, top: 1250, right: '8%' },
  { size: 240, top: 1400, right: '3%' },
  { size: 350, top: 1850, right: '6%' },
  { size: 170, top: 2450, right: '1%' },
  { size: 260, top: 3050, right: '7%' },
  { size: 220, top: 3450, right: '0%' },
  { size: 160, top: 3750, right: '4%' },
  { size: 280, top: 250, right: '2%' },
  { size: 200, top: 650, right: '6%' },
  { size: 340, top: 2050, right: '1%' },
  { size: 180, top: 2650, right: '5%' },
  { size: 300, top: 4250, right: '0%' },
];

export function BookingPage() {
  const { isAuthenticated } = useAuthStore();
  const {
    washType,
    setWashType,
    selectedService,
    selectedDate,
    selectedSlot,
    selectedExtras,
    isSlotConflict,
    carInfo,
    setCarInfo,
  } = useBookingStore();
  const [modalOpen, setModalOpen] = useState(false);

  // Confirm requires: service, date, slot, car info, and no conflict
  const canConfirm = !!selectedService && !!selectedDate && !!selectedSlot && carInfo.trim().length > 0 && !isSlotConflict;

  // If conflict is due to extra services — tell user specifically
  const conflictFromExtras = isSlotConflict && selectedExtras.length > 0;

  // Totals for button display
  const extrasTotal = selectedExtras.reduce((sum, e) => sum + (e.price ?? 0), 0);
  const totalPrice = (selectedService?.price ?? 0) + extrasTotal;
  const extrasDuration = selectedExtras.reduce((sum, e) => sum + (e.duration_minutes ?? 0), 0);
  const totalDuration = (selectedService?.duration_minutes ?? 0) + extrasDuration;

  const confirmButtonLabel = isSlotConflict
    ? (conflictFromExtras ? 'Не подходит по времени' : 'Измените время или услугу')
    : selectedSlot && selectedService
    ? `Подтвердить · ${formatPrice(totalPrice)} · ${formatDuration(totalDuration)}`
    : 'Перейти к подтверждению →';

  const generatePlate = () => {
    const chars = "АВЕКМНОРСТУХ";
    const nums = Math.floor(100 + Math.random() * 900);
    const region = Math.floor(10 + Math.random() * 89);
    const randomChar = () => chars[Math.floor(Math.random() * chars.length)];
    setCarInfo(`${randomChar()}${nums}${randomChar()}${randomChar()}${region}`);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-slate-50 to-white">

      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {bubbles.map((b, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: b.size,
              height: b.size,
              top: b.top,
              left: (b as any).left,
              right: (b as any).right,
              opacity: 0.8,
              background: 'radial-gradient(circle at 35% 35%, #60a5fa 0%, #2563eb 70%, #1e3a8a 100%)',
              boxShadow: '0 0 15px rgba(59, 130, 246, 0.15)',
            }}
          />
        ))}
      </div>

      <div className="relative z-10 container max-w-4xl py-10">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Запись на мойку</h1>
          <p className="text-gray-500 mb-8">Выберите тип мойки, услугу, дату и время</p>
        </motion.div>

        <div className="space-y-6">
          <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05, duration: 0.2 }}
            className="bg-white/90 backdrop-blur-sm rounded-2xl border p-6 shadow-sm">
            <StepHeader step={1} label="Тип мойки" completed={!!washType} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {washTypeCards.map((card) => {
                const isSelected = washType === card.type;
                return (
                  <motion.div key={card.type} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="h-full">
                    <div
                      onClick={() => setWashType(card.type)}
                      className={`h-full cursor-pointer rounded-xl border-2 p-5 transition-all duration-150 ${isSelected
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

          {washType && (
            <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
              className="bg-white/90 backdrop-blur-sm rounded-2xl border p-6 shadow-sm">
              <StepHeader step={2} label="Выберите услугу" completed={!!selectedService} />
              <ServiceSelector washType={washType} />
            </motion.section>
          )}

          {washType && selectedService && (
            <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
              className="bg-white/90 backdrop-blur-sm rounded-2xl border p-6 shadow-sm">
              <StepHeader step={3} label="Дата и время" completed={!!(selectedDate && selectedSlot && !isSlotConflict)} />
              {selectedSlot && isSlotConflict && (
                <div className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
                  <span className="text-amber-500 mt-0.5">⚠️</span>
                  <span>
                    Для услуги <b>«{selectedService.service_name}»</b> ({selectedService.duration_minutes} мин.) недостаточно последовательных свободных слотов.
                    Выберите другое время или другую услугу.
                  </span>
                </div>
              )}
              <div className="flex flex-col lg:flex-row gap-6">
                <div><DatePickerCalendar /></div>
                <div className="flex-1">
                  <SlotGrid washType={washType} />
                </div>
              </div>
            </motion.section>
          )}

          {washType === 'manual' && selectedSlot && (
            <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
              className="bg-white/90 backdrop-blur-sm rounded-2xl border p-6 shadow-sm">
              <StepHeader step={4} label="Дополнительные услуги" completed={false} />
              {isSlotConflict && conflictFromExtras && (
                <div className="mb-3 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                  <span>⚠️</span>
                  <span>Выбранные доп. услуги увеличивают время — слотов подряд не хватает. Уберите некоторые услуги или выберите другое время.</span>
                </div>
              )}
              <ExtraServicesSelector />
            </motion.section>
          )}

          {selectedSlot && !isSlotConflict && (
            <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
              className="bg-white/90 backdrop-blur-sm rounded-2xl border p-6 shadow-sm">
              <StepHeader step={washType === 'manual' ? 5 : 4} label="Информация об авто" completed={carInfo.trim().length > 0} />
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

          <div className="flex justify-end">
            {!isAuthenticated ? (
              <div className="text-right">
                <p className="text-sm text-gray-500 mb-2">Для записи необходимо войти в аккаунт</p>
                <Button asChild><Link to="/login">Войти для записи</Link></Button>
              </div>
            ) : (
              <div className="flex flex-col items-end gap-1">
                <Button
                  size="lg"
                  disabled={!canConfirm}
                  onClick={() => setModalOpen(true)}
                  className={`px-8 transition-all ${isSlotConflict ? 'bg-gray-400 hover:bg-gray-400 cursor-not-allowed' : ''}`}
                  id="booking-confirm-btn"
                >
                  {confirmButtonLabel}
                </Button>
                {isSlotConflict && (
                  <p className="text-xs text-amber-600">Выберите другое время или измените услугу</p>
                )}
              </div>
            )}
          </div>
        </div>

        <BookingConfirmModal open={modalOpen} onOpenChange={setModalOpen} />
      </div>
    </div>
  );
}
