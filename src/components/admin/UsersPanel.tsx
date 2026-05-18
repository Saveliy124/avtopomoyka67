import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Activity, CheckCircle2, Clock3, Plus, Search, Trash2 } from 'lucide-react';
import { userApi } from '@/api/user.api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import type { User, EmployeePermissions } from '@/types';

const PERMISSION_LABELS: Record<keyof EmployeePermissions, string> = {
  can_manage_bookings: 'Управление записями',
  can_manage_cash: 'Касса',
  can_manage_services: 'Услуги и боксы',
  can_view_reports: 'Отчетность',
  can_manage_schedule: 'Расписание',
  can_manage_employees: 'Пользователи',
  can_do_washing: 'Мойщик',
  can_view_ai_audit: 'Журнал и ИИ',
};

const EDITABLE_PERMISSION_KEYS = (Object.keys(PERMISSION_LABELS) as (keyof EmployeePermissions)[])
  .filter((key) => key !== 'can_do_washing');

const ROLE_LABELS: Record<string, string> = {
  admin: 'Админ',
  employee: 'Сотрудник',
  client: 'Клиент',
};

type UserFilter = 'all' | 'clients' | 'employees' | 'admins';

const FILTERS: { value: UserFilter; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'clients', label: 'Клиенты' },
  { value: 'employees', label: 'Сотрудники' },
  { value: 'admins', label: 'Админы' },
];

const emptyPermissions: EmployeePermissions = {
  can_manage_bookings: false,
  can_manage_cash: false,
  can_manage_services: false,
  can_view_reports: false,
  can_manage_schedule: false,
  can_manage_employees: false,
  can_do_washing: false,
  can_view_ai_audit: false,
};

