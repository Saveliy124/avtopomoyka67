import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WasherPanel } from '@/components/admin/WasherPanel';
import { BookingsPanel } from '@/components/admin/BookingsPanel';
import { ServicesPanel } from '@/components/admin/ServicesPanel';
import { BoxesPanel } from '@/components/admin/BoxesPanel';
import { UsersPanel } from '@/components/admin/UsersPanel';
import { CashPanel } from '@/components/admin/CashPanel';
import { ReportsPanel } from '@/components/admin/ReportsPanel';
import { AiPanel } from '@/components/admin/AiPanel';
import { AuditPanel } from '@/components/admin/AuditPanel';
import { MyStatsPanel } from '@/components/admin/MyStatsPanel';
import { WashersPanel } from '@/components/admin/WashersPanel';
import { useAuthStore } from '@/store/auth.store';

function CashReportsPanel({ showCash, showReports }: { showCash: boolean; showReports: boolean }) {
  return (
    <div className="space-y-8">
      {showReports && <ReportsPanel />}
      {showCash && <CashPanel />}
    </div>
  );
}

export function AdminPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.roles.includes('admin') || false;
  const isEmployee = user?.roles.includes('employee') || false;
  const perms = user?.employee_permissions || {} as Record<string, boolean>;

  const hasPerm = (key: keyof typeof perms) => isAdmin || perms[key];

  if (!isAdmin && isEmployee) {
    return (
      <div className="container mx-auto py-8">
        <h1 className="mb-8 text-3xl font-bold text-gray-900">Панель управления</h1>

        <Tabs defaultValue={hasPerm('can_manage_bookings') ? 'schedule' : 'wash-records'} className="w-full">
          <TabsList className="mb-8 inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
            {hasPerm('can_manage_bookings') && (
              <TabsTrigger value="schedule" className="rounded-lg px-4 py-2 text-sm">Расписание</TabsTrigger>
            )}
            <TabsTrigger value="wash-records" className="rounded-lg px-4 py-2 text-sm">Записи мойки</TabsTrigger>
            <TabsTrigger value="stats" className="rounded-lg px-4 py-2 text-sm">Моя статистика</TabsTrigger>
            {hasPerm('can_manage_cash') && (
              <TabsTrigger value="cash" className="rounded-lg px-4 py-2 text-sm">Касса</TabsTrigger>
            )}
            {hasPerm('can_view_reports') && (
              <TabsTrigger value="reports" className="rounded-lg px-4 py-2 text-sm">Отчетность</TabsTrigger>
            )}
            {hasPerm('can_manage_employees') && (
              <TabsTrigger value="workers" className="rounded-lg px-4 py-2 text-sm">Сотрудники</TabsTrigger>
            )}
          </TabsList>

          {hasPerm('can_manage_bookings') && (
            <TabsContent value="schedule"><BookingsPanel /></TabsContent>
          )}
          <TabsContent value="wash-records"><WasherPanel /></TabsContent>
          <TabsContent value="stats"><MyStatsPanel /></TabsContent>
          {hasPerm('can_manage_cash') && (
            <TabsContent value="cash"><CashPanel /></TabsContent>
          )}
          {hasPerm('can_view_reports') && (
            <TabsContent value="reports"><ReportsPanel /></TabsContent>
          )}
          {hasPerm('can_manage_employees') && (
            <TabsContent value="workers"><WashersPanel /></TabsContent>
          )}
        </Tabs>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="mb-8 text-3xl font-bold text-gray-900">Панель управления</h1>

      <Tabs defaultValue="bookings" className="w-full">
        <TabsList className="mb-8 inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
          <TabsTrigger value="bookings" disabled={!hasPerm('can_manage_bookings')} className="rounded-lg px-4 py-2 text-sm disabled:opacity-50">
            Расписание
          </TabsTrigger>
          <TabsTrigger value="wash-records" className="rounded-lg px-4 py-2 text-sm">
            Записи мойки
          </TabsTrigger>
          <TabsTrigger value="users" disabled={!hasPerm('can_manage_employees')} className="rounded-lg px-4 py-2 text-sm disabled:opacity-50">
            Пользователи
          </TabsTrigger>
          <TabsTrigger value="services" disabled={!hasPerm('can_manage_services')} className="rounded-lg px-4 py-2 text-sm disabled:opacity-50">
            Услуги
          </TabsTrigger>
          <TabsTrigger value="boxes" disabled={!hasPerm('can_manage_services')} className="rounded-lg px-4 py-2 text-sm disabled:opacity-50">
            Боксы
          </TabsTrigger>
          <TabsTrigger value="cash-reports" disabled={!hasPerm('can_manage_cash') && !hasPerm('can_view_reports')} className="rounded-lg px-4 py-2 text-sm disabled:opacity-50">
            Касса и отчетность
          </TabsTrigger>
          <TabsTrigger value="audit" disabled={!hasPerm('can_view_ai_audit')} className="rounded-lg px-4 py-2 text-sm disabled:opacity-50">
            Журнал
          </TabsTrigger>
          <TabsTrigger value="ai" disabled={!hasPerm('can_view_ai_audit')} className="rounded-lg px-4 py-2 text-sm disabled:opacity-50">
            ИИ
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bookings"><BookingsPanel /></TabsContent>
        <TabsContent value="wash-records"><WasherPanel /></TabsContent>
        <TabsContent value="users"><UsersPanel /></TabsContent>
        <TabsContent value="services"><ServicesPanel /></TabsContent>
        <TabsContent value="boxes"><BoxesPanel /></TabsContent>
        <TabsContent value="cash-reports">
          <CashReportsPanel showCash={hasPerm('can_manage_cash')} showReports={hasPerm('can_view_reports')} />
        </TabsContent>
        <TabsContent value="audit"><AuditPanel /></TabsContent>
        <TabsContent value="ai"><AiPanel /></TabsContent>
      </Tabs>
    </div>
  );
}
