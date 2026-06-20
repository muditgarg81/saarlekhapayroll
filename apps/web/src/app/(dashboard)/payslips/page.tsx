'use client';
import { useQuery } from '@tanstack/react-query';
import { payslipsApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { MONTHS } from '@saarlekha/shared';

export default function PayslipsPage() {
  const user = useAuthStore(s => s.user);
  const { data: payslips = [], isLoading } = useQuery({
    queryKey: ['my-payslips'],
    queryFn: () => payslipsApi.mine(),
  });

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Payslips</h1>
        <p className="text-gray-500 text-sm mt-1">Download and view your salary statements</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading
          ? [...Array(6)].map((_, i) => <div key={i} className="card p-6 animate-pulse h-32" />)
          : (payslips as any[]).map((p: any) => (
            <div key={p.id} className="card p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="font-semibold text-gray-900">{MONTHS[p.month - 1]} {p.year}</div>
                  <div className="text-xs text-gray-500">{p.paidDays}/{p.workingDays} days paid</div>
                </div>
                <span className={p.status === 'FINALIZED' ? 'badge-green' : 'badge-yellow'}>{p.status}</span>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Gross Earnings</span>
                  <span className="font-medium">₹{p.grossEarnings.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Deductions</span>
                  <span className="text-red-600">−₹{p.totalDeductions.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between font-semibold pt-1 border-t border-gray-100">
                  <span>Net Pay</span>
                  <span className="text-green-700">₹{p.netPay.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          ))
        }
        {!isLoading && (payslips as any[]).length === 0 && (
          <div className="col-span-3 text-center py-12 text-gray-500">No payslips yet.</div>
        )}
      </div>
    </div>
  );
}