export function UsersPanel() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<UserFilter>('all');
  const [newUser, setNewUser] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    password: '',
    role: 'client',
    employee_permissions: { ...emptyPermissions },
  });

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: userApi.getUsers,
  });

  const invalidateUsers = () => {
    queryClient.invalidateQueries({ queryKey: ['users'] });
    queryClient.invalidateQueries({ queryKey: ['washers'] });
  };

  const permMutation = useMutation({
    mutationFn: ({ id, permissions }: { id: number; permissions: Partial<EmployeePermissions> }) =>
      userApi.updateUserPermissions(id, permissions),
    onSuccess: () => {
      invalidateUsers();
      toast.success('Права обновлены');
    },
    onError: () => toast.error('Ошибка обновления прав'),
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, roles }: { id: number; roles: string[] }) =>
      userApi.updateUserRoles(id, roles),
    onSuccess: () => {
      invalidateUsers();
      toast.success('Роль обновлена');
    },
    onError: () => toast.error('Ошибка обновления роли'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => userApi.deleteUser(id),
    onSuccess: () => {
      invalidateUsers();
      toast.success('Пользователь удален');
    },
    onError: () => toast.error('Ошибка при удалении'),
  });

  const createMutation = useMutation({
    mutationFn: userApi.createUser,
    onSuccess: () => {
      invalidateUsers();
      toast.success('Пользователь создан');
      setShowAdd(false);
      setNewUser({
        first_name: '',
        last_name: '',
        phone: '',
        password: '',
        role: 'client',
        employee_permissions: { ...emptyPermissions },
      });
    },
    onError: () => toast.error('Ошибка при создании'),
  });

  const togglePermission = (user: User, key: keyof EmployeePermissions) => {
    const isAdmin = user.roles.includes('admin');
    if (isAdmin && key === 'can_do_washing') {
      toast.info('Админ не может быть мойщиком');
      return;
    }

    permMutation.mutate({
      id: user.id,
      permissions: { [key]: !user.employee_permissions[key] },
    });
  };

  const handleRoleChange = (user: User, role: string) => {
    if (role === 'admin' && user.employee_permissions?.can_do_washing) {
      permMutation.mutate({
        id: user.id,
        permissions: { can_do_washing: false },
      });
    }
    roleMutation.mutate({ id: user.id, roles: [role] });
  };

  const handleDelete = (id: number, name: string) => {
    if (confirm(`Удалить пользователя ${name}?`)) {
      deleteMutation.mutate(id);
    }
  };

  const handleCreate = () => {
    if (!newUser.phone || !newUser.password || !newUser.first_name) {
      toast.error('Заполните имя, телефон и пароль');
      return;
    }

    createMutation.mutate({
      ...newUser,
      roles: [newUser.role],
      employee_permissions: newUser.role === 'admin'
        ? { ...newUser.employee_permissions, can_do_washing: false }
        : newUser.employee_permissions,
    });
  };

  if (isLoading) return <PageLoader />;

  const roleOrder: Record<string, number> = { admin: 0, employee: 1, client: 2 };

  const filteredUsers = (users ?? [])
    .filter((user) => {
      const isAdmin = user.roles.includes('admin');
      const isEmployee = user.roles.includes('employee');
      const isClient = user.roles.includes('client') || user.roles.length === 0;
      if (filter === 'clients' && !isClient) return false;
      if (filter === 'employees' && !isEmployee) return false;
      if (filter === 'admins' && !isAdmin) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const haystack = [
        user.first_name,
        user.last_name,
        user.patronymic,
        user.phone,
        user.email,
      ].filter(Boolean).join(' ').toLowerCase();

      return haystack.includes(q);
    })
    .sort((a, b) => {
      const ra = roleOrder[a.roles?.[0]] ?? 3;
      const rb = roleOrder[b.roles?.[0]] ?? 3;
      return ra !== rb ? ra - rb : a.id - b.id;
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Пользователи</h2>
            <p className="text-sm text-gray-500 mt-1">Клиенты, сотрудники, мойщики и администраторы в одном списке</p>
          </div>
          <Button size="sm" onClick={() => setShowAdd(!showAdd)}>
            <Plus className="h-4 w-4" /> Добавить
          </Button>
        </div>

        <div className="flex flex-col lg:flex-row gap-3 justify-between">
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Поиск по имени, телефону или email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {FILTERS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setFilter(item.value)}
                className={`h-10 px-3 rounded-lg border text-sm font-medium transition-colors ${
                  filter === item.value
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {showAdd && (
        <Card className="border-2 border-blue-100 shadow-lg">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1.5">Имя</label>
                <Input className="h-10" value={newUser.first_name} onChange={(e) => setNewUser(s => ({ ...s, first_name: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1.5">Фамилия</label>
                <Input className="h-10" value={newUser.last_name} onChange={(e) => setNewUser(s => ({ ...s, last_name: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1.5">Телефон</label>
                <Input className="h-10" type="tel" placeholder="+79001234567" value={newUser.phone} onChange={(e) => setNewUser(s => ({ ...s, phone: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1.5">Пароль</label>
                <Input className="h-10" type="password" value={newUser.password} onChange={(e) => setNewUser(s => ({ ...s, password: e.target.value }))} />
              </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 items-start">
              <div className="w-full lg:w-52">
                <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Роль</label>
                <select
                  className="w-full h-10 rounded-md border border-gray-300 px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={newUser.role}
                  onChange={(e) => setNewUser(s => ({
                    ...s,
                    role: e.target.value,
                    employee_permissions: e.target.value === 'admin'
                      ? { ...s.employee_permissions, can_do_washing: false }
                      : s.employee_permissions,
                  }))}
                >
                  <option value="client">Клиент</option>
                  <option value="employee">Сотрудник</option>
                  <option value="admin">Админ</option>
                </select>
              </div>

              {newUser.role === 'employee' && (
                <div className="flex-1">
                  <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Права и специализация</label>
                  <div className="flex flex-wrap gap-2">
                    {EDITABLE_PERMISSION_KEYS.map((key) => {
                      const enabled = newUser.employee_permissions[key];
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setNewUser(s => ({
                            ...s,
                            employee_permissions: { ...s.employee_permissions, [key]: !enabled }
                          }))}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                            enabled
                              ? 'bg-blue-600 border-blue-600 text-white font-medium'
                              : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                          }`}
                        >
                          {enabled ? '✓' : '○'} {PERMISSION_LABELS[key]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-8 pt-4 border-t border-gray-100">
              <Button size="sm" className="px-6" disabled={createMutation.isPending} onClick={handleCreate}>Создать пользователя</Button>
              <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>Отмена</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {filteredUsers.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-10">Пользователи не найдены</p>
      ) : (
        filteredUsers.map((user) => {
          const isEmployee = user.roles.includes('employee');
          const isWasher = isEmployee && user.employee_permissions?.can_do_washing;
          const fullName = [user.last_name, user.first_name, user.patronymic].filter(Boolean).join(' ');

          return (
            <Card key={user.id} className="hover:border-blue-200 transition-colors">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-900">{fullName || 'Пользователь'}</span>
                      <Badge variant={user.is_active ? 'success' : 'muted'} className="text-[10px] h-5">
                        {user.is_active ? 'Активен' : 'Отключен'}
                      </Badge>
                      <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                        {ROLE_LABELS[user.roles[0] || 'client'] || 'Клиент'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{user.phone || user.email || 'Контакты не указаны'}</div>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      title={ROLE_LABELS[user.roles[0] || 'client']}
                      className="h-9 rounded-md border border-gray-200 bg-white px-2 text-xs font-medium text-gray-700 outline-none focus:ring-2 focus:ring-blue-400 transition-all cursor-pointer hover:border-blue-300"
                      value={user.roles[0] || 'client'}
                      onChange={(e) => handleRoleChange(user, e.target.value)}
                      disabled={roleMutation.isPending}
                    >
                      <option value="client">Клиент</option>
                      <option value="employee">Сотрудник</option>
                      <option value="admin">Админ</option>
                    </select>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 text-gray-400 hover:text-red-600 hover:bg-red-50"
                      onClick={() => handleDelete(user.id, fullName || 'пользователя')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {isEmployee && (
                  <div className="mt-4 pt-3 border-t border-gray-100">
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Права и специализация</div>
                    <div className="flex flex-wrap gap-2">
                      {EDITABLE_PERMISSION_KEYS.map((key) => {
                        const enabled = user.employee_permissions?.[key];
                        return (
                          <button
                            key={key}
                            onClick={() => togglePermission(user, key)}
                            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                              enabled
                                ? 'bg-blue-50 border-blue-200 text-blue-700 font-medium'
                                : 'bg-gray-50 border-gray-200 text-gray-500'
                            }`}
                          >
                            {enabled ? '✓' : '○'} {PERMISSION_LABELS[key]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {isWasher && (
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mt-4 pt-4 border-t border-gray-100">
                    <div className="rounded-lg bg-emerald-50 text-emerald-700 p-3">
                      <CheckCircle2 className="h-4 w-4 mb-1" />
                      <p className="text-xl font-bold">{user.completed_washes ?? 0}</p>
                      <p className="text-xs">Завершено</p>
                    </div>
                    <div className="rounded-lg bg-amber-50 text-amber-700 p-3">
                      <Clock3 className="h-4 w-4 mb-1" />
                      <p className="text-xl font-bold">{user.started_washes ?? 0}</p>
                      <p className="text-xs">Начато</p>
                    </div>
                    <div className="rounded-lg bg-blue-50 text-blue-700 p-3">
                      <Activity className="h-4 w-4 mb-1" />
                      <p className="text-xl font-bold">{user.today_actions ?? 0}</p>
                      <p className="text-xs">Сегодня</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 text-slate-700 p-3">
                      <Activity className="h-4 w-4 mb-1" />
                      <p className="text-xl font-bold">{user.total_actions ?? 0}</p>
                      <p className="text-xs">Всего действий</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
