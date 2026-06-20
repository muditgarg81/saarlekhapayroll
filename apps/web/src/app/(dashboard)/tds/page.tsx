'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tdsApi, employeesApi } from '@/lib/api';

const TABS = [
  { id: 'declarations', label: 'Form 12BB',        icon: '📝' },
  { id: 'computation',  label: 'TDS Computation',   icon: '🧮' },
  { id: 'returns',      label: '24Q Returns',        icon: '📊' },
  { id: 'form16',       label: 'Form 16 / 16A',     icon: '📄' },
] as const;
type TabId = typeof TABS[number]['id'];

const now = new Date();
const CUR_FY = now.getMonth() >= 3
  ? `${now.getFullYear()}-${String(now.getFullYear() + 1).slice(2)}`
  : `${now.getFullYear() - 1}-${String(now.getFullYear()).slice(2)}`;

const fmt    = (n: number) => `₹${Math.round(n ?? 0).toLocaleString('en-IN')}`;
const fyList = Array.from({ length: 5 }, (_, i) => {
  const yr = now.getFullYear() - i + (now.getMonth() >= 3 ? 0 : -1);
  return `${yr}-${String(yr + 1).slice(2)}`;
});

export default function TDSPage() {
  const [tab, setTab] = useState<TabId>('declarations');
  const [fy,  setFy]  = useState(CUR_FY);

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">TDS & Income Tax</h1>
          <p className="text-gray-500 text-sm mt-1">Form 12BB · TDS computation · 24Q filing · Form 16</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">FY</label>
          <select className="input w-28 text-sm" value={fy} onChange={e => setFy(e.target.value)}>
            {fyList.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${tab === t.id ? 'bg-white shadow text-brand-700' : 'text-gray-500 hover:text-gray-700'}`}>
            <span>{t.icon}</span><span>{t.label}</span>
          </button>
        ))}
      </div>

      {tab === 'declarations' && <DeclarationsTab fy={fy} />}
      {tab === 'computation'  && <ComputationTab  fy={fy} />}
      {tab === 'returns'      && <ReturnsTab       fy={fy} />}
      {tab === 'form16'       && <Form16Tab        fy={fy} />}
    </div>
  );
}

// ── Form 12BB Declarations ────────────────────────────────────
function DeclarationsTab({ fy }: { fy: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ['tds-declarations', fy],
    queryFn:  () => tdsApi.listDeclarations(fy),
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => tdsApi.approveDeclaration(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['tds-declarations', fy] }),
  });

  const rows = data as any[];

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Form 12BB — Investment Declarations</h2>
        <p className="text-xs text-gray-500 mt-0.5">Employees submit this to declare investments & exemptions. HR approves to lock TDS computation.</p>
      </div>
      <div className="card overflow-hidden">
        {isLoading ? <div className="p-8 text-center text-gray-400">Loading...</div> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs">
                <th className="px-4 py-2.5 text-left font-medium text-gray-600">Employee</th>
                <th className="px-4 py-2.5 text-center font-medium text-gray-600">Regime</th>
                <th className="px-4 py-2.5 text-right font-medium text-gray-600">80C</th>
                <th className="px-4 py-2.5 text-right font-medium text-gray-600">HRA</th>
                <th className="px-4 py-2.5 text-right font-medium text-gray-600">Home Loan</th>
                <th className="px-4 py-2.5 text-right font-medium text-gray-600">Other</th>
                <th className="px-4 py-2.5 text-center font-medium text-gray-600">Status</th>
                <th className="px-4 py-2.5 text-center font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => {
                const d = r.declaration;
                return (
                  <tr key={r.employeeId} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-gray-400">{r.employeeCode} · {r.designation}</div>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {d ? (
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${d.regime === 'NEW' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                          {d.regime}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs">{d ? fmt(d.section80C) : '—'}</td>
                    <td className="px-4 py-2.5 text-right text-xs">{d ? fmt(d.hraExemption) : '—'}</td>
                    <td className="px-4 py-2.5 text-right text-xs">{d ? fmt(d.homeLoanInterest) : '—'}</td>
                    <td className="px-4 py-2.5 text-right text-xs">{d ? fmt(d.otherDeductions) : '—'}</td>
                    <td className="px-4 py-2.5 text-center">
                      {!d ? (
                        <span className="text-xs text-gray-400">Not submitted</span>
                      ) : d.isApproved ? (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Approved</span>
                      ) : (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Pending</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center flex gap-1 justify-center">
                      <button onClick={() => setEditing(r)} className="text-xs text-brand-600 hover:underline">
                        {d ? 'Edit' : 'Add'}
                      </button>
                      {d && !d.isApproved && (
                        <button onClick={() => approveMut.mutate(d.id)} disabled={approveMut.isPending}
                          className="text-xs text-green-600 hover:underline ml-1">Approve</button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">No active employees found</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
      {editing && (
        <DeclarationModal
          fy={fy}
          employee={editing}
          existing={editing.declaration}
          onClose={() => setEditing(null)}
          onSuccess={() => { setEditing(null); qc.invalidateQueries({ queryKey: ['tds-declarations', fy] }); }}
        />
      )}
    </div>
  );
}

// ── Declaration Form Modal ────────────────────────────────────
function DeclarationModal({ fy, employee, existing, onClose, onSuccess }: any) {
  const [form, setForm] = useState({
    financialYear:     fy,
    regime:            existing?.regime            || 'NEW',
    section80C:        existing?.section80C        || 0,
    epfContribution:   existing?.epfContribution   || 0,
    ppfContribution:   existing?.ppfContribution   || 0,
    elssInvestment:    existing?.elssInvestment     || 0,
    lifeInsurance:     existing?.lifeInsurance      || 0,
    housingLoanPrincipal: existing?.housingLoanPrincipal || 0,
    section80D:        existing?.section80D        || 0,
    section80G:        existing?.section80G        || 0,
    section80E:        existing?.section80E        || 0,
    npsContrib80CCD1B: existing?.npsContrib80CCD1B || 0,
    hraExemption:      existing?.hraExemption      || 0,
    ltaExemption:      existing?.ltaExemption      || 0,
    homeLoanInterest:  existing?.homeLoanInterest   || 0,
    otherDeductions:   existing?.otherDeductions    || 0,
    rentPaidMonthly:   existing?.rentPaidMonthly    || 0,
    isMedroCity:       existing?.isMedroCity        || false,
  });
  const [error, setError] = useState('');
  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: Number(e.target.value) }));

  const mut = useMutation({
    mutationFn: (data: any) => tdsApi.saveDeclaration(employee.employeeId, data),
    onSuccess,
    onError: (e: any) => setError(e.message || 'Failed to save'),
  });

  const total80C = Number(form.epfContribution) + Number(form.ppfContribution) +
    Number(form.elssInvestment) + Number(form.lifeInsurance) + Number(form.housingLoanPrincipal);
  const cap80C   = Math.min(total80C, 150000);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-gray-200 flex items-start justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold">Form 12BB — {employee.name}</h2>
            <p className="text-xs text-gray-500 mt-0.5">FY {fy} · {employee.employeeCode}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

          {/* Regime selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Tax Regime</label>
            <div className="flex gap-3">
              {['NEW', 'OLD'].map(r => (
                <button key={r} onClick={() => setForm(p => ({ ...p, regime: r }))}
                  className={`flex-1 py-3 rounded-xl border-2 text-sm font-medium transition-colors ${form.regime === r ? (r === 'NEW' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-purple-500 bg-purple-50 text-purple-700') : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                  {r === 'NEW' ? '🆕 New Regime' : '🏛️ Old Regime'}
                  <div className="text-xs font-normal mt-0.5 opacity-70">
                    {r === 'NEW' ? '₹75k std ded · Lower slabs' : '₹50k std ded · All deductions'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 80C — only in old regime */}
          {form.regime === 'OLD' && (
            <Section title="Section 80C Investments" note={`Total: ${fmt(total80C)} → Capped at ₹1,50,000 → Effective: ${fmt(cap80C)}`} color="purple">
              <Grid2>
                <Field label="EPF Contribution"      value={form.epfContribution}   onChange={f('epfContribution')} />
                <Field label="PPF Contribution"      value={form.ppfContribution}   onChange={f('ppfContribution')} />
                <Field label="ELSS / Mutual Funds"   value={form.elssInvestment}    onChange={f('elssInvestment')} />
                <Field label="Life Insurance Premium" value={form.lifeInsurance}    onChange={f('lifeInsurance')} />
                <Field label="Housing Loan Principal" value={form.housingLoanPrincipal} onChange={f('housingLoanPrincipal')} />
              </Grid2>
            </Section>
          )}

          {/* Other deductions — only in old regime */}
          {form.regime === 'OLD' && (
            <Section title="Other Deductions" color="blue">
              <Grid2>
                <Field label="Section 80D (Medical Insurance)"    value={form.section80D}        onChange={f('section80D')}        note="Max ₹25,000" />
                <Field label="Section 80G (Donations)"            value={form.section80G}        onChange={f('section80G')} />
                <Field label="Section 80E (Education Loan Int.)"  value={form.section80E}        onChange={f('section80E')} />
                <Field label="NPS 80CCD(1B) — self contribution"  value={form.npsContrib80CCD1B} onChange={f('npsContrib80CCD1B')} note="Max ₹50,000 extra" />
                <Field label="Home Loan Interest (Sec 24b)"       value={form.homeLoanInterest}  onChange={f('homeLoanInterest')}  note="Max ₹2,00,000" />
                <Field label="Other Deductions"                   value={form.otherDeductions}   onChange={f('otherDeductions')} />
              </Grid2>
            </Section>
          )}

          {/* Exemptions — HRA & LTA (old regime) */}
          {form.regime === 'OLD' && (
            <Section title="Exemptions (House Rent & LTA)" color="teal">
              <Grid2>
                <Field label="Rent Paid Per Month"   value={form.rentPaidMonthly} onChange={f('rentPaidMonthly')} note="Used for HRA auto-calc" />
                <div className="flex items-center gap-2 pt-5">
                  <input type="checkbox" id="metro" checked={form.isMedroCity}
                    onChange={e => setForm(p => ({ ...p, isMedroCity: e.target.checked }))} className="w-4 h-4" />
                  <label htmlFor="metro" className="text-sm text-gray-700">Metro city (50% HRA; else 40%)</label>
                </div>
                <Field label="HRA Exemption Claimed" value={form.hraExemption}   onChange={f('hraExemption')} note="Override auto-calc if needed" />
                <Field label="LTA Exemption"         value={form.ltaExemption}   onChange={f('ltaExemption')} />
              </Grid2>
            </Section>
          )}
        </div>
        <div className="p-5 border-t border-gray-200 flex justify-end gap-3 flex-shrink-0">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={() => mut.mutate(form)} disabled={mut.isPending} className="btn-primary">
            {mut.isPending ? 'Saving...' : 'Save Declaration'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── TDS Computation Tab ───────────────────────────────────────
function ComputationTab({ fy }: { fy: string }) {
  const [selectedEmp, setSelectedEmp] = useState('');
  const { data: employees = [] } = useQuery({ queryKey: ['employees-active'], queryFn: () => employeesApi.list({ status: 'ACTIVE' }) });
  const { data, isLoading } = useQuery({
    queryKey: ['tds-compute', selectedEmp, fy],
    queryFn:  () => tdsApi.computeTDS(selectedEmp, fy),
    enabled:  !!selectedEmp,
  });
  const d = data as any;

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-semibold">TDS Computation Engine</h2>
        <p className="text-xs text-gray-500 mt-0.5">Computes annual tax liability for Old vs New regime. Monthly TDS = remaining liability ÷ remaining months.</p>
      </div>
      <div className="flex items-center gap-3 mb-5">
        <select className="input max-w-xs" value={selectedEmp} onChange={e => setSelectedEmp(e.target.value)}>
          <option value="">Select employee…</option>
          {(employees as any[]).map((e: any) => (
            <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeCode})</option>
          ))}
        </select>
      </div>

      {isLoading && <div className="p-8 text-center text-gray-400">Computing…</div>}
      {d && (
        <div className="space-y-5">
          {/* Summary strip */}
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
            <div className="flex-1">
              <p className="font-semibold text-gray-900">{d.employeeName}</p>
              <p className="text-xs text-gray-500">{d.employeeCode} · PAN: {d.pan}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${d.regime === 'NEW' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
              {d.regime} Regime
            </span>
            {d.recommendation !== d.regime && (
              <span className="px-3 py-1 rounded-full text-xs bg-amber-100 text-amber-700">
                💡 {d.recommendation} regime saves {fmt(Math.abs(d.oldRegime.totalTaxLiability - d.newRegime.totalTaxLiability))}
              </span>
            )}
          </div>

          {/* Old vs New comparison */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: '🏛️ Old Regime', data: d.oldRegime, regime: 'OLD', active: d.regime === 'OLD' },
              { label: '🆕 New Regime', data: d.newRegime, regime: 'NEW', active: d.regime === 'NEW' },
            ].map(col => (
              <div key={col.regime} className={`card p-5 border-2 ${col.active ? 'border-brand-400' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-800">{col.label}</h3>
                  {col.active && <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full">Chosen</span>}
                </div>
                <TaxLine label="Annual Gross Salary"      value={fmt(d.annualGross)} />
                <TaxLine label="Standard Deduction"       value={`− ${fmt(col.data.standardDeduction)}`} sub />
                <TaxLine label="Chapter VI-A & Exemptions" value={`− ${fmt(col.data.totalDeductions - col.data.standardDeduction)}`} sub hidden={col.regime === 'NEW'} />
                <div className="border-t border-gray-200 my-2" />
                <TaxLine label="Taxable Income"            value={fmt(col.data.taxableIncome)} bold />
                <TaxLine label="Gross Tax"                 value={fmt(col.data.grossTax)} />
                {col.data.rebate > 0 && <TaxLine label="Rebate u/s 87A" value={`− ${fmt(col.data.rebate)}`} sub />}
                {col.data.surcharge > 0 && <TaxLine label="Surcharge" value={`+ ${fmt(col.data.surcharge)}`} />}
                <TaxLine label="Health & Ed Cess (4%)"     value={`+ ${fmt(col.data.cess)}`} />
                <div className="border-t border-gray-200 my-2" />
                <TaxLine label="Total Tax Liability"       value={fmt(col.data.totalTaxLiability)} bold highlight />
              </div>
            ))}
          </div>

          {/* Monthly TDS */}
          <div className="grid grid-cols-3 gap-4">
            <SCard label="Annual Tax Liability" value={fmt(d.chosenRegime.totalTaxLiability)} />
            <SCard label="TDS Already Deducted" value={fmt(d.tdsAlreadyDeducted)} sub={`${d.monthsCompleted} months`} />
            <SCard label="Monthly TDS (Remaining)" value={fmt(d.monthlyTDS)} sub={`× ${d.remainingMonths} months`} highlight />
          </div>

          {/* Old regime deduction breakdown */}
          {d.regime === 'OLD' && d.oldRegime.deductionBreakdown && (
            <div className="card p-5">
              <h3 className="font-semibold text-gray-800 mb-3">Old Regime Deduction Breakdown</h3>
              <div className="grid grid-cols-3 gap-2 text-sm">
                {Object.entries(d.oldRegime.deductionBreakdown).filter(([, v]: any) => v > 0).map(([k, v]: any) => (
                  <div key={k} className="flex justify-between py-1 border-b border-gray-100">
                    <span className="text-gray-600 text-xs">{DEDUCTION_LABELS[k] || k}</span>
                    <span className="font-medium text-xs">{fmt(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {!selectedEmp && !isLoading && (
        <div className="card p-12 text-center text-gray-400">Select an employee to compute TDS</div>
      )}
    </div>
  );
}

// ── 24Q Returns Tab ───────────────────────────────────────────
function ReturnsTab({ fy }: { fy: string }) {
  const qc = useQueryClient();
  const [activeQ, setActiveQ] = useState<number | null>(null);
  const { data: returns = [] } = useQuery({ queryKey: ['24q-list', fy], queryFn: () => tdsApi.list24Q(fy) });
  const { data: qData, isLoading: qLoading } = useQuery({
    queryKey: ['24q-compute', fy, activeQ],
    queryFn:  () => tdsApi.compute24Q(activeQ!, fy),
    enabled:  activeQ !== null,
  });
  const fileMut = useMutation({
    mutationFn: (q: number) => tdsApi.mark24QFiled(q, fy),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['24q-list', fy] }); qc.invalidateQueries({ queryKey: ['24q-compute', fy, activeQ] }); },
  });

  const QUARTERS = [
    { q: 1, label: 'Q1 — Apr to Jun' },
    { q: 2, label: 'Q2 — Jul to Sep' },
    { q: 3, label: 'Q3 — Oct to Dec' },
    { q: 4, label: 'Q4 — Jan to Mar' },
  ];

  const retMap = Object.fromEntries((returns as any[]).map(r => [r.quarter, r]));
  const qd = qData as any;

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-semibold">24Q — Quarterly TDS Returns</h2>
        <p className="text-xs text-gray-500 mt-0.5">FORM 24Q: Statement of TDS from Salaries for each quarter. Due: Q1 Jul 31 · Q2 Oct 31 · Q3 Jan 31 · Q4 May 31</p>
      </div>

      {/* Quarter selector */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {QUARTERS.map(({ q, label }) => {
          const ret = retMap[q];
          return (
            <button key={q} onClick={() => setActiveQ(q)}
              className={`card p-4 text-left border-2 transition-colors ${activeQ === q ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'}`}>
              <div className="font-semibold text-sm text-gray-800">{label}</div>
              {ret ? (
                <>
                  <div className="text-xs text-gray-500 mt-1">{ret.employeeCount} deductees</div>
                  <div className="text-sm font-medium mt-1">{fmt(ret.totalTDS)} TDS</div>
                  <span className={`text-xs mt-1 inline-block px-1.5 py-0.5 rounded-full ${ret.status === 'FILED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {ret.status === 'FILED' ? '✓ Filed' : 'Pending'}
                  </span>
                </>
              ) : (
                <div className="text-xs text-gray-400 mt-1">Not computed</div>
              )}
            </button>
          );
        })}
      </div>

      {activeQ && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800">Q{activeQ} Deductee-wise Statement</h3>
            <div className="flex gap-2">
              <button onClick={() => qc.invalidateQueries({ queryKey: ['24q-compute', fy, activeQ] })}
                className="btn-secondary text-sm">Refresh</button>
              {qd && retMap[activeQ]?.status !== 'FILED' && (
                <button onClick={() => fileMut.mutate(activeQ)} disabled={fileMut.isPending}
                  className="btn-primary text-sm">Mark as Filed</button>
              )}
            </div>
          </div>
          {qLoading ? <div className="p-8 text-center text-gray-400">Loading…</div> : qd && (
            <>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <SCard label="Deductees" value={String(qd.deductees?.length ?? 0)} />
                <SCard label="Total Salary Paid" value={fmt(qd.totals?.salary)} />
                <SCard label="Total TDS Deducted" value={fmt(qd.totals?.tds)} highlight />
              </div>
              <div className="card overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-xs">
                      <th className="px-4 py-2 text-left font-medium text-gray-600">Employee</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">PAN</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-600">Salary Paid</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-600 bg-brand-50">TDS Deducted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {qd.deductees?.map((d: any, i: number) => (
                      <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-2">
                          <span className="font-medium">{d.name}</span>
                          <span className="text-gray-400 text-xs ml-2">{d.employeeCode}</span>
                        </td>
                        <td className="px-4 py-2 text-xs text-gray-500 font-mono">{d.pan}</td>
                        <td className="px-4 py-2 text-right">{fmt(d.salaryPaid)}</td>
                        <td className="px-4 py-2 text-right font-semibold text-brand-700 bg-brand-50">{fmt(d.tdsDeducted)}</td>
                      </tr>
                    ))}
                    {!qd.deductees?.length && (
                      <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No approved payslips for this quarter</td></tr>
                    )}
                    {qd.deductees?.length > 0 && (
                      <tr className="bg-gray-50 font-semibold border-t border-gray-200">
                        <td colSpan={2} className="px-4 py-2 text-right">Totals</td>
                        <td className="px-4 py-2 text-right">{fmt(qd.totals?.salary)}</td>
                        <td className="px-4 py-2 text-right text-brand-700 bg-brand-50">{fmt(qd.totals?.tds)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
      {!activeQ && <div className="card p-12 text-center text-gray-400">Select a quarter to view the 24Q statement</div>}
    </div>
  );
}

// ── Form 16 Tab ───────────────────────────────────────────────
function Form16Tab({ fy }: { fy: string }) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<any>(null);
  const { data: employees = [] } = useQuery({ queryKey: ['employees-active'], queryFn: () => employeesApi.list({ status: 'ACTIVE' }) });
  const { data: form16s = [], isLoading } = useQuery({ queryKey: ['form16-list', fy], queryFn: () => tdsApi.listForm16(fy) });

  const genMut = useMutation({
    mutationFn: (eid: string) => tdsApi.generateForm16(eid, fy),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['form16-list', fy] }),
  });
  const esignMut = useMutation({
    mutationFn: (id: string) => tdsApi.markEsigned(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['form16-list', fy] }),
  });

  const rows = form16s as any[];
  const STATUS_CLS: Record<string, string> = {
    DRAFT:   'bg-gray-100 text-gray-600',
    ISSUED:  'bg-blue-100 text-blue-700',
    ESIGNED: 'bg-green-100 text-green-700',
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Form 16 / 16A — TDS Certificates</h2>
          <p className="text-xs text-gray-500 mt-0.5">Issued annually post-FY. Part A = TDS deposited · Part B = Salary computation. Mandatory for IT filing.</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="input text-sm w-52" onChange={e => e.target.value && genMut.mutate(e.target.value)} value="">
            <option value="">Generate Form 16 for…</option>
            {(employees as any[]).map((e: any) => (
              <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeCode})</option>
            ))}
          </select>
          <button onClick={() => (employees as any[]).forEach((e: any) => genMut.mutate(e.id))}
            disabled={genMut.isPending} className="btn-primary text-sm">
            {genMut.isPending ? 'Generating…' : 'Generate All'}
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? <div className="p-8 text-center text-gray-400">Loading…</div> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs">
                <th className="px-4 py-2 text-left font-medium text-gray-600">Employee</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">PAN</th>
                <th className="px-4 py-2 text-right font-medium text-gray-600">Gross Salary</th>
                <th className="px-4 py-2 text-right font-medium text-gray-600">Total Deductions</th>
                <th className="px-4 py-2 text-right font-medium text-gray-600">Taxable Income</th>
                <th className="px-4 py-2 text-right font-medium text-gray-600">Tax Liability</th>
                <th className="px-4 py-2 text-right font-medium text-gray-600">TDS Deducted</th>
                <th className="px-4 py-2 text-center font-medium text-gray-600">Status</th>
                <th className="px-4 py-2 text-center font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => (
                <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <div className="font-medium">{r.employee?.firstName} {r.employee?.lastName}</div>
                    <div className="text-xs text-gray-400">{r.employee?.employeeCode} · {r.employee?.designation}</div>
                  </td>
                  <td className="px-4 py-2 text-xs font-mono text-gray-500">{r.employee?.pan}</td>
                  <td className="px-4 py-2 text-right">{fmt(r.grossSalary)}</td>
                  <td className="px-4 py-2 text-right text-gray-500">{fmt(r.totalDeductions)}</td>
                  <td className="px-4 py-2 text-right">{fmt(r.taxableIncome)}</td>
                  <td className="px-4 py-2 text-right font-medium">{fmt(r.totalTaxLiability)}</td>
                  <td className="px-4 py-2 text-right text-brand-700 font-medium">{fmt(r.totalTDSDeducted)}</td>
                  <td className="px-4 py-2 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_CLS[r.status] || ''}`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-2 text-center flex gap-1 justify-center">
                    <button onClick={() => setSelected(r)} className="text-xs text-brand-600 hover:underline">View</button>
                    {r.status === 'ISSUED' && (
                      <button onClick={() => esignMut.mutate(r.id)} disabled={esignMut.isPending}
                        className="text-xs text-green-600 hover:underline ml-1">eSign</button>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">
                  No Form 16s generated yet. Click "Generate All" to create them for all active employees.
                </td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {selected && <Form16Viewer form16={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

// ── Form 16 Viewer (print-ready) ─────────────────────────────
function Form16Viewer({ form16: f, onClose }: { form16: any; onClose: () => void }) {
  const emp = f.employee;
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <h2 className="font-semibold">Form 16 — FY {f.financialYear}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {/* Header */}
          <div className="border-2 border-gray-800 p-4 text-center">
            <p className="text-xs text-gray-500">FORM NO. 16</p>
            <p className="font-bold text-sm">CERTIFICATE UNDER SECTION 203 OF THE INCOME-TAX ACT, 1961</p>
            <p className="text-xs text-gray-500 mt-0.5">For Tax Deducted at Source from Income chargeable under the head "Salaries"</p>
          </div>

          {/* Part A */}
          <div>
            <div className="bg-gray-800 text-white text-xs font-semibold px-3 py-1.5 rounded-t">PART A — TDS CERTIFICATE</div>
            <div className="border border-gray-300 rounded-b p-4 space-y-2 text-sm">
              <Row2 label="Employee Name" value={`${emp?.firstName} ${emp?.lastName}`} />
              <Row2 label="PAN of Employee" value={emp?.pan} mono />
              <Row2 label="Assessment Year" value={`${f.financialYear.split('-')[0].slice(2)}-${f.financialYear.split('-')[1]}`} />
              <Row2 label="Financial Year" value={f.financialYear} />
              <div className="border-t border-gray-200 pt-2 mt-2">
                <Row2 label="Total TDS Deposited" value={fmt(f.totalTDSDeducted)} bold />
              </div>
            </div>
          </div>

          {/* Part B */}
          <div>
            <div className="bg-gray-800 text-white text-xs font-semibold px-3 py-1.5 rounded-t">PART B — DETAILS OF SALARY PAID</div>
            <div className="border border-gray-300 rounded-b p-4 space-y-1.5 text-sm">
              <Row2 label="Gross Salary"         value={fmt(f.grossSalary)} />
              <Row2 label="Standard Deduction"   value={`(−) ${fmt(f.standardDeduction)}`} />
              <Row2 label="Other Deductions"     value={`(−) ${fmt(Math.max(0, f.totalDeductions - f.standardDeduction))}`} />
              <div className="border-t border-gray-200 pt-1.5 mt-1.5">
                <Row2 label="Taxable Income"     value={fmt(f.taxableIncome)} bold />
              </div>
              <div className="border-t border-gray-200 pt-1.5 mt-1.5">
                <Row2 label="Gross Tax on Income" value={fmt(f.grossTax)} />
                {f.surcharge > 0 && <Row2 label="Surcharge" value={fmt(f.surcharge)} />}
                <Row2 label="Health & Ed. Cess" value={fmt(f.cess)} />
                <Row2 label="Total Tax Liability" value={fmt(f.totalTaxLiability)} bold />
              </div>
              <div className="border-t border-gray-200 pt-1.5 mt-1.5">
                <Row2 label="TDS Deducted & Deposited" value={fmt(f.totalTDSDeducted)} bold />
                <Row2 label="Balance Tax Payable / Refundable"
                  value={f.totalTaxLiability > f.totalTDSDeducted
                    ? `${fmt(f.totalTaxLiability - f.totalTDSDeducted)} (Payable)`
                    : `${fmt(f.totalTDSDeducted - f.totalTaxLiability)} (Refund)`}
                  highlight />
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-400 text-center">
            Status: <strong>{f.status}</strong>
            {f.issuedAt && ` · Issued: ${new Date(f.issuedAt).toLocaleDateString('en-IN')}`}
            {f.eSignedAt && ` · eSigned: ${new Date(f.eSignedAt).toLocaleDateString('en-IN')}`}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Tiny helpers ──────────────────────────────────────────────
const DEDUCTION_LABELS: Record<string, string> = {
  sec80C: '80C Investments', sec80D: '80D Medical Ins.', sec80G: '80G Donations',
  sec80E: '80E Education Loan', sec80EE: '80EE Home Loan Extra', nps: '80CCD(1B) NPS',
  hra: 'HRA Exemption', lta: 'LTA Exemption', sec24b: '24(b) Home Loan Int.',
  ptPaid: 'Professional Tax', other: 'Other Deductions', stdDed: 'Standard Deduction',
};

function TaxLine({ label, value, sub = false, bold = false, highlight = false, hidden = false }: any) {
  if (hidden) return null;
  return (
    <div className={`flex justify-between py-0.5 text-sm ${sub ? 'pl-3 text-gray-500' : ''} ${bold ? 'font-semibold' : ''} ${highlight ? 'text-brand-700' : ''}`}>
      <span>{label}</span><span>{value}</span>
    </div>
  );
}

function SCard({ label, value, sub, highlight }: any) {
  return (
    <div className={`card p-4 text-center ${highlight ? 'bg-brand-50 border border-brand-200' : ''}`}>
      <div className={`text-xl font-bold ${highlight ? 'text-brand-700' : 'text-gray-900'}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function Row2({ label, value, mono = false, bold = false, highlight = false }: any) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-600 text-xs">{label}</span>
      <span className={`text-xs ${mono ? 'font-mono' : ''} ${bold ? 'font-semibold' : ''} ${highlight ? 'text-brand-700' : ''}`}>{value}</span>
    </div>
  );
}

function Section({ title, note, color, children }: any) {
  const colors: Record<string, string> = { purple: 'border-purple-200 bg-purple-50', blue: 'border-blue-200 bg-blue-50', teal: 'border-teal-200 bg-teal-50' };
  return (
    <div className={`rounded-xl border p-4 ${colors[color] || ''}`}>
      <div className="mb-2">
        <p className="font-semibold text-sm text-gray-800">{title}</p>
        {note && <p className="text-xs text-gray-500 mt-0.5">{note}</p>}
      </div>
      {children}
    </div>
  );
}

function Grid2({ children }: any) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

function Field({ label, value, onChange, note }: any) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}{note && <span className="text-gray-400 ml-1">({note})</span>}</label>
      <input type="number" className="input text-sm" value={value} onChange={onChange} min={0} />
    </div>
  );
}
