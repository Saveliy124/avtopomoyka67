import { DayPicker } from 'react-day-picker';
import { ru } from 'date-fns/locale';
import { useBookingStore } from '@/store/booking.store';
import 'react-day-picker/dist/style.css';

export function DatePickerCalendar() {
  const { selectedDate, setSelectedDate } = useBookingStore();

  return (
    <div className="rounded-xl border bg-white p-2 inline-block shadow-sm">
      <DayPicker
        mode="single"
        selected={selectedDate ?? undefined}
        onSelect={(day) => setSelectedDate(day ?? null)}
        disabled={{ before: new Date() }}
        locale={ru}
        showOutsideDays={false}
        className="!m-0"
        classNames={{
          day_selected: '!bg-blue-600 !text-white',
          day_today: 'font-bold text-blue-600',
          day_disabled: 'text-gray-300 cursor-not-allowed',
        }}
      />
    </div>
  );
}
