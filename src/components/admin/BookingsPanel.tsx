import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, addDays, subDays, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { Settings, Check, CalendarPlus, ChevronLeft, ChevronRight, Edit } from 'lucide-react';
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
  
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [formValues, setFormValues] = useState({ client_name: '', car_info: '', service_id: '' });
  const [selectedExtraIds, setSelectedExtraIds] = useState<number[]>([]);

  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);

  const [demoLoad, setDemoLoad] = useState('50');
  const [isGenerating, setIsGenerating] = useState(false);

  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [isGeneratingDay, setIsGeneratingDay] = useState(false);

  const [isScheduleSettingsOpen, setIsScheduleSettingsOpen] = useState(false);
  const [scheduleStartHour, setScheduleStartHour] = useState('09:00');
  const [scheduleEndHour, setScheduleEndHour] = useState('00:00');

  const handlePrevDay = () => setSelectedDate(format(subDays(parseISO(selectedDate), 1), 'yyyy-MM-dd'));
  const handleNextDay = () => setSelectedDate(format(addDays(parseISO(selectedDate), 1), 'yyyy-MM-dd'));


  const { data: boxes } = useQuery({ queryKey: ['boxes-all'], queryFn: () => boxApi.getBoxes() });
  const { data: services } = useQuery({ queryKey: ['services'], queryFn: serviceApi.getServices });
  const { data: extraServices } = useQuery({ queryKey: ['extra-services'], queryFn: serviceApi.getExtraServices });
  const { data: slots, isLoading: isLoadingSlots } = useQuery({
    queryKey: ['slots', selectedDate, selectedBoxId],
    queryFn: () => slotApi.getSlots({ date: selectedDate, boxId: selectedBoxId! }),
    enabled: !!selectedDate && !!selectedBoxId,
  });
  const { data: bookings } = useQuery({ queryKey: ['bookings'], queryFn: bookingApi.getMyBookings });

  const activeBox = boxes?.find(b => b.id === selectedBoxId);
  const boxServices = services?.filter(s => s.wash_type === activeBox?.wash_type);
  // Доп. услуги доступны только для ручной мойки
  const showExtras = activeBox?.wash_type === 'manual';

  const toggleExtraId = (id: number) =>
    setSelectedExtraIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const maintenanceMutation = useMutation({
    mutationFn: (data: { ids: number[], is_maintenance: boolean }) => slotApi.bulkUpdateStatus(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slots'] });
      toast.success('Статус ячеек обновлен');
    },
    onError: () => toast.error('Ошибка обновления статуса'),
  });


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

  const generateDaySchedule = async () => {
    setIsGeneratingDay(true);
    try {
      const startH = parseInt(scheduleStartHour.split(':')[0], 10);
      const endH = scheduleEndHour === '00:00' ? 24 : parseInt(scheduleEndHour.split(':')[0], 10);

      const result = await slotApi.generateDaySlots({ date: selectedDate, startHour: startH, endHour: endH });
      queryClient.invalidateQueries({ queryKey: ['slots'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      toast.success(`Расписание обновлено: ${result.slots_created} слотов для ${result.boxes_count} боксов`);
      setIsScheduleSettingsOpen(false);
    } catch (e) {
      toast.error('Ошибка создания/обновления расписания');
    } finally {
      setIsGeneratingDay(false);
    }
  };

  const handleSlotClick = (slot: any) => {
    if (isMaintenanceMode) {
      maintenanceMutation.mutate({ 
        ids: [slot.id], 
        is_maintenance: !slot.is_maintenance 
      });
      return;
    }

    if (slot.is_maintenance) {
      toast.info('На этой ячейке проводятся тех. работы');
      return;
    }

    // Ищем бронирование, которое занимает этот слот (как основное или дополнительное)
    const b = bookings?.find(bk => 
      bk.box_id === selectedBoxId && 
      bk.status !== 'cancelled' && 
      bk.status !== 'cancelled_tech' &&
      (bk.schedule_id === slot.id || bk.extra_schedule_ids?.includes(slot.id))
    );

    if (b) {
      setSelectedBooking(b);
      setDetailsModalOpen(true);
      return;
    }

    const isPastUnavailable = new Date(slot.appointment_time).getTime() < Date.now() && !slot.is_available;
    if (isPastUnavailable) {
      toast.info('Недоступно: время уже прошло');
      return;
    }

    if (slot.is_available) {
      setSelectedSlot(slot);
      setCreateModalOpen(true);
    } else {
      // Слот закрыт (прошедшее время или занят вручную), но записи нет — admin может занять
      setSelectedSlot(slot);
      setCreateModalOpen(true);
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
      appointment_time: selectedSlot.appointment_time,
      extra_service_ids: selectedExtraIds,
    });
  };

  const handleCreateModalClose = (open: boolean) => {
    setCreateModalOpen(open);
    if (!open) setSelectedExtraIds([]);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-end justify-between bg-white p-4 rounded-xl border">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex flex-col">
            <label className="text-xs text-gray-500 mb-1 block">Дата</label>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={handlePrevDay}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-auto h-9" />
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={handleNextDay}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
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
          
          <Button 
            variant={isMaintenanceMode ? "destructive" : "outline"}
            size="sm"
            className="h-9 gap-2"
            onClick={() => setIsMaintenanceMode(!isMaintenanceMode)}
          >
            <Settings className={`h-4 w-4 ${isMaintenanceMode ? 'animate-spin' : ''}`} />
            {isMaintenanceMode ? "Выход из режима тех. работ" : "Режим тех. работ"}
          </Button>

          {/* Create / Edit Day Schedule button */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              className={`h-9 gap-2 ${slots && slots.length > 0 ? 'border-blue-300 text-blue-700 hover:bg-blue-50' : 'border-green-300 text-green-700 hover:bg-green-50'}`}
              onClick={() => setIsScheduleSettingsOpen(!isScheduleSettingsOpen)}
              title="Настройки расписания на этот день"
            >
              {slots && slots.length > 0 ? <Edit className="h-4 w-4" /> : <CalendarPlus className="h-4 w-4" />}
              {slots && slots.length > 0 ? 'Редактировать расписание' : 'Создать расписание на день'}
            </Button>
            
            {isScheduleSettingsOpen && (
              <div className="absolute top-full left-0 mt-2 p-3 bg-white border border-slate-200 shadow-xl rounded-lg z-50 min-w-[250px] flex flex-col gap-3">
                <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Параметры смены</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-1">Начало</label>
                    <select value={scheduleStartHour} onChange={e => setScheduleStartHour(e.target.value)} className="w-full text-xs h-8 border rounded px-1">
                      {Array.from({ length: 24 }).map((_, i) => {
                        const h = i.toString().padStart(2, '0') + ':00';
                        return <option key={h} value={h}>{h}</option>;
                      })}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-1">Конец</label>
                    <select value={scheduleEndHour} onChange={e => setScheduleEndHour(e.target.value)} className="w-full text-xs h-8 border rounded px-1">
                      {Array.from({ length: 24 }).map((_, i) => {
                        const h = i === 0 ? '00:00' : i.toString().padStart(2, '0') + ':00';
                        return <option key={h} value={h}>{h}</option>;
                      })}
                    </select>
                  </div>
                </div>
                <Button size="sm" onClick={generateDaySchedule} disabled={isGeneratingDay} className="w-full mt-1">
                  {isGeneratingDay ? 'Генерация...' : 'Применить'}
                </Button>
              </div>
            )}
          </div>
        </div>


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

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">
              Расписание: {format(new Date(selectedDate), 'dd.MM.yyyy')} — Бокс {activeBox?.box_number}
            </h3>
            {isMaintenanceMode && (
              <span className="text-xs font-bold text-red-600 animate-pulse uppercase tracking-wider bg-red-50 px-2 py-1 rounded">
                Режим редактирования (тех. работы)
              </span>
            )}
          </div>

          
          {isLoadingSlots ? (
            <PageLoader />
          ) : !slots?.length ? (
            <p className="text-sm text-gray-400">Нет доступных слотов или бокс отключен.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
              {slots.map(slot => {
                const time = new Date(slot.appointment_time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                const isMaintenance = slot.is_maintenance;
                
                // Ищем бронирование для этой ячейки
                const b = bookings?.find(bk => 
                  bk.box_id === selectedBoxId && 
                  bk.status !== 'cancelled' && 
                  bk.status !== 'cancelled_tech' &&
                  (bk.schedule_id === slot.id || bk.extra_schedule_ids?.includes(slot.id))
                );
                const isPastUnavailable =
                  new Date(slot.appointment_time).getTime() < Date.now() && !slot.is_available && !b && !isMaintenance;

                return (
                  <button
                    key={slot.id}
                    onClick={() => handleSlotClick(slot)}
                    disabled={isPastUnavailable && !isMaintenanceMode}
                    className={`h-16 rounded-lg text-sm font-medium transition-all relative ${
                      isMaintenance
                        ? 'bg-red-50 text-red-300 border border-red-200 opacity-60 hover:opacity-80'
                        : b
                        ? 'bg-amber-50 text-amber-900 border border-amber-200 shadow-sm hover:bg-amber-100'
                        : isPastUnavailable
                        ? 'bg-gray-50 text-gray-400 border border-gray-200 cursor-not-allowed'
                        : slot.is_available
                        ? 'bg-blue-50 text-blue-700 hover:bg-blue-100 hover:shadow-sm border border-blue-100'
                        : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-pointer hover:bg-gray-200'
                    }`}
                  >
                    {time}
                    <div className={`text-[10px] mt-0.5 ${isMaintenance ? 'text-red-300' : 'opacity-70'}`}>
                      {isMaintenance ? 'Тех. работы' : b ? (b.client_name || 'Занято') : isPastUnavailable ? 'Недоступно' : slot.is_available ? 'Свободно' : 'Занято'}
                    </div>
                  </button>
                );
              })}

            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={createModalOpen} onOpenChange={handleCreateModalClose}>
        <DialogContent className="max-w-lg">
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

            {/* Доп. услуги — только для ручной мойки */}
            {showExtras && extraServices && extraServices.length > 0 && (
              <div>
                <label className="text-xs text-gray-600 block mb-2">Дополнительные услуги (необязательно)</label>
                <div className="grid grid-cols-2 gap-2">
                  {extraServices.map(ex => {
                    const isOn = selectedExtraIds.includes(ex.id);
                    return (
                      <div
                        key={ex.id}
                        onClick={() => toggleExtraId(ex.id)}
                        className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all ${
                          isOn ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-200'
                        }`}
                      >
                        <div>
                          <p className="text-xs font-medium text-gray-800">{ex.service_name}</p>
                          <p className="text-xs text-blue-600">{formatPrice(ex.price)}</p>
                        </div>
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                          isOn ? 'bg-blue-600' : 'bg-gray-100'
                        }`}>
                          {isOn && <Check className="h-3 w-3 text-white" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {selectedExtraIds.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1.5">
                    Доп. услуги: <span className="font-semibold text-blue-600">
                      {formatPrice(extraServices.filter(e => selectedExtraIds.includes(e.id)).reduce((s, e) => s + e.price, 0))}
                    </span>
                  </p>
                )}
              </div>
            )}

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
                {(selectedBooking.status === 'confirmed' || selectedBooking.status === 'in_progress') && (
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
