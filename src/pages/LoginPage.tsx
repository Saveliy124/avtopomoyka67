import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Car, LogIn } from 'lucide-react';
import { authApi } from '@/api/auth.api';
import { useAuthStore } from '@/store/auth.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const schema = z.object({
  phone: z.string().min(10, 'Введите корректный номер телефона'),
  password: z.string().min(1, 'Введите пароль'),
});

type FormData = z.infer<typeof schema>;

// Dev accounts for quick testing — login by phone
const devAccounts = [
  { role: '🛡️ Админ', phone: '+79001112233', password: 'admin123' },
  { role: '🔧 Сотрудник', phone: '+79002223344', password: 'employee123' },
  { role: '👥 Клиент', phone: '+79003334455', password: 'client123' },
];

export function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const mutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: ({ token, user }) => {
      login(token, user);
      toast.success(`Добро пожаловать, ${user.first_name}!`);
      navigate('/');
    },
    onError: () => {
      toast.error('Неверный номер телефона или пароль');
    },
  });

  const onSubmit = (data: FormData) => mutation.mutate(data);

  const quickLogin = (phone: string, password: string) => {
    mutation.mutate({ phone, password });
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <div className="rounded-full bg-blue-100 p-4">
              <Car className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Вход в систему</h1>
          <p className="text-gray-500 text-sm mt-1">
            Нет аккаунта?{' '}
            <Link to="/register" className="text-blue-600 hover:underline font-medium">
              Зарегистрироваться
            </Link>
          </p>
        </div>

        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="phone">Номер телефона</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+7 900 111 22 33"
                  {...register('phone')}
                  aria-invalid={!!errors.phone}
                />
                {errors.phone && <p className="text-xs text-red-500">{errors.phone.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Пароль</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  {...register('password')}
                  aria-invalid={!!errors.password}
                />
                {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={mutation.isPending}
              >
                {mutation.isPending ? 'Вход...' : (
                  <>
                    <LogIn className="h-4 w-4" />
                    Войти
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Quick Dev Switcher — each button logs in immediately */}
        <Card className="mt-4 border-dashed border-orange-300 bg-orange-50">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-sm text-orange-700">⚡ Быстрый вход (Dev)</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="grid grid-cols-3 gap-2">
              {devAccounts.map(({ role, phone, password }) => (
                <Button
                  key={phone}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs border-orange-200 text-orange-700 hover:bg-orange-100"
                  disabled={mutation.isPending}
                  onClick={() => quickLogin(phone, password)}
                >
                  {role}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
