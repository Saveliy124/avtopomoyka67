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
    country: 'Россия / Казахстан',
    placeholder: '9001112233',
    digits: 10,
    // Accepts numbers starting with 9 (RU mobile) or 7 (KZ mobile)
    pattern: /^[79]\d{9}$/,
    message: 'Введите 10 цифр номера (например: 9001112233 или +79001112233)',
  },
  {
    code: '+375',
    country: 'Беларусь',
    placeholder: '291112233',
    digits: 9,
    pattern: /^(25|29|33|44)\d{7}$/,
    message: 'Введите 9 цифр, начиная с 25, 29, 33 или 44',
  },
  {
    code: '+374',
    country: 'Армения',
    placeholder: '91111111',
    digits: 8,
    pattern: /^\d{8}$/,
    message: 'Введите 8 цифр номера',
  },
] as const;

const digitsOnly = (value: string) => value.replace(/\D/g, '');

/**
 * Normalizes a phone input to just the subscriber digits (without country code).
 * Handles all common Russian formats:
 *   9001112233     → 9001112233  (10 digits, no prefix)
 *   89001112233    → 9001112233  (8-prefix stripped)
 *   79001112233    → 9001112233  (7-prefix stripped)
 *  +79001112233    → 9001112233  (+ and 7 stripped)
 *   900 111 22 33  → 9001112233  (spaces stripped)
 *   8(900)111-22-33→ 9001112233  (all non-digits stripped)
 */
const normalizePhone = (value: string, countryCode: string): string => {
  const digits = digitsOnly(value);

  if (countryCode === '+7') {
    // 11-digit input: user typed full number with country prefix (7... or 8...)
    if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) {
      return digits.slice(1);
    }
  } else if (countryCode === '+375') {
    // 12-digit input: user typed 375 + number
    if (digits.length === 12 && digits.startsWith('375')) {
      return digits.slice(3);
    }
  } else if (countryCode === '+374') {
    // 11-digit input: user typed 374 + number
    if (digits.length === 11 && digits.startsWith('374')) {
      return digits.slice(3);
    }
  }

  return digits;
};

const schema = z.object({
  last_name: z.string().min(2, 'Фамилия обязательна'),
  first_name: z.string().min(2, 'Имя обязательно'),
  patronymic: z.string().optional(),
  country_index: z.coerce.number(),
  phone_number: z.string().min(1, 'Введите номер телефона'),
  password: z.string().min(6, 'Пароль не менее 6 символов'),
}).superRefine((data, ctx) => {
  const country = COUNTRY_CODES[data.country_index] ?? COUNTRY_CODES[0];
  const phoneDigits = normalizePhone(data.phone_number, country.code);

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
      navigate('/booking');
    },
    onError: (err: any) => {
      // Server returns { error: '...' }, fall back to .message for other cases
      const msg = err?.response?.data?.error ?? err?.response?.data?.message ?? 'Ошибка регистрации';
      toast.error(msg);
    },
  });

  const onSubmit = (data: FormData) => {
    const country = COUNTRY_CODES[data.country_index] ?? COUNTRY_CODES[0];
    const subscriberDigits = normalizePhone(data.phone_number, country.code);
    const phone = `${country.code}${subscriberDigits}`;

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
                <div className="grid grid-cols-[185px_1fr] gap-2">
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    {...register('country_index')}
                  >
                    {COUNTRY_CODES.map((item, index) => (
                      <option key={`${item.country}-${index}`} value={index}>
                        {item.code} {item.country}
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
                <p className="text-xs text-gray-400">
                  Можно вводить с +7, с 8, или просто 10 цифр — любой формат принимается
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
