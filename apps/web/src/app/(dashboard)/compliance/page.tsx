'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { complianceApi } from '@/lib/api';
import { MONTHS } from '@saarlekha/shared';

const TABS = [
  { id: 'pf',       label: 'PF / EPF',          icon: '🏦' },
  { id: 'esi',      label: 'ESI',                icon: '🏥' },
  { id: 'pt',       label: 'Professional Tax',   icon: '📋' },
  { id: 'lwf',      label: 'LWF',                icon: '⚖️'  },
  { id: 'gratuity', label: 'Gratuity',            icon: '🎁'  },
  { id: 'bonus',    label: 'Statutory Bonus',     icon: '💰'  },
] as const;

type TabId = typeof TABS[number]['id'];

const fmt  = (n: number) => `₹${Math.round(n ?? 0).toLocaleString('en-IN')}`;
const now  = new Date();
const CUR_MONTH = now.getMonth() + 1;
const CUR_YEAR  = now.getFullYear();
const CUR_FY    = now.getMonth() >= 3
  ? `${now.getFullYear()}-${String(now.getFullYear() + 1).slice(2)}`
  : `${now.getFullYear() - 1}-${String(now.getFullYear()).slice(2)}`;

export default function CompliancePage() {
  const [tab, setTab] = useState<TabId>('pf');

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">India Compliance</h1>
        <p className="text-gray-500 text-sm mt-1">PF · ESI · Professional Tax · LWF · Gratuity · Statutory Bonus</p>
      </div>

      {/* Tab strip */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
              tab === t.id ? 'bg-white shadow text-brand-700' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {tab === 'pf'       && <PFTab />}
      {tab === 'esi'      && <ESITab />}
      {tab === 'pt'       && <PTTab />}
      {tab === 'lwf'      && <LWFTab />}
      {tab === 'gratuity' && <GratuityTab />}
      {tab === 'bonus'    && <BonusTab />}
    </div>
  );
}

// ── Shared period picker ───────────────────────────────────────
function PeriodPicker({ month, year, onChange }: { month: number; year: number; onChange: (m: number, y: number) => void }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <select className="input w-36" value={month} onChange={e => onChange(Number(e.target.value), year)}>
        {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
      </select>
      <input type="number" className="input w-24" value={year} onChange={e => onChange(month, Number(e.target.value))} />
    </div>
  );
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
      <div className="text-xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-brand-600 mt-0.5">{sub}</div>}
    </div>
  );
}

