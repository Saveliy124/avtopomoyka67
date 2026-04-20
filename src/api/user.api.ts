import api from './axios';
import type { User, EmployeePermissions } from '@/types';

export const userApi = {
  getUsers: () => api.get<User[]>('/users').then((r) => r.data),

  updateUserPermissions: (id: number, permissions: Partial<EmployeePermissions>) =>
    api.patch<User>(`/users/${id}/permissions`, { permissions }).then((r) => r.data),

  updateUserRoles: (id: number, roles: string[]) =>
    api.patch<User>(`/users/${id}/roles`, { roles }).then((r) => r.data),

  createUser: (data: Partial<User>) =>
    api.post<User>('/users', data).then((r) => r.data),
};
