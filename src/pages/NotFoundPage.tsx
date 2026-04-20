import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
      <h1 className="text-9xl font-extrabold text-slate-200">404</h1>
      <h2 className="text-3xl font-bold text-slate-800 mt-4 mb-2">Страница не найдена</h2>
      <p className="text-slate-500 mb-8 max-w-md mx-auto">
        Кажется, вы свернули не туда. Страница, которую вы ищете, была перемещена, удалена или никогда не существовала.
      </p>
      <Button size="lg" asChild className="rounded-full shadow-lg">
        <Link to="/">Вернуться на главную</Link>
      </Button>
    </div>
  );
}
