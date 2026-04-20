import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WasherPanel } from '@/components/admin/WasherPanel';
import { BookingsPanel } from '@/components/admin/BookingsPanel';
import { ServicesPanel } from '@/components/admin/ServicesPanel';
import { BoxesPanel } from '@/components/admin/BoxesPanel';
import { UsersPanel } from '@/components/admin/UsersPanel';
import { CashPanel } from '@/components/admin/CashPanel';
import { ReportsPanel } from '@/components/admin/ReportsPanel';
import { AiPanel } from '@/components/admin/AiPanel';
import { useAuthStore } from '@/store/auth.store';

export function AdminPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.roles.includes('admin') || false;
  const perms = user?.employee_permissions || {} as Record<string, boolean>;

  const hasPerm = (key: keyof typeof perms) => isAdmin || perms[key];
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Панель управления</h1>

      <Tabs defaultValue="bookings" className="w-full">
        <TabsList className="mb-8 p-1 bg-slate-100 rounded-xl inline-flex flex-wrap gap-1">
          <TabsTrigger value="bookings" disabled={!hasPerm('can_manage_bookings')} className="rounded-lg px-4 py-2 text-sm disabled:opacity-50">Записи</TabsTrigger>
          <TabsTrigger value="washer" disabled={!hasPerm('can_do_washing')} className="rounded-lg px-4 py-2 text-sm disabled:opacity-50">Мойщик</TabsTrigger>
          <TabsTrigger value="services" disabled={!hasPerm('can_manage_services')} className="rounded-lg px-4 py-2 text-sm disabled:opacity-50">Услуги</TabsTrigger>
          <TabsTrigger value="boxes" disabled={!hasPerm('can_manage_services')} className="rounded-lg px-4 py-2 text-sm disabled:opacity-50">Боксы</TabsTrigger>
          <TabsTrigger value="users" disabled={!hasPerm('can_manage_employees')} className="rounded-lg px-4 py-2 text-sm disabled:opacity-50">Пользователи</TabsTrigger>
          <TabsTrigger value="cash" disabled={!hasPerm('can_manage_cash')} className="rounded-lg px-4 py-2 text-sm disabled:opacity-50">Касса</TabsTrigger>
          <TabsTrigger value="reports" disabled={!hasPerm('can_view_reports')} className="rounded-lg px-4 py-2 text-sm disabled:opacity-50">Отчётность</TabsTrigger>
          <TabsTrigger value="ai" disabled={!hasPerm('can_view_reports')} className="rounded-lg px-4 py-2 text-sm disabled:opacity-50">🤖 ИИ</TabsTrigger>
        </TabsList>

        <TabsContent value="bookings"><BookingsPanel /></TabsContent>
        <TabsContent value="washer"><WasherPanel /></TabsContent>
        <TabsContent value="services"><ServicesPanel /></TabsContent>
        <TabsContent value="boxes"><BoxesPanel /></TabsContent>
        <TabsContent value="users"><UsersPanel /></TabsContent>
        <TabsContent value="cash"><CashPanel /></TabsContent>
        <TabsContent value="reports"><ReportsPanel /></TabsContent>
        <TabsContent value="ai"><AiPanel /></TabsContent>
      </Tabs>
    </div>
  );
}
