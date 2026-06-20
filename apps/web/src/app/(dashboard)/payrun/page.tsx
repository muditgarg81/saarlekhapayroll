'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { payrunApi, employeesApi } from '@/lib/api';
import { MONTHS } from '@saarlekha/shared';

// Status → label / colour / next actions
const STATUS_META: Record<string, { label: string; cls: string }> = {
  DRAFT:              { label: 'Draft',            cls: 'bg-gray-100 text-gray-600' },
  PENDING_REVIEW:     { label: 'Pending Review',   cls: 'bg-yellow-100 text-yellow-700' },
  PENDING_APPROVAL:   { label: 'Pending Approval', cls: 'bg-orange-100 text-orange-700' },
  APPROVED:           { label: 'Approved',          cls: 'bg-blue-100 text-blue-700' },
  PAID:               { label: 'Paid',              cls: 'bg-green-100 text-green-700' },
  CANCELLED:          { label: 'Cancelled',         cls: 'bg-red-100 text-red-700' },
};

const fmt = (n: number) => `₹${Math.round(n ?? 0).toLocaleString('en-IN')}`;

export default function PayrunPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [showFnF, setShowFnF] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const now = new Date();

  const { data: payruns = [], isLoading } = useQuery({
    queryKey: ['payruns'],
    queryFn: () => payrunApi.list(),
  });

  const makeMut = (fn: (id: string) => Promise<any>, successMsg?: string) =>
    useMutation({
      mutationFn: fn,
      onSuccess: () => { qc.invalidateQueries({ queryKey: ['payruns'] }); setError(''); },
      onError: (e: any) => setError(e.message || e.error || 'Action failed'),
    });

  const processMut  = makeMut(id => payrunApi.process(id));
  const reviewMut   = makeMut(id => payrunApi.review(id));
  const approveMut  = makeMut(id => payrunApi.approve(id));
  const paidMut     = makeMut(id => payrunApi.markPaid(id));
  const cancelMut   = makeMut(id => payrunApi.cancel(id));

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payrun Engine</h1>
          <p className="text-gray-500 text-sm mt-1">Monthly, off-cycle and Full & Final settlement runs</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowFnF(true)} className="btn-secondary">Full & Final</button>
          <button onClick={() => setShowCreate(true)} className="btn-primary">+ New Payrun</button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* Payrun list */}
      <div className="card overflow-hidden">
        {isLoading ? <div className="p-8 text-center text-gray-500">Loading...</div> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-600">Period</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Type</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Employees</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Gross</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Net Pay</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(payruns as any[]).map((pr: any) => (
                <tr key={pr.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{MONTHS[pr.month - 1]} {pr.year}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                      pr.type === 'FULL_FINAL' ? 'bg-purple-100 text-purple-700' :
                      pr.type === 'OFF_CYCLE'  ? 'bg-blue-100 text-blue-700' :
                      pr.type === 'SUPPLEMENTARY' ? 'bg-teal-100 text-teal-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{pr.type.replace('_', ' ')}</span>
                  </td>
                  <td className="px-4 py-3 text-right">{pr.totalEmployees}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{fmt(pr.totalGross)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-green-700">{fmt(pr.totalNetPay)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_META[pr.status]?.cls || ''}`}>
                      {STATUS_META[pr.status]?.label || pr.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center gap-1 flex-wrap">
                      <button onClick={() => setSelectedId(pr.id)} className="text-xs text-brand-600 hover:underline px-2 py-1">
                        View
                      </button>
                      {pr.status === 'DRAFT' && (
                        <button onClick={() => processMut.mutate(pr.id)} disabled={processMut.isPending}
                          className="text-xs bg-brand-600 text-white px-2 py-1 rounded hover:bg-brand-700">
                          Process
                        </button>
                      )}
                      {pr.status === 'PENDING_REVIEW' && (
                        <button onClick={() => reviewMut.mutate(pr.id)} disabled={reviewMut.isPending}
                          className="text-xs bg-yellow-500 text-white px-2 py-1 rounded hover:bg-yellow-600">
                          Review ✓
                        </button>
                      )}
                      {pr.status === 'PENDING_APPROVAL' && (
                        <button onClick={() => approveMut.mutate(pr.id)} disabled={approveMut.isPending}
                          className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700">
                          Approve
                        </button>
                      )}
                      {pr.status === 'APPROVED' && (
                        <button onClick={() => paidMut.mutate(pr.id)} disabled={paidMut.isPending}
                          className="text-xs bg-purple-600 text-white px-2 py-1 rounded hover:bg-purple-700">
                          Mark Paid
                        </button>
                      )}
                      {['DRAFT','PENDING_REVIEW','PENDING_APPROVAL'].includes(pr.status) && (
                        <button onClick={() => cancelMut.mutate(pr.id)} disabled={cancelMut.isPending}
                          className="text-xs text-red-500 hover:underline px-2 py-1">
                          Cancel
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {(payruns as any[]).length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                  No payruns yet. Create your first payrun to get started.
                </td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Status flow legend */}
      <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">
        <span>Flow:</span>
        {['DRAFT','PENDING_REVIEW','PENDING_APPROVAL','APPROVED','PAID'].map((s, i, arr) => (
          <span key={s} className="flex items-center gap-1">
            <span className={`px-1.5 py-0.5 rounded ${STATUS_META[s].cls}`}>{STATUS_META[s].label}</span>
            {i < arr.length - 1 && <span>→</span>}
          </span>
        ))}
        <span className="ml-2 text-gray-300">· Maker-checker enforced at Approve step</span>
      </div>

      {/* Modals */}
      {showCreate && (
        <CreatePayrunModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => { setShowCreate(false); qc.invalidateQueries({ queryKey: ['payruns'] }); }}
          defaultMonth={now.getMonth() + 1}
          defaultYear={now.getFullYear()}
        />
      )}
      {showFnF && (
        <FnFModal
          onClose={() => setShowFnF(false)}
          onSuccess={() => { setShowFnF(false); qc.invalidateQueries({ queryKey: ['payruns'] }); }}
        />
      )}
      {selectedId && (
        <PayrunDetailDrawer
          payrunId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}

// ── Create Payrun Modal ───────────────────────────────────────
function CreatePayrunModal({ onClose, onSuccess, defaultMonth, defaultYear }: any) {
  const [form, setForm] = useState<any>({
    month: defaultMonth, year: defaultYear,
    type: 'REGULAR', notes: '', payDate: '',
  });
  const [previewData, setPreviewData] = useState<any>(null);
  const [error, setError] = useState('');

  const createMut = useMutation({
    mutationFn: (data: any) => payrunApi.create(data),
    onSuccess,
    onError: (e: any) => setError(e.message || 'Failed to create payrun'),
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold">New Payrun</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div className="p-6 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
              <select className="input" value={form.month} onChange={e => setForm((f: any) => ({ ...f, month: Number(e.target.value) }))}>
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
              <input type="number" className="input" value={form.year} onChange={e => setForm((f: any) => ({ ...f, year: Number(e.target.value) }))} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select className="input" value={form.type} onChange={e => setForm((f: any) => ({ ...f, type: e.target.value }))}>
              <option value="REGULAR">Regular — all active employees</option>
              <option value="OFF_CYCLE">Off-cycle — specific employees</option>
              <option value="SUPPLEMENTARY">Supplementary — bonus / arrear</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pay Date (optional)</label>
            <input type="date" className="input" value={form.payDate} onChange={e => setForm((f: any) => ({ ...f, payDate: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <input className="input" value={form.notes} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" />
          </div>
        </div>
        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={() => createMut.mutate(form)} disabled={createMut.isPending} className="btn-primary">
            {createMut.isPending ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Full & Final Settlement Modal ─────────────────────────────
function FnFModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ employeeId: '', lastWorkingDay: '', encashLeaves: '', notes: '' });
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const { data: employees = [] } = useQuery({
    queryKey: ['employees-active'],
    queryFn: () => employeesApi.list({ status: 'ACTIVE' }),
  });

  const mut = useMutation({
    mutationFn: (data: any) => payrunApi.createFnF(data),
    onSuccess: (data: any) => setResult(data),
    onError: (e: any) => setError(e.message || 'FnF failed'),
  });

  if (result) {
    const s = result.summary;
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
          <div className="text-center mb-5">
            <div className="text-4xl mb-2">✓</div>
            <h2 className="text-xl font-semibold text-gray-900">FnF Settlement Created</h2>
            <p className="text-gray-500 text-sm mt-1">Employee marked as Terminated</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-600">Service Years</span><span className="font-medium">{s.yearsOfService} yrs</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Pro-rated Salary</span><span>{fmt(s.proRatedSalary)}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Gratuity</span><span>{fmt(s.gratuityAmount)}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Leave Encashment</span><span>{fmt(s.leaveEncashment)}</span></div>
            <div className="flex justify-between border-t border-gray-200 pt-2 font-semibold text-base">
              <span>Total Settlement</span><span className="text-green-700">{fmt(s.totalSettlement)}</span>
            </div>
          </div>
          <button onClick={onSuccess} className="btn-primary w-full mt-5">Done</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Full & Final Settlement</h2>
            <p className="text-xs text-gray-500 mt-0.5">Pro-rata pay + gratuity + leave encashment</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div className="p-6 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Employee *</label>
            <select className="input" value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))}>
              <option value="">Select employee</option>
              {(employees as any[]).map((e: any) => (
                <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeCode})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Last Working Day *</label>
            <input type="date" className="input" value={form.lastWorkingDay} onChange={e => setForm(f => ({ ...f, lastWorkingDay: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Leave Days to Encash</label>
            <input type="number" className="input" value={form.encashLeaves} min={0}
              onChange={e => setForm(f => ({ ...f, encashLeaves: e.target.value }))}
              placeholder="e.g. 12 (remaining earned leave)" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <input className="input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
            Gratuity is calculated automatically for employees with ≥5 years of service (15/26 × Basic+DA × years).
          </div>
        </div>
        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            onClick={() => mut.mutate({ ...form, encashLeaves: form.encashLeaves ? Number(form.encashLeaves) : 0 })}
            disabled={mut.isPending || !form.employeeId || !form.lastWorkingDay}
            className="btn-primary"
          >
            {mut.isPending ? 'Processing...' : 'Process FnF'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Payrun Detail Drawer ──────────────────────────────────────
function PayrunDetailDrawer({ payrunId, onClose }: { payrunId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [previewMode, setPreviewMode] = useState(false);
  const [overridePayslip, setOverridePayslip] = useState<any>(null);
  const [error, setError] = useState('');

  const { data: payrun, isLoading } = useQuery({
    queryKey: ['payrun', payrunId],
    queryFn: () => payrunApi.get(payrunId),
  });

  const { data: preview, isLoading: previewLoading } = useQuery({
    queryKey: ['payrun-preview', payrunId],
    queryFn: () => payrunApi.preview(payrunId),
    enabled: previewMode,
  });

  const pr = payrun as any;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
      <div className="bg-white w-full max-w-3xl h-full overflow-y-auto flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-200 flex-shrink-0">
          <div>
            {pr && (
              <>
                <h2 className="text-xl font-semibold text-gray-900">
                  {MONTHS[(pr.month ?? 1) - 1]} {pr.year} — {pr.type?.replace('_', ' ')}
                </h2>
                <div className="flex items-center gap-3 mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_META[pr.status]?.cls || ''}`}>
                    {STATUS_META[pr.status]?.label}
                  </span>
                  <span className="text-xs text-gray-400">{pr.totalEmployees} employees</span>
                </div>
              </>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        {isLoading ? <div className="p-8 text-center text-gray-500">Loading...</div> : pr && (
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Gross Pay',    value: fmt(pr.totalGross) },
                { label: 'Deductions',   value: fmt(pr.totalDeductions) },
                { label: 'Net Pay',      value: fmt(pr.totalNetPay), highlight: true },
              ].map(c => (
                <div key={c.label} className={`rounded-xl p-3 text-center border ${c.highlight ? 'bg-brand-50 border-brand-200' : 'bg-gray-50 border-gray-100'}`}>
                  <div className={`text-lg font-bold ${c.highlight ? 'text-brand-700' : 'text-gray-900'}`}>{c.value}</div>
                  <div className="text-xs text-gray-500">{c.label}</div>
                </div>
              ))}
            </div>

            {/* Preview toggle (only for DRAFT) */}
            {pr.status === 'DRAFT' && (
              <div>
                <button onClick={() => setPreviewMode(v => !v)} className="btn-secondary text-sm">
                  {previewMode ? 'Hide Preview' : 'Preview Payslips (dry run)'}
                </button>
                {previewMode && previewLoading && <div className="text-sm text-gray-500 mt-2">Running preview...</div>}
                {previewMode && preview && <PreviewTable data={preview as any} />}
              </div>
            )}

            {/* Payslips table */}
            {pr.payslips?.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-800 text-sm mb-2">Payslips ({pr.payslips.length})</h3>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-xs">
                        <th className="px-3 py-2 text-left font-medium text-gray-600">Employee</th>
                        <th className="px-3 py-2 text-center font-medium text-gray-600">LOP</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-600">Gross</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-600">Deductions</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-600">Net</th>
                        <th className="px-3 py-2 text-center font-medium text-gray-600">Override</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pr.payslips.map((ps: any) => (
                        <tr key={ps.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <div className="font-medium text-gray-900 text-xs">{ps.employee?.firstName} {ps.employee?.lastName}</div>
                            <div className="text-gray-400 text-xs">{ps.employee?.employeeCode} · {ps.employee?.designation}</div>
                            {ps.overrideNote && <div className="text-amber-600 text-xs mt-0.5">Override: {ps.overrideNote}</div>}
                          </td>
                          <td className="px-3 py-2 text-center text-xs text-gray-600">{ps.lopDays}d</td>
                          <td className="px-3 py-2 text-right text-xs">{fmt(ps.grossEarnings)}</td>
                          <td className="px-3 py-2 text-right text-xs text-red-600">{fmt(ps.totalDeductions)}</td>
                          <td className="px-3 py-2 text-right text-xs font-semibold text-green-700">{fmt(ps.netPay)}</td>
                          <td className="px-3 py-2 text-center">
                            {['PENDING_REVIEW','PENDING_APPROVAL'].includes(pr.status) && (
                              <button onClick={() => setOverridePayslip(ps)}
                                className="text-xs text-brand-600 hover:underline">Edit</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {overridePayslip && (
        <OverrideModal
          payrunId={payrunId}
          payslip={overridePayslip}
          onClose={() => setOverridePayslip(null)}
          onSuccess={() => {
            setOverridePayslip(null);
            qc.invalidateQueries({ queryKey: ['payrun', payrunId] });
            qc.invalidateQueries({ queryKey: ['payruns'] });
          }}
        />
      )}
    </div>
  );
}

// ── Preview Table ─────────────────────────────────────────────
function PreviewTable({ data }: { data: any }) {
  return (
    <div className="mt-3 border border-blue-200 rounded-xl overflow-hidden">
      <div className="bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-700">
        Preview — {data.totalEmployees} employees · Gross {fmt(data.totalGross)} · Net {fmt(data.totalNetPay)}
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="px-3 py-2 text-left font-medium text-gray-500">Employee</th>
            <th className="px-3 py-2 text-center font-medium text-gray-500">LOP</th>
            <th className="px-3 py-2 text-right font-medium text-gray-500">Gross</th>
            <th className="px-3 py-2 text-right font-medium text-gray-500">Deductions</th>
            <th className="px-3 py-2 text-right font-medium text-gray-500">Net</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r: any) => (
            <tr key={r.employeeId} className="border-b border-gray-50">
              <td className="px-3 py-2"><span className="font-medium">{r.name}</span> <span className="text-gray-400">{r.employeeCode}</span></td>
              <td className="px-3 py-2 text-center">{r.lopDays}d</td>
              <td className="px-3 py-2 text-right">{fmt(r.grossEarnings)}</td>
              <td className="px-3 py-2 text-right text-red-600">{fmt(r.totalDeductions)}</td>
              <td className="px-3 py-2 text-right font-semibold text-green-700">{fmt(r.netPay)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Override Modal ────────────────────────────────────────────
function OverrideModal({ payrunId, payslip, onClose, onSuccess }: any) {
  const earnings = payslip.lines.filter((l: any) => l.type === 'EARNING');
  const deductions = payslip.lines.filter((l: any) => l.type === 'DEDUCTION');
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [note, setNote] = useState(payslip.overrideNote || '');
  const [error, setError] = useState('');

  const mut = useMutation({
    mutationFn: (data: any) => payrunApi.overridePayslip(payrunId, payslip.id, data),
    onSuccess,
    onError: (e: any) => setError(e.message || 'Override failed'),
  });

  const handleSave = () => {
    const parsed: Record<string, number> = {};
    for (const [code, val] of Object.entries(overrides)) {
      if (val !== '') parsed[code] = Number(val);
    }
    if (Object.keys(parsed).length === 0) { setError('Enter at least one override value'); return; }
    mut.mutate({ overrides: parsed, note });
  };

  const LineGroup = ({ label, lines, color }: { label: string; lines: any[]; color: string }) => (
    <div>
      <p className={`text-xs font-semibold text-${color}-700 uppercase tracking-wide mb-2`}>{label}</p>
      {lines.map((l: any) => (
        <div key={l.id} className="flex items-center gap-3 mb-2">
          <div className="flex-1 text-sm text-gray-700">{l.component.name}</div>
          <div className="text-xs text-gray-400 w-20 text-right">{fmt(l.amount)}</div>
          <input
            type="number"
            className="input w-28 text-sm py-1"
            placeholder="Override"
            value={overrides[l.component.code] ?? ''}
            onChange={e => setOverrides(o => ({ ...o, [l.component.code]: e.target.value }))}
          />
        </div>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col">
        <div className="p-5 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="font-semibold">Override Payslip</h3>
            <p className="text-xs text-gray-500">{payslip.employee?.firstName} {payslip.employee?.lastName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
          <p className="text-xs text-gray-500">Leave blank to keep the calculated amount. Entered values replace component amounts.</p>
          <LineGroup label="Earnings" lines={earnings} color="green" />
          <LineGroup label="Deductions" lines={deductions} color="red" />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Override Reason</label>
            <input className="input" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Bonus adjustment for Q3 performance" />
          </div>
        </div>
        <div className="p-5 border-t border-gray-200 flex justify-end gap-3 flex-shrink-0">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={mut.isPending} className="btn-primary">
            {mut.isPending ? 'Saving...' : 'Apply Override'}
          </button>
        </div>
      </div>
    </div>
  );
}
