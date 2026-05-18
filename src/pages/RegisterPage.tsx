import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { UserPlus } from 'lucide-react';
import { authApi } from '@/api/auth.api';
import { useAuthStore } from '@/store/auth.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

const COUNTRY_CODES = [
  {
    code: '+7',
    country: 'Россия',
    placeholder: '900 111 22 33',
    digits: 10,
    pattern: /^9\d{9}$/,
    message: 'Для России введите 10 цифр мобильного номера, начиная с 9',
  },
  {
    code: '+7',
    country: 'Казахстан',
    placeholder: '701 111 22 33',
    digits: 10,
    pattern: /^7\d{9}$/,
    message: 'Для Казахстана введите 10 цифр номера, начиная с 7',
  },
  {
    code: '+375',
    country: 'Беларусь',
    placeholder: '29 111 22 33',
    digits: 9,
    pattern: /^(25|29|33|44)\d{7}$/,
    message: 'Для Беларуси номер должен начинаться с 25, 29, 33 или 44',
  },
  {
    code: '+374',
    country: 'Армения',
    placeholder: '91 111 111',
    digits: 8,
    pattern: /^\d{8}$/,
    message: 'Для Армении введите 8 цифр номера',
  },
] as const;

const digitsOnly = (value: string) => value.replace(/\D/g, '');

const schema = z.object({
  last_name: z.string().min(2, 'Фамилия обязательна'),
  first_name: z.string().min(2, 'Имя обязательно'),
  patronymic: z.string().optional(),
  country_index: z.coerce.number(),
  phone_number: z.string().min(1, 'Введите номер телефона'),
  password: z.string().min(6, 'Пароль не менее 6 символов'),
}).superRefine((data, ctx) => {
  const country = COUNTRY_CODES[data.country_index] ?? COUNTRY_CODES[0];
  const phoneDigits = digitsOnly(data.phone_number);

  if (phoneDigits.length !== country.digits || !country.pattern.test(phoneDigits)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['phone_number'],
      message: country.message,
    });
  }
});

type FormData = z.infer<typeof schema>;

export function RegisterPage() {
  const navigate = useNavigate();
  const loginStore = useAuthStore((s) => s.login);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      country_index: 0,
      phone_number: '',
    },
  });

  const selectedCountry = COUNTRY_CODES[watch('country_index') ?? 0] ?? COUNTRY_CODES[0];

  const mutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: ({ token, user }) => {
      loginStore(token, user);
      toast.success('Аккаунт создан! Добро пожаловать.');
      navigate('/');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'Ошибка регистрации';
      toast.error(msg);
    },
  });

  const onSubmit = (data: FormData) => {
    const country = COUNTRY_CODES[data.country_index] ?? COUNTRY_CODES[0];
    const phone = `${country.code}${digitsOnly(data.phone_number)}`;

    mutation.mutate({
      last_name: data.last_name,
      first_name: data.first_name,
      patronymic: data.patronymic,
      phone,
      password: data.password,
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 px-4 py-10">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <div className="rounded-full bg-blue-100 p-4">
              <UserPlus className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Регистрация</h1>
          <p className="text-gray-500 text-sm mt-1">
            Уже есть аккаунт?{' '}
            <Link to="/login" className="text-blue-600 hover:underline font-medium">Войти</Link>
          </p>
        </div>

        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Фамилия</Label>
                  <Input placeholder="Иванов" {...register('last_name')} />
                  {errors.last_name && <p className="text-xs text-red-500">{errors.last_name.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Имя</Label>
                  <Input placeholder="Иван" {...register('first_name')} />
                  {errors.first_name && <p className="text-xs text-red-500">{errors.first_name.message}</p>}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Отчество <span className="text-gray-400 font-normal">(необязательно)</span></Label>
                <Input placeholder="Иванович" {...register('patronymic')} />
              </div>

              <div className="space-y-1.5">
                <Label>Номер телефона</Label>
                <div className="grid grid-cols-[132px_1fr] gap-2">
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    {...register('country_index')}
                  >
                    {COUNTRY_CODES.map((item, index) => (
                      <option key={`${item.country}-${index}`} value={index}>
                        {item.country} {item.code}
                      </option>
                    ))}
                  </select>
                  <Input
                    type="tel"
                    inputMode="numeric"
                    placeholder={selectedCountry.placeholder}
                    {...register('phone_number')}
                  />
                </div>
                <p className="text-xs text-gray-500">
                  Итоговый формат: {selectedCountry.code} и номер без кода страны
                </p>
                {errors.phone_number && <p className="text-xs text-red-500">{errors.phone_number.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label>Пароль</Label>
                <Input type="password" placeholder="Минимум 6 символов" {...register('password')} />
                {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
              </div>

              <Button type="submit" className="w-full" disabled={mutation.isPending}>
                {mutation.isPending ? 'Создание...' : 'Создать аккаунт'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
