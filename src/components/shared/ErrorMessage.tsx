import { AlertCircle } from 'lucide-react';

interface Props {
  message?: string;
}

export function ErrorMessage({ message = 'Произошла ошибка. Попробуйте позже.' }: Props) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
      <AlertCircle className="h-5 w-5 shrink-0" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