// ── PF Tab ────────────────────────────────────────────────────
function PFTab() {
  const [month, setMonth] = useState(CUR_MONTH);
  const [year,  setYear]  = useState(CUR_YEAR);
  const { data, isLoading } = useQuery({
    queryKey: ['compliance-pf', month, year],
    queryFn:  () => complianceApi.pf(month, year),
  });
  const d = data as any;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-lg font-semibold">EPF/EPS Challan</h2>
          <p className="text-xs text-gray-500">Employee 12% · Employer 3.67% EPF + 8.33% EPS + 0.5% EDLI + 0.5% Admin · Wage ceiling ₹15,000</p>
        </div>
      </div>
      <PeriodPicker month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y); }} />
      {isLoading ? <LoadingRow /> : d && (
        <>
          <div className="grid grid-cols-4 gap-3 mb-5">
            <SummaryCard label="Employees"        value={String(d.count ?? d.rows?.length ?? 0)} />
            <SummaryCard label="Employee EPF"     value={fmt(d.totals?.employeeEPF)} />
            <SummaryCard label="Employer (EPF+EPS+EDLI+Admin)" value={fmt(d.totals?.grandTotal - d.totals?.employeeEPF)} />
            <SummaryCard label="Grand Total"      value={fmt(d.totals?.grandTotal)} sub="Challan amount" />
          </div>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs">
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Employee</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">UAN</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Basic</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Capped Wage</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Emp EPF</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Emr EPF</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">EPS</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">EDLI</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Admin</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600 bg-brand-50">Total</th>
                </tr>
              </thead>
              <tbody>
                {d.rows?.map((r: any, i: number) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2"><span className="font-medium">{r.name}</span> <span className="text-gray-400 text-xs">{r.employeeCode}</span></td>
                    <td className="px-3 py-2 text-xs text-gray-500">{r.uan}</td>
                    <td className="px-3 py-2 text-right">{fmt(r.basic)}</td>
                    <td className="px-3 py-2 text-right text-gray-500">{fmt(r.cappedWage)}</td>
                    <td className="px-3 py-2 text-right text-blue-600">{fmt(r.employeeEPF)}</td>
                    <td className="px-3 py-2 text-right">{fmt(r.employerEPF)}</td>
                    <td className="px-3 py-2 text-right">{fmt(r.employerEPS)}</td>
                    <td className="px-3 py-2 text-right">{fmt(r.edli)}</td>
                    <td className="px-3 py-2 text-right">{fmt(r.adminCharge)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-brand-700 bg-brand-50">{fmt(r.grandTotal)}</td>
                  </tr>
                ))}
                {!d.rows?.length && <EmptyRow cols={10} />}
                {d.rows?.length > 0 && (
                  <tr className="bg-gray-50 font-semibold border-t border-gray-200 text-sm">
                    <td colSpan={4} className="px-3 py-2 text-right">Totals</td>
                    <td className="px-3 py-2 text-right text-blue-600">{fmt(d.totals?.employeeEPF)}</td>
                    <td className="px-3 py-2 text-right">{fmt(d.totals?.employerEPF)}</td>
                    <td className="px-3 py-2 text-right">{fmt(d.totals?.employerEPS)}</td>
                    <td className="px-3 py-2 text-right">{fmt(d.totals?.edli)}</td>
                    <td className="px-3 py-2 text-right">{fmt(d.totals?.adminCharge)}</td>
                    <td className="px-3 py-2 text-right text-brand-700 bg-brand-50">{fmt(d.totals?.grandTotal)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            EPF Employee 12% · Employer EPF 3.67% · EPS 8.33% · EDLI 0.50% · Admin 0.50% of min(Basic, ₹15,000)
          </p>
        </>
      )}
    </div>
  );
}

// ── ESI Tab ───────────────────────────────────────────────────
function ESITab() {
  const [month, setMonth] = useState(CUR_MONTH);
  const [year,  setYear]  = useState(CUR_YEAR);
  const { data, isLoading } = useQuery({
    queryKey: ['compliance-esi', month, year],
    queryFn:  () => complianceApi.esi(month, year),
  });
  const d = data as any;

  return (
    <div>
      <div className="mb-2">
        <h2 className="text-lg font-semibold">ESIC Challan</h2>
        <p className="text-xs text-gray-500">Eligible: Gross salary ≤ ₹21,000/month · Employee 0.75% · Employer 3.25%</p>
      </div>
      <PeriodPicker month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y); }} />
      {isLoading ? <LoadingRow /> : d && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-5">
            <SummaryCard label="Eligible Employees" value={String(d.eligibleCount ?? 0)} />
            <SummaryCard label="Employee ESI (0.75%)" value={fmt(d.totals?.employeeESI)} />
            <SummaryCard label="Employer ESI (3.25%)" value={fmt(d.totals?.employerESI)} sub={`Total: ${fmt(d.totals?.total)}`} />
          </div>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs">
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Employee</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">ESI No.</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Gross Wage</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Employee ESI</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Employer ESI</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600 bg-brand-50">Total</th>
                </tr>
              </thead>
              <tbody>
                {d.rows?.map((r: any, i: number) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2"><span className="font-medium">{r.name}</span> <span className="text-gray-400 text-xs">{r.employeeCode}</span></td>
                    <td className="px-3 py-2 text-xs text-gray-500">{r.esiNumber}</td>
                    <td className="px-3 py-2 text-right">{fmt(r.grossWage)}</td>
                    <td className="px-3 py-2 text-right text-blue-600">{fmt(r.employeeESI)}</td>
                    <td className="px-3 py-2 text-right">{fmt(r.employerESI)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-brand-700 bg-brand-50">{fmt(r.total)}</td>
                  </tr>
                ))}
                {!d.rows?.length && <EmptyRow cols={6} msg="No employees with gross ≤ ₹21,000 in this period" />}
                {d.rows?.length > 0 && (
                  <tr className="bg-gray-50 font-semibold border-t border-gray-200">
                    <td colSpan={3} className="px-3 py-2 text-right">Totals</td>
                    <td className="px-3 py-2 text-right text-blue-600">{fmt(d.totals?.employeeESI)}</td>
                    <td className="px-3 py-2 text-right">{fmt(d.totals?.employerESI)}</td>
                    <td className="px-3 py-2 text-right text-brand-700 bg-brand-50">{fmt(d.totals?.total)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── Professional Tax Tab ──────────────────────────────────────
function PTTab() {
  const [month, setMonth] = useState(CUR_MONTH);
  const [year,  setYear]  = useState(CUR_YEAR);
  const { data, isLoading } = useQuery({
    queryKey: ['compliance-pt', month, year],
    queryFn:  () => complianceApi.pt(month, year),
  });
  const d = data as any;

  return (
    <div>
      <div className="mb-2">
        <h2 className="text-lg font-semibold">Professional Tax Register</h2>
        <p className="text-xs text-gray-500">State-wise PT slabs · Maharashtra Feb: +₹100 · States with no PT show ₹0</p>
      </div>
      <PeriodPicker month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y); }} />
      {isLoading ? <LoadingRow /> : d && (
        <>
          {/* By-state summary */}
          {d.byState && Object.keys(d.byState).length > 0 && (
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">State-wise Summary</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(d.byState).map(([state, info]: any) => info.total > 0 && (
                  <div key={state} className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-sm">
                    <span className="font-medium text-gray-800">{state}</span>
                    <span className="text-gray-500 ml-2">{info.count} employees</span>
                    <span className="text-orange-700 font-semibold ml-2">{fmt(info.total)}</span>
                  </div>
                ))}
              </div>
              <p className="text-sm font-semibold text-gray-700 mt-2">Total PT: <span className="text-orange-700">{fmt(d.totalPT)}</span></p>
            </div>
          )}
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs">
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Employee</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">State</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Gross Wage</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600 bg-orange-50">PT Deduction</th>
                </tr>
              </thead>
              <tbody>
                {d.rows?.map((r: any, i: number) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2"><span className="font-medium">{r.name}</span> <span className="text-gray-400 text-xs">{r.employeeCode}</span></td>
                    <td className="px-3 py-2 text-xs text-gray-600">{r.state}</td>
                    <td className="px-3 py-2 text-right">{fmt(r.grossWage)}</td>
                    <td className={`px-3 py-2 text-right font-semibold bg-orange-50 ${r.pt > 0 ? 'text-orange-700' : 'text-gray-400'}`}>{r.pt > 0 ? fmt(r.pt) : '—'}</td>
                  </tr>
                ))}
                {!d.rows?.length && <EmptyRow cols={4} />}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── LWF Tab ───────────────────────────────────────────────────
function LWFTab() {
  const [month, setMonth] = useState(CUR_MONTH);
  const [year,  setYear]  = useState(CUR_YEAR);
  const { data, isLoading } = useQuery({
    queryKey: ['compliance-lwf', month, year],
    queryFn:  () => complianceApi.lwf(month, year),
  });
  const d = data as any;

  return (
    <div>
      <div className="mb-2">
        <h2 className="text-lg font-semibold">Labour Welfare Fund Register</h2>
        <p className="text-xs text-gray-500">State-wise LWF · Monthly / June+Dec / Annual depending on state · Not applicable in all states</p>
      </div>
      <PeriodPicker month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y); }} />
      {isLoading ? <LoadingRow /> : d && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-5">
            <SummaryCard label="Applicable Employees" value={String(d.rows?.length ?? 0)} />
            <SummaryCard label="Employee Contribution" value={fmt(d.totals?.employee)} />
            <SummaryCard label="Employer Contribution" value={fmt(d.totals?.employer)} sub={`Total: ${fmt(d.totals?.total)}`} />
          </div>
          {d.rows?.length === 0 ? (
            <div className="card p-8 text-center text-gray-500">
              <p className="font-medium">LWF not applicable for this month.</p>
              <p className="text-xs mt-1">Most states require LWF only in June, December, or at year-end.</p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-xs">
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Employee</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">State</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-600">Frequency</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600">Employee</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600">Employer</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600 bg-teal-50">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {d.rows?.map((r: any, i: number) => (
                    <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2"><span className="font-medium">{r.name}</span> <span className="text-gray-400 text-xs">{r.employeeCode}</span></td>
                      <td className="px-3 py-2 text-xs text-gray-600">{r.state}</td>
                      <td className="px-3 py-2 text-center">
                        <span className="text-xs bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded">{r.frequency}</span>
                      </td>
                      <td className="px-3 py-2 text-right text-blue-600">{fmt(r.employeeContrib)}</td>
                      <td className="px-3 py-2 text-right">{fmt(r.employerContrib)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-teal-700 bg-teal-50">{fmt(r.total)}</td>
                    </tr>
                  ))}
                  {d.rows?.length > 0 && (
                    <tr className="bg-gray-50 font-semibold border-t border-gray-200">
                      <td colSpan={3} className="px-3 py-2 text-right">Totals</td>
                      <td className="px-3 py-2 text-right text-blue-600">{fmt(d.totals?.employee)}</td>
                      <td className="px-3 py-2 text-right">{fmt(d.totals?.employer)}</td>
                      <td className="px-3 py-2 text-right text-teal-700 bg-teal-50">{fmt(d.totals?.total)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Gratuity Tab ──────────────────────────────────────────────
function GratuityTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['compliance-gratuity'],
    queryFn:  () => complianceApi.gratuity(),
  });
  const d = data as any;

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-lg font-semibold">Gratuity Register</h2>
        <p className="text-xs text-gray-500">Payment of Gratuity Act 1972 · Formula: 15/26 × Basic × Years · Min 5 years · Ceiling ₹20 lakh</p>
      </div>
      {isLoading ? <LoadingRow /> : d && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-5">
            <SummaryCard label="Active Employees" value={String(d.rows?.length ?? 0)} />
            <SummaryCard label="Eligible (≥5 yrs)"  value={String(d.rows?.filter((r: any) => r.eligible).length ?? 0)} />
            <SummaryCard label="Total Accrued Liability" value={fmt(d.totalAccrued)} sub="Provision required" />
          </div>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs">
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Employee</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Designation</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-600">DOJ</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Years</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Monthly Basic</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-600">Eligible?</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600 bg-purple-50">Accrued</th>
                </tr>
              </thead>
              <tbody>
                {d.rows?.map((r: any, i: number) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2"><span className="font-medium">{r.name}</span> <span className="text-gray-400 text-xs">{r.employeeCode}</span></td>
                    <td className="px-3 py-2 text-xs text-gray-600">{r.designation}</td>
                    <td className="px-3 py-2 text-center text-xs text-gray-500">{new Date(r.dateOfJoining).toLocaleDateString('en-IN')}</td>
                    <td className="px-3 py-2 text-right">{r.yearsOfService} yrs</td>
                    <td className="px-3 py-2 text-right">{fmt(r.monthlyBasic)}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${r.eligible ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {r.eligible ? 'Yes' : 'Accruing'}
                      </span>
                    </td>
                    <td className={`px-3 py-2 text-right font-semibold bg-purple-50 ${r.eligible ? 'text-purple-700' : 'text-gray-500'}`}>{fmt(r.accruedGratuity)}</td>
                  </tr>
                ))}
                {!d.rows?.length && <EmptyRow cols={7} />}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Formula: 15/26 × Monthly Basic+DA × Years of Service (capped at ₹20 lakh per Gratuity Act 2010 amendment)
          </p>
        </>
      )}
    </div>
  );
}

