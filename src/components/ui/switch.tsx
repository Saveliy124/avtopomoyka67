import * as React from 'react';
import { cn } from '@/utils/cn';

interface SwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, label, ...props }, ref) => (
    <label className="flex items-center gap-2 cursor-pointer">
      <div className="relative">
        <input type="checkbox" ref={ref} className="sr-only peer" {...props} />
        <div className={cn(
          'w-10 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:bg-blue-600 transition-colors',
          className
        )} />
        <div className="absolute left-1 top-1 bg-white h-4 w-4 rounded-full transition-transform peer-checked:translate-x-4" />
      </div>
      {label && <span className="text-sm">{label}</span>}
    </label>
  )
);
Switch.displayName = 'Switch';

export { Switch };
