'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { loansApi, employeesApi } from '@/lib/api';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmt = (n: number) => `₹${Math.round(n ?? 0).toLocaleString('en-IN')}`;
const LOAN_TYPES = ['PERSONAL','SALARY_ADVANCE','HOUSING','VEHICLE','OTHER'];
const now = new Date();
const CUR_FY = now.getMonth() >= 3 ? `${now.getFullYear()}-${String(now.getFullYear()+1).slice(2)}` : `${now.getFullYear()-1}-${String(now.getFullYear()).slice(2)}`;
const fyList = Array.from({ length: 4 }, (_, i) => { const y = now.getFullYear() - i + (now.getMonth() >= 3 ? 0 : -1); return `${y}-${String(y+1).slice(2)}`; });
const statusBadge: Record<string,string> = { ACTIVE: 'bg-green-100 text-green-700', CLOSED: 'bg-gray-100 text-gray-500', CANCELLED: 'bg-red-100 text-red-500' };

// ── Loans Tab ─────────────────────────────────────────────────────────────────
function LoansTab() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [drawer, setDrawer] = useState<string | null>(null);
  const { data: loans = [], isLoading } = useQuery({ queryKey: ['loans', status], queryFn: () => loansApi.list(status || undefined) as any });
  const { data: employees = [] } = useQuery({ queryKey: ['employees'], queryFn: () => employeesApi.list() as any });

  const [form, setForm] = useState<any>({ loanType: 'PERSONAL', interestRate: 0, startMonth: now.getMonth() + 1, startYear: now.getFullYear() });
  const createMut = useMutation({ mutationFn: () => loansApi.create({ ...form, principal: Number(form.principal), tenureMonths: Number(form.tenureMonths), interestRate: Number(form.interestRate) }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['loans'] }); setShowCreate(false); setForm({ loanType: 'PERSONAL', interestRate: 0, startMonth: now.getMonth() + 1, startYear: now.getFullYear() }); } });

  // live EMI preview
  const previewEmi = (() => {
    const p = Number(form.principal), n = Number(form.tenureMonths), r = Number(form.interestRate);
    if (!p || !n) return 0;
    if (!r) return Math.round(p / n);
    const mr = r / 100 / 12, f = Math.pow(1 + mr, n);
    return Math.round((p * mr * f) / (f - 1));
  })();

  const arr = loans as any[];
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          {['','ACTIVE','CLOSED','CANCELLED'].map(s => (
            <button key={s} onClick={() => setStatus(s)} className={`px-3 py-1.5 text-xs rounded-full border ${status === s ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 text-gray-600'}`}>{s || 'All'}</button>
          ))}
        </div>
        <button onClick={() => setShowCreate(true)} className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">+ New Loan</button>
      </div>

      {isLoading ? <div className="text-center py-12 text-gray-400">Loading…</div> : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr>{['Employee','Type','Principal','Rate','EMI','Tenure','Outstanding','Status',''].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100">
              {arr.map((l: any) => (
                <tr key={l.id} className="bg-white hover:bg-gray-50 cursor-pointer" onClick={() => setDrawer(l.id)}>
                  <td className="px-4 py-3 font-medium text-gray-900">{l.employee?.firstName} {l.employee?.lastName}<div className="text-xs text-gray-400">{l.employee?.employeeCode}</div></td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{l.loanType}</td>
                  <td className="px-4 py-3 text-gray-900">{fmt(l.principal)}</td>
                  <td className="px-4 py-3 text-gray-600">{l.interestRate}%</td>
                  <td className="px-4 py-3 text-gray-900">{fmt(l.emi)}</td>
                  <td className="px-4 py-3 text-gray-600">{l.tenureMonths}m</td>
                  <td className="px-4 py-3 font-semibold text-orange-600">{fmt(l.outstanding)}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 text-xs rounded-full font-medium ${statusBadge[l.status]}`}>{l.status}</span></td>
                  <td className="px-4 py-3"><button onClick={e => { e.stopPropagation(); setDrawer(l.id); }} className="text-xs text-indigo-600 hover:underline">View</button></td>
                </tr>
              ))}
              {arr.length === 0 && <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400">No loans</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h3 className="text-lg font-semibold mb-4">New Loan</h3>
            <div className="space-y-3">
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Employee *</label>
                <select value={form.employeeId || ''} onChange={e => setForm({ ...form, employeeId: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="">Select…</option>
                  {(employees as any[]).map((e: any) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeCode})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Loan Type</label>
                  <select value={form.loanType} onChange={e => setForm({ ...form, loanType: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">{LOAN_TYPES.map(t => <option key={t} value={t}>{t.replace('_',' ')}</option>)}</select>
                </div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Principal (₹) *</label><input type="number" value={form.principal || ''} onChange={e => setForm({ ...form, principal: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Interest Rate (% p.a.)</label><input type="number" step="0.1" value={form.interestRate} onChange={e => setForm({ ...form, interestRate: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Tenure (months) *</label><input type="number" value={form.tenureMonths || ''} onChange={e => setForm({ ...form, tenureMonths: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Start Month</label>
                  <select value={form.startMonth} onChange={e => setForm({ ...form, startMonth: Number(e.target.value) })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">{MONTHS.map((m, i) => <option key={m} value={i+1}>{m}</option>)}</select>
                </div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Start Year</label><input type="number" value={form.startYear} onChange={e => setForm({ ...form, startYear: Number(e.target.value) })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              </div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Reason</label><input value={form.reason || ''} onChange={e => setForm({ ...form, reason: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              {previewEmi > 0 && <div className="p-2 bg-indigo-50 rounded-lg text-sm text-indigo-700">Computed EMI: <strong>{fmt(previewEmi)}</strong> × {form.tenureMonths} months {Number(form.interestRate) === 0 && '(interest-free → loan perquisite may apply)'}</div>}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowCreate(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
              <button onClick={() => createMut.mutate()} disabled={createMut.isPending || !form.employeeId || !form.principal || !form.tenureMonths} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm disabled:opacity-50">{createMut.isPending ? 'Creating…' : 'Create & Schedule'}</button>
            </div>
          </div>
        </div>
      )}

      {drawer && <LoanDrawer id={drawer} onClose={() => setDrawer(null)} />}
    </div>
  );
}

function LoanDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['loan', id], queryFn: () => loansApi.get(id) as any });
  const l = data as any;
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['loan', id] }); qc.invalidateQueries({ queryKey: ['loans'] }); };
  const postMut = useMutation({ mutationFn: (no: number) => loansApi.postInstallment(id, no), onSuccess: invalidate });
  const cancelMut = useMutation({ mutationFn: () => loansApi.cancel(id), onSuccess: () => { invalidate(); onClose(); } });

  return (
    <div className="fixed inset-0 bg-black/40 flex justify-end z-50" onClick={onClose}>
      <div className="bg-white w-full max-w-2xl h-full overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        {isLoading || !l ? <div className="text-center py-12 text-gray-400">Loading…</div> : (
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">{l.employee?.firstName} {l.employee?.lastName} — {l.loanType.replace('_',' ')}</h3>
                <p className="text-sm text-gray-400">{fmt(l.principal)} @ {l.interestRate}% · EMI {fmt(l.emi)} × {l.tenureMonths} · <span className={`px-1.5 py-0.5 rounded ${statusBadge[l.status]}`}>{l.status}</span></p>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            <div className="grid grid-cols-4 gap-2 mb-4">
              {[
                { label: 'Total Payable', v: fmt(l.summary.totalPayable) },
                { label: 'Total Interest', v: fmt(l.summary.totalInterest) },
                { label: 'Paid', v: `${l.summary.paidInstallments}/${l.tenureMonths}` },
                { label: 'Outstanding', v: fmt(l.outstanding), c: 'text-orange-600' },
              ].map(c => <div key={c.label} className="bg-gray-50 rounded-xl p-3 text-center"><p className={`text-base font-bold ${c.c || 'text-gray-900'}`}>{c.v}</p><p className="text-[11px] text-gray-400">{c.label}</p></div>)}
            </div>

            {l.status === 'ACTIVE' && <button onClick={() => cancelMut.mutate()} className="mb-4 px-3 py-1.5 text-xs border border-red-300 text-red-600 rounded-lg hover:bg-red-50">Cancel Loan</button>}

            <h4 className="text-sm font-semibold text-gray-700 mb-2">Amortization Schedule</h4>
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-xs">
                <thead className="bg-gray-50"><tr>{['#','Month','EMI','Principal','Interest','Balance','Status',''].map(h => <th key={h} className="px-3 py-2 text-left font-semibold text-gray-500">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {l.repayments.map((r: any) => (
                    <tr key={r.id} className="bg-white">
                      <td className="px-3 py-2 text-gray-500">{r.installmentNo}</td>
                      <td className="px-3 py-2 text-gray-600">{MONTHS[r.month-1]} {r.year}</td>
                      <td className="px-3 py-2">{fmt(r.emiAmount)}</td>
                      <td className="px-3 py-2 text-gray-600">{fmt(r.principalPart)}</td>
                      <td className="px-3 py-2 text-gray-600">{fmt(r.interestPart)}</td>
                      <td className="px-3 py-2 text-gray-600">{fmt(r.outstandingAfter)}</td>
                      <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded ${r.status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{r.status}</span></td>
                      <td className="px-3 py-2">{l.status === 'ACTIVE' && r.status === 'SCHEDULED' && <button onClick={() => postMut.mutate(r.installmentNo)} disabled={postMut.isPending} className="text-indigo-600 hover:underline">Post</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Summary Tab ───────────────────────────────────────────────────────────────
function SummaryTab() {
  const { data, isLoading } = useQuery({ queryKey: ['loan-summary'], queryFn: () => loansApi.summary() as any });
  const d = data as any;
  return isLoading ? <div className="text-center py-12 text-gray-400">Loading…</div> : !d ? null : (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4"><p className="text-xs text-gray-500">Active Loans</p><p className="text-2xl font-bold text-gray-900">{d.activeCount}</p></div>
        <div className="bg-white border border-gray-200 rounded-xl p-4"><p className="text-xs text-gray-500">Total Disbursed</p><p className="text-2xl font-bold text-gray-900">{fmt(d.totals.principal)}</p></div>
        <div className="bg-white border border-gray-200 rounded-xl p-4"><p className="text-xs text-gray-500">Total Outstanding</p><p className="text-2xl font-bold text-orange-600">{fmt(d.totals.outstanding)}</p></div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50"><tr>{['Employee','Type','Principal','Rate','EMI','Paid','Outstanding','Status'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100">
            {d.rows.map((r: any) => (
              <tr key={r.id} className="bg-white hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{r.name}<div className="text-xs text-gray-400">{r.employeeCode}</div></td>
                <td className="px-4 py-3 text-gray-600 text-xs">{r.loanType}</td>
                <td className="px-4 py-3">{fmt(r.principal)}</td>
                <td className="px-4 py-3 text-gray-600">{r.interestRate}%</td>
                <td className="px-4 py-3">{fmt(r.emi)}</td>
                <td className="px-4 py-3 text-gray-600">{r.paidInstallments}/{r.tenureMonths}</td>
                <td className="px-4 py-3 font-semibold text-orange-600">{fmt(r.outstanding)}</td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 text-xs rounded-full ${statusBadge[r.status]}`}>{r.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Perquisite Tab ────────────────────────────────────────────────────────────
function PerquisiteTab() {
  const [fy, setFy] = useState(CUR_FY);
  const [projected, setProjected] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['loan-perq', fy, projected], queryFn: () => loansApi.perquisite(fy, projected) as any });
  const d = data as any;
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <select value={fy} onChange={e => setFy(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">{fyList.map(f => <option key={f} value={f}>FY {f}</option>)}</select>
        <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={projected} onChange={e => setProjected(e.target.checked)} className="rounded" /> Project full year</label>
      </div>
      {isLoading ? <div className="text-center py-12 text-gray-400">Loading…</div> : !d ? null : (
        <>
          <div className="p-3 bg-blue-50 rounded-xl text-sm text-blue-800 mb-4">
            Interest-free / concessional loan perquisite (Rule 3(7)(i)) = (SBI rate {d.sbiRate}% − rate charged) on monthly outstanding. Loans ≤ {fmt(d.exemptLimit)} are exempt.
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 w-fit"><p className="text-xs text-gray-500">Total {projected ? 'Projected' : 'Realised'} Perquisite</p><p className="text-2xl font-bold text-indigo-600">{fmt(d.totalPerquisite)}</p></div>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50"><tr>{['Employee','Loan Type','Principal','Rate Charged','SBI Rate','Months','Perquisite'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-gray-100">
                {d.rows.map((r: any) => (
                  <tr key={r.loanId} className="bg-white hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{r.name}<div className="text-xs text-gray-400">{r.employeeCode}</div></td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{r.loanType}</td>
                    <td className="px-4 py-3">{fmt(r.principal)}</td>
                    <td className="px-4 py-3 text-gray-600">{r.rateCharged}%</td>
                    <td className="px-4 py-3 text-gray-600">{r.sbiRate}%</td>
                    <td className="px-4 py-3 text-gray-600">{r.monthsCounted}</td>
                    <td className="px-4 py-3 font-semibold text-indigo-700">{fmt(r.perquisite)}</td>
                  </tr>
                ))}
                {!d.rows.length && <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">No taxable loan perquisites for FY {fy}</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

const TABS = ['Loans', 'Summary', 'Loan Perquisites'];
export default function LoansPage() {
  const [tab, setTab] = useState(0);
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Loans 💵</h1>
        <p className="text-sm text-gray-500 mt-1">Employee loans, EMI amortization, ledger & interest-free-loan perquisites</p>
      </div>
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map((t, i) => <button key={t} onClick={() => setTab(i)} className={`px-4 py-2 text-sm font-medium rounded-lg ${tab === i ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600'}`}>{t}</button>)}
      </div>
      <div>{tab === 0 && <LoansTab />}{tab === 1 && <SummaryTab />}{tab === 2 && <PerquisiteTab />}</div>
    </div>
  );
}