// ── Bonus Tab ─────────────────────────────────────────────────
function BonusTab() {
  const now = new Date();
  const [fy, setFy] = useState(CUR_FY);
  const { data, isLoading } = useQuery({
    queryKey: ['compliance-bonus', fy],
    queryFn:  () => complianceApi.bonus(fy),
  });
  const d = data as any;

  const fyOptions = Array.from({ length: 5 }, (_, i) => {
    const yr = now.getFullYear() - i;
    return `${yr}-${String(yr + 1).slice(2)}`;
  });

  return (
    <div>
      <div className="mb-2">
        <h2 className="text-lg font-semibold">Statutory Bonus Register</h2>
        <p className="text-xs text-gray-500">Payment of Bonus Act 1965 · Eligibility: Gross ≤ ₹21,000/month · Min 8.33% to max 20% of wages (capped at ₹7,000/month)</p>
      </div>
      <div className="flex items-center gap-3 mb-5">
        <label className="text-sm text-gray-600">Financial Year</label>
        <select className="input w-32" value={fy} onChange={e => setFy(e.target.value)}>
          {fyOptions.map(f => <option key={f} value={f}>FY {f}</option>)}
        </select>
      </div>
      {isLoading ? <LoadingRow /> : d && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-5">
            <SummaryCard label="Eligible Employees" value={String(d.rows?.length ?? 0)} />
            <SummaryCard label="Min Bonus (8.33%)" value={fmt(d.totals?.minBonus)} sub="Statutory minimum" />
            <SummaryCard label="Max Bonus (20%)"   value={fmt(d.totals?.maxBonus)} sub="At full allocation" />
          </div>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs">
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Employee</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Designation</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Monthly Basic</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Calc Base</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Eligible Months</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600 bg-yellow-50">Min Bonus</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600 bg-yellow-100">Max Bonus</th>
                </tr>
              </thead>
              <tbody>
                {d.rows?.map((r: any, i: number) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2"><span className="font-medium">{r.name}</span> <span className="text-gray-400 text-xs">{r.employeeCode}</span></td>
                    <td className="px-3 py-2 text-xs text-gray-600">{r.designation}</td>
                    <td className="px-3 py-2 text-right">{fmt(r.monthlyBasic)}</td>
                    <td className="px-3 py-2 text-right text-gray-500 text-xs">{fmt(r.calcBase)} <span className="text-gray-300">(cap ₹7k)</span></td>
                    <td className="px-3 py-2 text-right">{r.eligibleMonths} mo</td>
                    <td className="px-3 py-2 text-right font-medium text-yellow-700 bg-yellow-50">{fmt(r.minBonus)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-yellow-800 bg-yellow-100">{fmt(r.maxBonus)}</td>
                  </tr>
                ))}
                {!d.rows?.length && <EmptyRow cols={7} msg="No employees with gross salary ≤ ₹21,000/month" />}
                {d.rows?.length > 0 && (
                  <tr className="bg-gray-50 font-semibold border-t border-gray-200">
                    <td colSpan={5} className="px-3 py-2 text-right">Totals</td>
                    <td className="px-3 py-2 text-right text-yellow-700 bg-yellow-50">{fmt(d.totals?.minBonus)}</td>
                    <td className="px-3 py-2 text-right text-yellow-800 bg-yellow-100">{fmt(d.totals?.maxBonus)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Calculation base = min(Monthly Basic, ₹7,000). Min 8.33% (1 month's pay). Pro-rated for partial-year employees.
          </p>
        </>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────
function LoadingRow() {
  return <div className="card p-8 text-center text-gray-500 text-sm">Loading...</div>;
}

function EmptyRow({ cols, msg }: { cols: number; msg?: string }) {
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-10 text-center text-gray-400 text-sm">
        {msg || 'No data for the selected period. Process and approve a payrun first.'}
      </td>
    </tr>
  );
}
