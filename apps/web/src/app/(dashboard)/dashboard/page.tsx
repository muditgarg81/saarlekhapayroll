'use client';
import { useQuery } from '@tanstack/react-query';
import { companyApi } from '@/lib/api';
import { MONTHS } from '@saarlekha/shared';

export default function DashboardPage() {
  const { data: dash, isLoading } = useQuery<any>({
    queryKey: ['dashboard'],
    queryFn: () => companyApi.dashboard() as any,
  });

  const stats = [
    { label: 'Total Employees', value: dash?.totalEmployees ?? '—', color: 'bg-blue-500', icon: '👥' },
    { label: 'Active Employees', value: dash?.activeEmployees ?? '—', color: 'bg-green-500', icon: '✅' },
    { label: 'Pending Leaves', value: dash?.pendingLeaves ?? '—', color: 'bg-yellow-500', icon: '📅' },
    {
      label: 'Last Payrun',
      value: dash?.latestPayrun
        ? `${MONTHS[dash.latestPayrun.month - 1]} ${dash.latestPayrun.year}`
        : 'No payrun yet',
      color: 'bg-purple-500',
      icon: '💸',
    },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">
          {MONTHS[(dash?.currentMonth ?? new Date().getMonth() + 1) - 1]} {dash?.currentYear ?? new Date().getFullYear()}
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-4" />
              <div className="h-8 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map(s => (
            <div key={s.label} className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-2xl">{s.icon}</span>
                <span className={`w-2 h-2 rounded-full ${s.color}`} />
              </div>
              <div className="text-2xl font-bold text-gray-900">{s.value}</div>
              <div className="text-sm text-gray-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {dash?.latestPayrun && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Latest Payrun Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Period</span>
                <span className="font-medium">{MONTHS[dash.latestPayrun.month - 1]} {dash.latestPayrun.year}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Status</span>
                <StatusBadge status={dash.latestPayrun.status} />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total Net Pay</span>
                <span className="font-semibold text-green-700">
                  ₹{dash.latestPayrun.netPay?.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Run Payroll', href: '/payrun', icon: '💸' },
                { label: 'Add Employee', href: '/employees', icon: '➕' },
                { label: 'View Reports', href: '/reports', icon: '📊' },
                { label: 'Leave Requests', href: '/leave', icon: '📅' },
              ].map(a => (
                <a key={a.label} href={a.href} className="flex items-center gap-2 p-3 rounded-lg bg-gray-50 hover:bg-brand-50 hover:text-brand-700 transition-colors text-sm font-medium">
                  <span>{a.icon}</span>{a.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    DRAFT: 'badge-gray',
    PENDING_APPROVAL: 'badge-yellow',
    APPROVED: 'badge-blue',
    PROCESSED: 'badge-blue',
    PAID: 'badge-green',
    CANCELLED: 'badge-red',
  };
  return <span className={map[status] || 'badge-gray'}>{status.replace('_', ' ')}</span>;
}
