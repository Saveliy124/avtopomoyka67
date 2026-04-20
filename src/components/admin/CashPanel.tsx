import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { cashApi } from '@/api/cash.api';
import { formatPrice, formatDateTime } from '@/utils/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageLoader } from '@/components/shared/LoadingSpinner';

export function CashPanel() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ type: 'income' as 'income' | 'expense', amount: '', description: '' });

  const { data: operations, isLoading } = useQuery({
    queryKey: ['cash'],
    queryFn: cashApi.getOperations,
  });

  const { data: bookings } = useQuery({
    queryKey: ['bookings'],
    queryFn: () => import('@/api/booking.api').then(m => m.bookingApi.getMyBookings()),
  });

  const unpaidBookings = bookings?.filter(b => b.status === 'completed' && !(b as any).is_paid) || [];

  const createMutation = useMutation({
    mutationFn: cashApi.createOperation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash'] });
      toast.success('Операция добавлена');
      setShowAdd(false);
      setForm({ type: 'income', amount: '', description: '' });
    },
    onError: () => toast.error('Ошибка'),
  });

  const payMutation = useMutation({
    mutationFn: (id: number) => import('@/api/booking.api').then(m => m.bookingApi.payBooking(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      toast.success('Оплата подтверждена');
    },
    onError: () => toast.error('Ошибка подтверждения оплаты'),
  });

  const totalIncome = operations?.filter((o) => o.type === 'income').reduce((s, o) => s + o.amount, 0) ?? 0;
  const totalExpense = operations?.filter((o) => o.type === 'expense').reduce((s, o) => s + o.amount, 0) ?? 0;

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Касса</h2>
        <Button size="sm" onClick={() => setShowAdd(!showAdd)}>
          <Plus className="h-4 w-4" /> Добавить операцию
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-green-700">Доход</p>
            <p className="text-2xl font-bold text-green-700">{formatPrice(totalIncome)}</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-red-700">Расход</p>
            <p className="text-2xl font-bold text-red-700">{formatPrice(totalExpense)}</p>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-blue-700">Баланс</p>
            <p className="text-2xl font-bold text-blue-700">{formatPrice(totalIncome - totalExpense)}</p>
          </CardContent>
        </Card>
      </div>

      {showAdd && (
        <Card>
          <CardContent className="p-4 flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Тип</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as 'income' | 'expense' })}
                className="h-9 rounded-md border border-gray-300 px-3 text-sm"
              >
                <option value="income">Приход</option>
                <option value="expense">Расход</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Сумма</label>
              <Input type="number" placeholder="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm text-gray-600 mb-1 block">Описание</label>
              <Input placeholder="Комментарий" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <Button size="sm" disabled={!form.amount || createMutation.isPending}
              onClick={() => createMutation.mutate({ type: form.type, amount: Number(form.amount), description: form.description, user_id: 1 })}>
              Сохранить
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Unpaid Bookings */}
      {unpaidBookings.length > 0 && (
        <div className="space-y-2 mb-6">
          <h3 className="text-lg font-semibold text-orange-600 mb-2">Ожидают оплаты</h3>
          {unpaidBookings.map((b) => (
            <Card key={b.id} className="border-orange-200 bg-orange-50/50">
              <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-gray-900">{b.service_name}</p>
                  <p className="text-sm text-gray-600">
                    {b.car_info} • {new Date(b.appointment_time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} (Бокс {b.box_number})
                  </p>
                </div>
                <div className="flex items-center gap-4 w-full sm:w-auto">
                  <span className="text-lg font-bold text-orange-700">{formatPrice(b.price)}</span>
                  <Button 
                    className="flex-1 sm:flex-none bg-orange-500 hover:bg-orange-600 text-white" 
                    onClick={() => payMutation.mutate(b.id)}
                    disabled={payMutation.isPending}
                  >
                    Подтвердить оплату
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Operations list */}
      <div className="space-y-2">
        {operations?.slice().reverse().map((op) => (
          <Card key={op.id}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {op.type === 'income'
                  ? <ArrowDownCircle className="h-5 w-5 text-green-600" />
                  : <ArrowUpCircle className="h-5 w-5 text-red-600" />}
                <div>
                  <p className="text-sm font-medium text-gray-900">{op.description}</p>
                  <p className="text-xs text-gray-400">{formatDateTime(op.date)}</p>
                </div>
              </div>
              <Badge variant={op.type === 'income' ? 'success' : 'destructive'}>
                {op.type === 'income' ? '+' : '−'}{formatPrice(op.amount)}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
