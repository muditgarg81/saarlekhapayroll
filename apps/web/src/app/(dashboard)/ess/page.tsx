'use client';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { essApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { useSearchParams } from 'next/navigation';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmt = (n: number) => `₹${Math.round(n ?? 0).toLocaleString('en-IN')}`;

const REIMB_CATEGORIES = ['TRAVEL','MEDICAL','FOOD','INTERNET','PHONE','OTHER'];

// ── Home Tab ─────────────────────────────────────────────────────────────────
function HomeTab() {
  const { data: dash, isLoading } = useQuery({ queryKey: ['ess-dashboard'], queryFn: () => essApi.dashboard() as any });
  const d = dash as any;

  if (isLoading) return <div className="text-center py-16 text-gray-400">Loading…</div>;
  if (!d?.employee) return (
    <div className="text-center py-16 text-gray-400">
      <p className="text-4xl mb-3">👤</p>
      <p className="font-medium text-gray-600">Your account is not linked to an employee profile.</p>
      <p className="text-sm mt-1">Contact your HR administrator.</p>
    </div>
  );

  const emp = d.employee;
  return (
    <div className="space-y-5">
      {/* Profile card */}
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold">
            {emp.firstName?.[0]}{emp.lastName?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-lg font-bold">{emp.firstName} {emp.lastName}</p>
            <p className="text-indigo-200 text-sm truncate">{emp.designation}</p>
            <p className="text-indigo-300 text-xs mt-0.5">{emp.employeeCode} · {emp.department?.name}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-white/20">
          <div className="text-center">
            <p className="text-white/70 text-xs">CTC</p>
            <p className="font-semibold text-sm">{fmt(emp.ctc / 12)}<span className="text-white/60">/mo</span></p>
          </div>
          <div className="text-center border-x border-white/20">
            <p className="text-white/70 text-xs">Pending Leave</p>
            <p className="font-semibold text-sm">{d.pendingLeave} req</p>
          </div>
          <div className="text-center">
            <p className="text-white/70 text-xs">Claims</p>
            <p className="font-semibold text-sm">{d.pendingReimb} pending</p>
          </div>
        </div>
      </div>

      {/* Latest payslip */}
      {d.latestPayslip && (
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-700">Latest Payslip</p>
            <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">{d.latestPayslip.status}</span>
          </div>
          <p className="text-xs text-gray-400 mb-2">{MONTHS[d.latestPayslip.month - 1]} {d.latestPayslip.year}</p>
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { label: 'Gross', val: fmt(d.latestPayslip.grossEarnings), color: 'text-gray-900' },
              { label: 'Deductions', val: fmt(d.latestPayslip.totalDeductions), color: 'text-red-600' },
              { label: 'Net Pay', val: fmt(d.latestPayslip.netPay), color: 'text-green-700' },
            ].map(c => (
              <div key={c.label} className="bg-gray-50 rounded-xl p-3">
                <p className={`font-bold text-sm ${c.color}`}>{c.val}</p>
                <p className="text-xs text-gray-400 mt-0.5">{c.label}</p>
              </div>
            ))}
          </div>
          <a
            href={essApi.payslipPdfUrl(d.latestPayslip.id)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex items-center justify-center gap-2 w-full py-2 bg-indigo-50 text-indigo-700 rounded-xl text-sm font-medium hover:bg-indigo-100 transition-colors"
          >
            🖨️ View / Download PDF
          </a>
        </div>
      )}

      {/* Leave balances */}
      {d.leaveBalances?.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">Leave Balances — FY {d.financialYear}</p>
          <div className="grid grid-cols-2 gap-2">
            {d.leaveBalances.map((b: any) => (
              <div key={b.leaveType} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: b.color || '#6366f1' }} />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900">{b.available}<span className="text-gray-400 font-normal"> days</span></p>
                  <p className="text-xs text-gray-500 truncate">{b.name}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Payslips Tab ──────────────────────────────────────────────────────────────
function PayslipsTab() {
  const qc = useQueryClient();
  const [year, setYear] = useState(new Date().getFullYear());
  const { data: payslips = [], isLoading } = useQuery({
    queryKey: ['ess-payslips', year],
    queryFn: () => essApi.payslips(year) as any,
  });

  const whatsappMut = useMutation({
    mutationFn: (id: string) => essApi.sendWhatsApp(id),
    onSuccess: () => alert('Payslip queued for WhatsApp delivery ✓'),
  });

  const arr = payslips as any[];

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <p className="text-sm font-semibold text-gray-700 flex-1">Payslips</p>
        <select value={year} onChange={e => setYear(Number(e.target.value))} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
          {[0,1,2,3].map(i => <option key={i} value={new Date().getFullYear() - i}>{new Date().getFullYear() - i}</option>)}
        </select>
      </div>

      {isLoading ? <div className="text-center py-12 text-gray-400">Loading…</div> : (
        <div className="space-y-3">
          {arr.map((p: any) => (
            <div key={p.id} className="bg-white border border-gray-200 rounded-2xl p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{MONTHS[p.month - 1]} {p.year}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{p.paidDays}/{p.workingDays} days · {p.lopDays > 0 ? `LOP ${p.lopDays}d` : 'Full month'}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{p.status}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-xs text-gray-500">Gross</p>
                  <p className="text-sm font-bold text-gray-900">{fmt(p.grossEarnings)}</p>
                </div>
                <div className="bg-red-50 rounded-lg p-2">
                  <p className="text-xs text-gray-500">Deductions</p>
                  <p className="text-sm font-bold text-red-600">{fmt(p.totalDeductions)}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-2">
                  <p className="text-xs text-gray-500">Net Pay</p>
                  <p className="text-sm font-bold text-green-700">{fmt(p.netPay)}</p>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <a
                  href={essApi.payslipPdfUrl(p.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-sm font-medium hover:bg-indigo-100"
                >
                  🖨️ PDF
                </a>
                <button
                  onClick={() => whatsappMut.mutate(p.id)}
                  disabled={whatsappMut.isPending}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-50 text-green-700 rounded-xl text-sm font-medium hover:bg-green-100 disabled:opacity-50"
                >
                  💬 WhatsApp
                </button>
              </div>
            </div>
          ))}
          {arr.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p className="text-3xl mb-2">🧾</p>
              <p>No payslips for {year}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── IT Declaration Tab ────────────────────────────────────────────────────────
function DeclarationTab() {
  const qc = useQueryClient();
  const { data: decl, isLoading } = useQuery({ queryKey: ['ess-declaration'], queryFn: () => essApi.declaration() as any });
  const { data: worksheet } = useQuery({ queryKey: ['ess-worksheet'], queryFn: () => essApi.taxWorksheet() as any });
  const [form, setForm] = useState<any>({});
  const [showForm, setShowForm] = useState(false);

  const d = decl as any;
  const ws = worksheet as any;

  useEffect(() => {
    if (d) setForm({
      regime: d.regime || 'NEW',
      section80C: d.section80C || 0,
      epfContribution: d.epfContribution || 0,
      ppfContribution: d.ppfContribution || 0,
      elssInvestment: d.elssInvestment || 0,
      lifeInsurance: d.lifeInsurance || 0,
      housingLoanPrincipal: d.housingLoanPrincipal || 0,
      section80D: d.section80D || 0,
      section80G: d.section80G || 0,
      section80E: d.section80E || 0,
      npsContrib80CCD1B: d.npsContrib80CCD1B || 0,
      hraExemption: d.hraExemption || 0,
      ltaExemption: d.ltaExemption || 0,
      homeLoanInterest: d.homeLoanInterest || 0,
      rentPaidMonthly: d.rentPaidMonthly || 0,
      isMedroCity: d.isMedroCity || false,
    });
  }, [d]);

  const saveMut = useMutation({
    mutationFn: () => essApi.saveDeclaration(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ess-declaration'] }); qc.invalidateQueries({ queryKey: ['ess-worksheet'] }); setShowForm(false); },
  });

  const sec80CTotal = (form.epfContribution || 0) + (form.ppfContribution || 0) + (form.elssInvestment || 0) + (form.lifeInsurance || 0) + (form.housingLoanPrincipal || 0);
  const sec80CCapped = Math.min(sec80CTotal, 150000);

  const F = ({ label, field, max }: { label: string; field: string; max?: number }) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}{max ? ` (max ₹${(max/100000).toFixed(1)}L)` : ''}</label>
      <input type="number" value={form[field] || ''} onChange={e => setForm({ ...form, [field]: Number(e.target.value) })}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="0" />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Tax worksheet summary */}
      {ws && (
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">Tax Worksheet — FY {ws.financialYear}</p>
          <div className="space-y-2 text-sm">
            {[
              { label: 'Projected Annual Gross', val: fmt(ws.projectedAnnualGross), color: 'text-gray-900' },
              { label: 'Standard Deduction', val: `− ${fmt(ws.standardDeduction)}`, color: 'text-gray-500' },
              { label: 'Other Deductions', val: `− ${fmt(ws.totalDeductions)}`, color: 'text-gray-500' },
              { label: 'Taxable Income', val: fmt(ws.taxableIncome), color: 'text-orange-600 font-bold' },
            ].map(r => (
              <div key={r.label} className="flex justify-between">
                <span className="text-gray-500">{r.label}</span>
                <span className={r.color}>{r.val}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
            <span className="text-gray-400">Regime: <span className="font-semibold text-indigo-600">{ws.regime}</span></span>
            <span className="text-gray-400">{ws.monthsDone} months actual · {ws.monthsLeft} projected</span>
          </div>
        </div>
      )}

      {/* Declaration status */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-700">Form 12BB — IT Declaration</p>
          {d?.isApproved
            ? <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">Approved</span>
            : <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full">Draft</span>
          }
        </div>

        {d && !showForm ? (
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Regime</span><span className="font-medium">{d.regime}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">80C Investments</span><span className="font-medium">{fmt(Math.min(d.section80C + (d.epfContribution||0) + (d.ppfContribution||0) + (d.elssInvestment||0) + (d.lifeInsurance||0), 150000))}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">80D Medical</span><span className="font-medium">{fmt(d.section80D)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">HRA Exemption</span><span className="font-medium">{fmt(d.hraExemption)}</span></div>
            {!d.isApproved && (
              <button onClick={() => setShowForm(true)} className="mt-3 w-full py-2 bg-indigo-50 text-indigo-700 rounded-xl text-sm font-medium hover:bg-indigo-100">
                Edit Declaration
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Regime toggle */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Tax Regime</label>
              <div className="flex gap-2">
                {['NEW','OLD'].map(r => (
                  <button key={r} onClick={() => setForm({ ...form, regime: r })}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${form.regime === r ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                    {r} Regime
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1.5">
                {form.regime === 'NEW' ? 'Std deduction ₹75k · No other deductions · Rebate ≤₹7L' : 'Std deduction ₹50k · 80C/80D/HRA/LTA allowed · Rebate ≤₹5L'}
              </p>
            </div>

            {/* 80C */}
            <div className="border border-gray-200 rounded-xl p-3">
              <p className="text-xs font-semibold text-gray-600 mb-2">Section 80C (max ₹1.5L)</p>
              <div className="grid grid-cols-2 gap-2">
                <F label="EPF" field="epfContribution" />
                <F label="PPF" field="ppfContribution" />
                <F label="ELSS / MF" field="elssInvestment" />
                <F label="Life Insurance" field="lifeInsurance" />
                <F label="Home Loan Principal" field="housingLoanPrincipal" />
              </div>
              <div className="mt-2 p-2 bg-indigo-50 rounded-lg flex justify-between text-xs">
                <span className="text-indigo-600">Total 80C</span>
                <span className="font-bold text-indigo-700">{fmt(sec80CCapped)}{sec80CTotal > 150000 ? ` (capped from ${fmt(sec80CTotal)})` : ''}</span>
              </div>
            </div>

            {/* Other deductions — OLD regime only */}
            {form.regime === 'OLD' && (
              <div className="border border-gray-200 rounded-xl p-3 space-y-2">
                <p className="text-xs font-semibold text-gray-600 mb-1">Other Deductions</p>
                <F label="80D – Medical Insurance" field="section80D" max={50000} />
                <F label="80G – Donations" field="section80G" />
                <F label="80E – Education Loan Interest" field="section80E" />
                <F label="NPS 80CCD(1B)" field="npsContrib80CCD1B" max={50000} />
                <F label="HRA Exemption" field="hraExemption" />
                <F label="LTA Exemption" field="ltaExemption" />
                <F label="Home Loan Interest Sec 24(b)" field="homeLoanInterest" max={200000} />
                <div className="grid grid-cols-2 gap-2">
                  <F label="Rent Paid/Month" field="rentPaidMonthly" />
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Metro City?</label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer mt-2">
                      <input type="checkbox" checked={!!form.isMedroCity} onChange={e => setForm({ ...form, isMedroCity: e.target.checked })} className="rounded" />
                      Yes (50% HRA)
                    </label>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              {d && <button onClick={() => setShowForm(false)} className="flex-1 py-2 border border-gray-300 rounded-xl text-sm">Cancel</button>}
              <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="flex-1 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
                {saveMut.isPending ? 'Saving…' : 'Save Declaration'}
              </button>
            </div>
          </div>
        )}

        {!d && !showForm && (
          <button onClick={() => setShowForm(true)} className="w-full py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium">
            + Start Declaration
          </button>
        )}
      </div>
    </div>
  );
}

// ── Reimbursements Tab ────────────────────────────────────────────────────────
function ReimbursementsTab() {
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);
  const isHR = ['SUPER_ADMIN','ADMIN','HR_MANAGER'].includes(user?.role || '');
  const [view, setView] = useState<'my'|'all'>('my');
  const [showForm, setShowForm] = useState(false);
  const [hrStatus, setHrStatus] = useState('');
  const [form, setForm] = useState<any>({ category: 'TRAVEL', claimDate: new Date().toISOString().split('T')[0] });

  const { data: myClaims = [] } = useQuery({ queryKey: ['ess-my-claims'], queryFn: () => essApi.myClaims() as any });
  const { data: allClaims = [] } = useQuery({ queryKey: ['ess-all-claims', hrStatus], queryFn: () => essApi.allClaims(hrStatus || undefined) as any, enabled: isHR });

  const submitMut = useMutation({ mutationFn: () => essApi.submitClaim(form), onSuccess: () => { qc.invalidateQueries({ queryKey: ['ess-my-claims'] }); setShowForm(false); setForm({ category: 'TRAVEL', claimDate: new Date().toISOString().split('T')[0] }); } });
  const cancelMut = useMutation({ mutationFn: (id: string) => essApi.cancelClaim(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['ess-my-claims'] }) });
  const reviewMut = useMutation({ mutationFn: (d: any) => essApi.reviewClaim(d.id, { status: d.status }), onSuccess: () => qc.invalidateQueries({ queryKey: ['ess-all-claims'] }) });
  const paidMut   = useMutation({ mutationFn: (id: string) => essApi.markClaimPaid(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['ess-all-claims'] }) });

  const statusColor: Record<string, string> = { PENDING: 'bg-yellow-100 text-yellow-700', APPROVED: 'bg-green-100 text-green-700', REJECTED: 'bg-red-100 text-red-700', PAID: 'bg-blue-100 text-blue-700' };
  const displayList = view === 'my' ? (myClaims as any[]) : (allClaims as any[]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        {isHR ? (
          <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg">
            {(['my','all'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${view === v ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}>
                {v === 'my' ? 'My Claims' : 'All Claims'}
              </button>
            ))}
          </div>
        ) : <p className="text-sm font-semibold text-gray-700">Reimbursements</p>}
        <button onClick={() => setShowForm(true)} className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-xl hover:bg-indigo-700">+ New Claim</button>
      </div>

      {view === 'all' && isHR && (
        <div className="flex gap-2 mb-3">
          {['','PENDING','APPROVED','REJECTED','PAID'].map(s => (
            <button key={s} onClick={() => setHrStatus(s)} className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${hrStatus === s ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 text-gray-600'}`}>{s || 'All'}</button>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {displayList.map((c: any) => (
          <div key={c.id} className="bg-white border border-gray-200 rounded-2xl p-4">
            <div className="flex items-start justify-between">
              <div>
                {view === 'all' && <p className="text-xs text-gray-400 mb-0.5">{c.employee?.firstName} {c.employee?.lastName} · {c.employee?.employeeCode}</p>}
                <p className="font-medium text-gray-900">{c.category} — {fmt(c.amount)}</p>
                <p className="text-xs text-gray-500 mt-0.5">{c.description}</p>
                <p className="text-xs text-gray-400 mt-0.5">{new Date(c.claimDate).toLocaleDateString('en-IN')}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[c.status] || ''}`}>{c.status}</span>
            </div>
            {c.receiptUrl && <a href={c.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline mt-1 inline-block">View Receipt</a>}
            {c.reviewComment && <p className="text-xs text-gray-400 mt-1 italic">"{c.reviewComment}"</p>}
            <div className="flex gap-2 mt-2">
              {view === 'my' && c.status === 'PENDING' && (
                <button onClick={() => cancelMut.mutate(c.id)} className="text-xs text-red-500 hover:underline">Cancel</button>
              )}
              {view === 'all' && c.status === 'PENDING' && (
                <>
                  <button onClick={() => reviewMut.mutate({ id: c.id, status: 'APPROVED' })} className="text-xs text-green-600 font-medium hover:underline">Approve</button>
                  <button onClick={() => reviewMut.mutate({ id: c.id, status: 'REJECTED' })} className="text-xs text-red-500 hover:underline">Reject</button>
                </>
              )}
              {view === 'all' && c.status === 'APPROVED' && (
                <button onClick={() => paidMut.mutate(c.id)} className="text-xs text-blue-600 font-medium hover:underline">Mark Paid</button>
              )}
            </div>
          </div>
        ))}
        {displayList.length === 0 && (
          <div className="text-center py-10 text-gray-400">
            <p className="text-3xl mb-2">🧾</p>
            <p className="text-sm">No reimbursement claims</p>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50 sm:items-center">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">New Reimbursement Claim</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {REIMB_CATEGORIES.map(cat => (
                    <button key={cat} onClick={() => setForm({ ...form, category: cat })}
                      className={`py-1.5 text-xs rounded-lg border font-medium transition-colors ${form.category === cat ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Amount (₹) *</label><input type="number" value={form.amount || ''} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Description *</label><input value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Claim Date</label><input type="date" value={form.claimDate} onChange={e => setForm({ ...form, claimDate: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Receipt URL (optional)</label><input value={form.receiptUrl || ''} onChange={e => setForm({ ...form, receiptUrl: e.target.value })} placeholder="https://…" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm">Cancel</button>
              <button onClick={() => submitMut.mutate()} disabled={submitMut.isPending} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
                {submitMut.isPending ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'home',          label: 'Home',       icon: '🏠' },
  { id: 'payslips',      label: 'Payslips',   icon: '🧾' },
  { id: 'declaration',   label: 'IT Decl.',   icon: '📝' },
  { id: 'reimbursements',label: 'Claims',     icon: '💰' },
] as const;
type TabId = typeof TABS[number]['id'];

export default function ESSPage() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabId) || 'home';
  const [tab, setTab] = useState<TabId>(initialTab);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Mobile-style header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">S</span>
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">Employee Self-Service</p>
            <p className="text-xs text-gray-400">Saarlekha Payroll</p>
          </div>
          <div className="ml-auto">
            <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full font-medium">PWA</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 pt-5">
        {tab === 'home'           && <HomeTab />}
        {tab === 'payslips'       && <PayslipsTab />}
        {tab === 'declaration'    && <DeclarationTab />}
        {tab === 'reimbursements' && <ReimbursementsTab />}
      </div>

      {/* Bottom nav bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-20">
        <div className="max-w-lg mx-auto grid grid-cols-4">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-col items-center gap-1 py-3 text-center transition-colors ${
                tab === t.id ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <span className="text-xl leading-none">{t.icon}</span>
              <span className="text-[10px] font-medium">{t.label}</span>
              {tab === t.id && <span className="absolute bottom-0 w-8 h-0.5 bg-indigo-600 rounded-full" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
