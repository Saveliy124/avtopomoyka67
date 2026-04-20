import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Pencil, Check, X } from 'lucide-react';
import { serviceApi } from '@/api/service.api';
import { formatPrice, formatDuration } from '@/utils/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import type { Service, ExtraService } from '@/types';

const serviceSchema = z.object({
  service_name: z.string().min(2, 'Введите название'),
  price: z.coerce.number().min(1, 'Цена > 0'),
  duration_minutes: z.coerce.number().min(1, 'Длительность > 0'),
  wash_type: z.enum(['manual', 'robot', 'extra']),
});

type ServiceForm = z.infer<typeof serviceSchema>;

export function ServicesPanel() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<Partial<ServiceForm>>({});
  const [showAdd, setShowAdd] = useState(false);

  const { data: standardServices, isLoading: isLoadingSvc } = useQuery({
    queryKey: ['services'],
    queryFn: serviceApi.getServices,
  });

  const { data: extraServices, isLoading: isLoadingExtra } = useQuery({
    queryKey: ['extra-services'],
    queryFn: serviceApi.getExtraServices,
  });

  const isLoading = isLoadingSvc || isLoadingExtra;

  const services = [
    ...(standardServices || []),
    ...(extraServices?.map(e => ({ ...e, wash_type: 'extra' as const })) || [])
  ];

  const createMutation = useMutation({
    mutationFn: serviceApi.createService,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      queryClient.invalidateQueries({ queryKey: ['extra-services'] });
      toast.success('Услуга добавлена');
      setShowAdd(false);
      reset();
    },
    onError: () => toast.error('Ошибка'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ServiceForm> }) =>
      serviceApi.updateService(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      queryClient.invalidateQueries({ queryKey: ['extra-services'] });
      toast.success('Услуга обновлена');
      setEditingId(null);
    },
    onError: () => toast.error('Ошибка'),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ServiceForm>({
    resolver: zodResolver(serviceSchema),
    defaultValues: { wash_type: 'manual' }
  });

  const onSubmit = (data: ServiceForm) => createMutation.mutate(data);

  const startEdit = (service: Service | (ExtraService & { wash_type: 'extra' })) => {
    setEditingId(service.id);
    setEditValues({
      service_name: service.service_name,
      price: service.price,
      duration_minutes: service.duration_minutes,
      wash_type: (service as any).wash_type || 'manual',
    });
  };

  const saveEdit = (id: number) => {
    updateMutation.mutate({ id, data: editValues });
  };

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Услуги</h2>
        <Button size="sm" onClick={() => setShowAdd(!showAdd)}>
          <Plus className="h-4 w-4" />
          Добавить
        </Button>
      </div>

      {showAdd && (
        <Card>
          <CardContent className="p-4">
            <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <Input placeholder="Название услуги" {...register('service_name')} />
                {errors.service_name && <p className="text-xs text-red-500 mt-1">{errors.service_name.message}</p>}
              </div>
              <div>
                <Input type="number" placeholder="Цена (₽)" {...register('price')} />
                {errors.price && <p className="text-xs text-red-500 mt-1">{errors.price.message}</p>}
              </div>
              <div>
                <Input type="number" placeholder="Длительность (мин)" {...register('duration_minutes')} />
                {errors.duration_minutes && <p className="text-xs text-red-500 mt-1">{errors.duration_minutes.message}</p>}
              </div>
              <div>
                <select {...register('wash_type')} className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm">
                  <option value="manual">Ручная мойка</option>
                  <option value="robot">Робот</option>
                  <option value="extra">Доп. услуга</option>
                </select>
                {errors.wash_type && <p className="text-xs text-red-500 mt-1">{errors.wash_type.message}</p>}
              </div>
              <div className="sm:col-span-4 flex gap-2 mt-2">
                <Button type="submit" size="sm" disabled={createMutation.isPending}>Сохранить</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setShowAdd(false)}>Отмена</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {services.map((service) => (
          <Card key={`${service.wash_type}-${service.id}`}>
            <CardContent className="p-4 flex items-center gap-4 flex-wrap">
              {editingId === service.id ? (
                <>
                  <Input
                    className="flex-1 min-w-[140px]"
                    value={editValues.service_name ?? ''}
                    onChange={(e) => setEditValues((v) => ({ ...v, service_name: e.target.value }))}
                  />
                  <Input
                    className="w-28"
                    type="number"
                    value={editValues.price ?? ''}
                    onChange={(e) => setEditValues((v) => ({ ...v, price: +e.target.value }))}
                  />
                  <Input
                    className="w-28"
                    type="number"
                    value={editValues.duration_minutes ?? ''}
                    onChange={(e) => setEditValues((v) => ({ ...v, duration_minutes: +e.target.value }))}
                  />
                  <div className="flex gap-2">
                    <Button size="icon" variant="default" onClick={() => saveEdit(service.id)}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="outline" onClick={() => setEditingId(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex-1">
                    <span className="font-medium text-gray-900">{service.service_name}</span>
                    <p className="text-xs text-gray-400">
                      {service.wash_type === 'manual' ? '🖐️ Ручная' : service.wash_type === 'robot' ? '🤖 Робот' : '✨ Доп. услуга'}
                    </p>
                  </div>
                  <span className="text-blue-600 font-semibold">{formatPrice(service.price)}</span>
                  <span className="text-sm text-gray-500">{formatDuration(service.duration_minutes)}</span>
                  <Button size="icon" variant="ghost" onClick={() => startEdit(service as any)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
