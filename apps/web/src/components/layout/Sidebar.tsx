'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { useRouter } from 'next/navigation';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '⊞' },
  { href: '/employees', label: 'Employees', icon: '👥' },
  { href: '/payrun', label: 'Payrun', icon: '💸' },
  { href: '/payslips', label: 'Payslips', icon: '🧾' },
  { href: '/contractor', label: 'Contractors', icon: '💼' },
  { href: '/loans', label: 'Loans', icon: '💵' },
  { href: '/compensation', label: 'Compensation', icon: '📈' },
  { href: '/salary', label: 'Salary Setup', icon: '⚙️' },
  { href: '/leave', label: 'Leave', icon: '📅' },
  { href: '/attendance', label: 'Attendance', icon: '⏰' },
  { href: '/compliance', label: 'Compliance', icon: '📋' },
  { href: '/reports', label: 'Reports', icon: '📊' },
  { href: '/ai', label: 'AI Assistant', icon: '🤖' },
  { href: '/tds', label: 'TDS & Tax', icon: '🧾' },
  { href: '/bank', label: 'Bank Payments', icon: '🏦' },
  { href: '/integrations', label: 'Integrations', icon: '🔌' },
  { href: '/notifications', label: 'Notifications', icon: '📤' },
  { href: '/settings', label: 'Settings', icon: '🔧' },
];

const essItems = [
  { href: '/ess', label: 'Self Service (ESS)', icon: '📱' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0">
      <div className="p-5 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-brand-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">S</span>
          </div>
          <div>
            <div className="font-bold text-gray-900 text-sm">Saarlekha Payroll</div>
            <div className="text-xs text-gray-500 truncate max-w-[140px]">{user?.companyName}</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        {navItems.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-sm font-medium transition-colors ${
                active
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="px-3 mb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Employee Portal</p>
          {essItems.map(item => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="p-3 border-t border-gray-200">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center">
            <span className="text-brand-700 font-bold text-sm">
              {user?.employee?.firstName?.[0] || user?.email?.[0]?.toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate">
              {user?.employee ? `${user.employee.firstName} ${user.employee.lastName}` : user?.email}
            </div>
            <div className="text-xs text-gray-500 capitalize">{user?.role?.replace('_', ' ').toLowerCase()}</div>
          </div>
        </div>
        <button onClick={handleLogout} className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-lg transition-colors">
          Sign out
        </button>
      </div>
    </aside>
  );
}
