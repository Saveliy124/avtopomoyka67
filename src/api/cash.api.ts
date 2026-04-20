import api from './axios';

export interface CashOperation {
  id: number;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  date: string;
  user_id: number;
}

export const cashApi = {
  getOperations: () => api.get<CashOperation[]>('/cash').then((r) => r.data),

  createOperation: (data: Omit<CashOperation, 'id' | 'date'>) =>
    api.post<CashOperation>('/cash', data).then((r) => r.data),
};
