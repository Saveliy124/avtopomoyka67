import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { bookingApi } from '@/api/booking.api';
import { boxApi } from '@/api/box.api';
import { serviceApi } from '@/api/service.api';
import { slotApi } from '@/api/slot.api';
import { formatPrice } from '@/utils/format';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageLoader } from '@/components/shared/LoadingSpinner';

export function BookingsPanel() {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [selectedBoxId, setSelectedBoxId] = useState<number | null>(null);
  
  // Create Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [formValues, setFormValues] = useState({ client_name: '', car_info: '', service_id: '' });

  // Details Modal
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);

  // Demo Generation
  const [demoLoad, setDemoLoad] = useState('50');
  const [isGenerating, setIsGenerating] = useState(false);

  // Queries
  const { data: boxes } = useQuery({ queryKey: ['boxes-all'], queryFn: () => boxApi.getBoxes() });
  const { data: services } = useQuery({ queryKey: ['services'], queryFn: serviceApi.getServices });
  const { data: slots, isLoading: isLoadingSlots } = useQuery({
    queryKey: ['slots', selectedDate, selectedBoxId],
    queryFn: () => slotApi.getSlots({ date: selectedDate, boxId: selectedBoxId! }),
    enabled: !!selectedDate && !!selectedBoxId,
  });
  const { data: bookings } = useQuery({ queryKey: ['bookings'], queryFn: bookingApi.getMyBookings });

  const activeBox = boxes?.find(b => b.id === selectedBoxId);
  const boxServices = services?.filter(s => s.wash_type === activeBox?.wash_type);

  // Select first active box by default
  if (!selectedBoxId && boxes && boxes.length > 0) {
    const active = boxes.find(b => b.is_active);
    if (active) setSelectedBoxId(active.id);
  }

  const cancelMutation = useMutation({
    mutationFn: bookingApi.cancelBooking,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['slots'] });
      toast.success('Запись отменена');
      setDetailsModalOpen(false);
    },
    onError: () => toast.error('Ошибка отмены'),
  });

  const createMutation = useMutation({
    mutationFn: bookingApi.adminCreateBooking,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['slots'] });
      toast.success('Запись создана');
      setCreateModalOpen(false);
      setFormValues({ client_name: '', car_info: '', service_id: '' });
    },
    onError: () => toast.error('Ошибка создания'),
  });

  const generateDemo = async () => {
    if (!selectedBoxId) return;
    setIsGenerating(true);
    try {
      await bookingApi.generateTestBookings({ date: selectedDate, load_percentage: Number(demoLoad), box_id: selectedBoxId });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['slots'] });
      toast.success('Тестовые данные сгенерированы');
    } catch (e) {
      toast.error('Ошибка генерации');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSlotClick = (slot: any) => {
    if (slot.is_available) {
      setSelectedSlot(slot);
      setCreateModalOpen(true);
    } else {
      // Find booking for this slot
      const slotTime = new Date(slot.appointment_time).getTime();
      const b = bookings?.find(bk => {
        const bkTime = new Date(bk.appointment_time).getTime();
        return bkTime === slotTime && bk.box_id === selectedBoxId && bk.status !== 'cancelled';
      });
      if (b) {
        setSelectedBooking(b);
        setDetailsModalOpen(true);
      }
    }
  };

  const submitCreate = () => {
    if (!formValues.service_id || !formValues.client_name) {
      toast.error('Заполните все поля');
      return;
    }
    createMutation.mutate({
      schedule_id: selectedSlot.id,
      service_id: Number(formValues.service_id),
      box_id: selectedBoxId,
      car_info: formValues.car_info,
      client_name: formValues.client_name,
      appointment_time: selectedSlot.appointment_time
    });
  };

  return (
    <div className="space-y-6">
      {/* Header controls */}
      <div className="flex flex-col md:flex-row gap-4 items-end justify-between bg-white p-4 rounded-xl border">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Дата</label>
            <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-auto h-9" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Бокс</label>
            <select 
              value={selectedBoxId || ''} 
              onChange={e => setSelectedBoxId(Number(e.target.value))}
              className="h-9 rounded-md border border-gray-300 px-3 text-sm min-w-[120px]"
            >
              {boxes?.filter(b => b.is_active).map(b => (
                <option key={b.id} value={b.id}>Бокс {b.box_number} ({b.wash_type === 'robot' ? 'Робот' : 'Ручная'})</option>
              ))}
            </select>
          </div>
        </div>

        {/* Demo data generation */}
        <div className="flex items-end gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
          <div>
            <label className="text-[10px] text-gray-500 mb-0.5 block">Загрузка %</label>
            <select value={demoLoad} onChange={e => setDemoLoad(e.target.value)} className="h-8 rounded-md border border-gray-300 px-2 text-xs">
              <option value="30">30%</option>
              <option value="50">50%</option>
              <option value="80">80%</option>
              <option value="100">100%</option>
            </select>
          </div>
          <Button size="sm" variant="secondary" className="h-8 text-xs" onClick={generateDemo} disabled={isGenerating}>
            {isGenerating ? 'Генерация...' : 'Заполнить демо-данными'}
          </Button>
        </div>
      </div>

      {/* Slots Grid */}
      <Card>
        <CardContent className="p-6">
          <h3 className="font-semibold mb-4 text-gray-800">
            Расписание: {format(new Date(selectedDate), 'dd.MM.yyyy')} — Бокс {activeBox?.box_number}
          </h3>
          
          {isLoadingSlots ? (
            <PageLoader />
          ) : !slots?.length ? (
            <p className="text-sm text-gray-400">Нет доступных слотов или бокс отключен.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
              {slots.map(slot => {
                const time = new Date(slot.appointment_time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                return (
                  <button
                    key={slot.id}
                    onClick={() => handleSlotClick(slot)}
                    className={`h-12 rounded-lg text-sm font-medium transition-all ${
                      slot.is_available 
                        ? 'bg-blue-50 text-blue-700 hover:bg-blue-100 hover:shadow-sm border border-blue-100'
                        : 'bg-red-50 text-red-700 border border-red-100 cursor-pointer hover:bg-red-100'
                    }`}
                  >
                    {time}
                    <div className="text-[10px] opacity-70 mt-0.5">
                      {slot.is_available ? 'Свободно' : 'Занято'}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Booking Modal */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Создать запись вручную</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-600">
              Время: <span className="font-semibold">{selectedSlot && new Date(selectedSlot.appointment_time).toLocaleString('ru-RU')}</span>
            </p>
            <div>
              <label className="text-xs text-gray-600 block mb-1">Имя клиента</label>
              <Input value={formValues.client_name} onChange={e => setFormValues(s => ({...s, client_name: e.target.value}))} placeholder="Иван Иванов" />
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1">Услуга</label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {boxServices?.map(s => (
                  <div 
                    key={s.id} 
                    onClick={() => setFormValues(prev => ({...prev, service_id: s.id.toString()}))}
                    className={`p-3 rounded-lg border cursor-pointer text-center transition-all ${
                      formValues.service_id === s.id.toString() 
                        ? 'border-blue-500 bg-blue-50 shadow-sm' 
                        : 'border-gray-200 hover:border-blue-200'
                    }`}
                  >
                    <p className="text-sm font-semibold">{s.service_name}</p>
                    <p className="text-xs text-blue-600 mt-1">{formatPrice(s.price)}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1">Автомобиль (Гос. номер)</label>
              <Input value={formValues.car_info} onChange={e => setFormValues(s => ({...s, car_info: e.target.value}))} placeholder="А123БВ77" />
            </div>
            <Button className="w-full" onClick={submitCreate} disabled={createMutation.isPending}>
              Записать
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Booking Details Modal */}
      <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Информация о записи</DialogTitle>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2 mb-2">
                <StatusBadge status={selectedBooking.status} />
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 text-xs">Клиент</p>
                  <p className="font-semibold">{selectedBooking.client_name}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Автомобиль</p>
                  <p className="font-semibold">{selectedBooking.car_info || '—'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-500 text-xs">Услуга</p>
                  <p className="font-semibold">{selectedBooking.service_name}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-500 text-xs">Стоимость</p>
                  <p className="font-semibold text-blue-600">{formatPrice(selectedBooking.price)}</p>
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setDetailsModalOpen(false)}>
                  Закрыть
                </Button>
                {selectedBooking.status === 'confirmed' && (
                  <Button 
                    variant="destructive" 
                    className="flex-1" 
                    onClick={() => cancelMutation.mutate(selectedBooking.id)}
                    disabled={cancelMutation.isPending}
                  >
                    Отменить запись
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
