import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { userApi } from '@/api/user.api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import type { User, EmployeePermissions } from '@/types';

const PERMISSION_LABELS: Record<keyof EmployeePermissions, string> = {
  can_manage_bookings: 'Управление записями',
  can_manage_cash: 'Управление кассой',
  can_manage_services: 'Управление услугами',
  can_view_reports: 'Просмотр отчётов',
  can_manage_schedule: 'Управление расписанием',
  can_manage_employees: 'Управление сотрудниками',
  can_do_washing: 'Выполнение мойки',
};

const ROLE_LABELS: Record<string, string> = {
  admin: '🛡️ Админ',
  employee: '🔧 Сотрудник',
  client: '👥 Клиент',
};

export function UsersPanel() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [newUser, setNewUser] = useState({
    first_name: '', last_name: '', email: '', password: '', role: 'client'
  });

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: userApi.getUsers,
  });

  const permMutation = useMutation({
    mutationFn: ({ id, permissions }: { id: number; permissions: Partial<EmployeePermissions> }) =>
      userApi.updateUserPermissions(id, permissions),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Права обновлены');
    },
    onError: () => toast.error('Ошибка'),
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, roles }: { id: number; roles: string[] }) =>
      userApi.updateUserRoles(id, roles),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Роль обновлена');
    },
    onError: () => toast.error('Ошибка'),
  });

  const createMutation = useMutation({
    mutationFn: userApi.createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Пользователь создан');
      setShowAdd(false);
      setNewUser({ first_name: '', last_name: '', email: '', password: '', role: 'client' });
    },
    onError: () => toast.error('Ошибка при создании'),
  });

  const togglePermission = (user: User, key: keyof EmployeePermissions) => {
    permMutation.mutate({
      id: user.id,
      permissions: { [key]: !user.employee_permissions[key] },
    });
  };

  const cycleRole = (user: User) => {
    const roles = ['client', 'employee', 'admin'];
    const current = user.roles[0] || 'client';
    const idx = roles.indexOf(current);
    const next = roles[(idx + 1) % roles.length];
    roleMutation.mutate({ id: user.id, roles: [next] });
  };

  const handleCreate = () => {
    if (!newUser.email || !newUser.password || !newUser.first_name) {
      toast.error('Заполните обязательные поля');
      return;
    }
    createMutation.mutate({
      ...newUser,
      roles: [newUser.role]
    });
  };

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Управление пользователями</h2>
        <Button size="sm" onClick={() => setShowAdd(!showAdd)}>
          <Plus className="h-4 w-4" /> Добавить
        </Button>
      </div>

      {showAdd && (
        <Card>
          <CardContent className="p-4 flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-xs text-gray-600 block mb-1">Имя</label>
              <Input className="h-9" value={newUser.first_name} onChange={(e) => setNewUser(s => ({ ...s, first_name: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1">Фамилия</label>
              <Input className="h-9" value={newUser.last_name} onChange={(e) => setNewUser(s => ({ ...s, last_name: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1">Email</label>
              <Input className="h-9" type="email" value={newUser.email} onChange={(e) => setNewUser(s => ({ ...s, email: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1">Пароль</label>
              <Input className="h-9" type="password" value={newUser.password} onChange={(e) => setNewUser(s => ({ ...s, password: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1">Роль</label>
              <select className="h-9 rounded-md border border-gray-300 px-3 text-sm" value={newUser.role} onChange={(e) => setNewUser(s => ({ ...s, role: e.target.value }))}>
                <option value="client">Клиент</option>
                <option value="employee">Сотрудник</option>
                <option value="admin">Админ</option>
              </select>
            </div>
            <div className="flex gap-2">
              <Button size="sm" disabled={createMutation.isPending} onClick={handleCreate}>Сохранить</Button>
              <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>Отмена</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {users?.slice().reverse().map((user) => (
        <Card key={user.id}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div>
                <span className="font-bold text-gray-900">
                  {user.last_name} {user.first_name} {user.patronymic || ''}
                </span>
                <span className="text-sm text-gray-500 ml-2">{user.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={user.is_active ? 'success' : 'muted'}>
                  {user.is_active ? 'Активен' : 'Заблокирован'}
                </Badge>
                <Button size="sm" variant="outline" onClick={() => cycleRole(user)}>
                  {ROLE_LABELS[user.roles[0]] || user.roles[0]}
                </Button>
              </div>
            </div>

            {(user.roles.includes('employee') || user.roles.includes('admin')) && (
              <div className="flex flex-wrap gap-2 mt-2">
                {(Object.keys(PERMISSION_LABELS) as (keyof EmployeePermissions)[]).map((key) => {
                  const enabled = user.employee_permissions?.[key];
                  return (
                    <button
                      key={key}
                      onClick={() => togglePermission(user, key)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        enabled
                          ? 'bg-blue-50 border-blue-300 text-blue-700'
                          : 'bg-gray-50 border-gray-200 text-gray-400'
                      }`}
                    >
                      {enabled ? '✓' : '○'} {PERMISSION_LABELS[key]}
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
