import { Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';

interface Props {
  className?: string;
  size?: number;
}

export function LoadingSpinner({ className, size = 24 }: Props) {
  return (
    <Loader2
      className={cn('animate-spin text-blue-600', className)}
      style={{ width: size, height: size }}
    />
  );
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <LoadingSpinner size={40} />
    </div>
  );
}
