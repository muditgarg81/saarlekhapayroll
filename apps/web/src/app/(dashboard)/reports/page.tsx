'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reportsApi } from '@/lib/api';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmt = (n: number) => `₹${Math.round(n ?? 0).toLocaleString('en-IN')}`;

const now = new Date();
const CUR_FY = now.getMonth() >= 3
  ? `${now.getFullYear()}-${String(now.getFullYear() + 1).slice(2)}`
  : `${now.getFullYear() - 1}-${String(now.getFullYear()).slice(2)}`;
const fyList = Array.from({ length: 4 }, (_, i) => {
  const yr = now.getFullYear() - i + (now.getMonth() >= 3 ? 0 : -1);
  return `${yr}-${String(yr + 1).slice(2)}`;
});

function MonthPicker({ month, year, setMonth, setYear }: any) {
  return (
    <div className="flex gap-2">
      <select value={month} onChange={e => setMonth(Number(e.target.value))} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
        {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
      </select>
      <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-24" />
    </div>
  );
}

function exportCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Salary Register ───────────────────────────────────────────────────────────
function SalaryRegisterTab() {
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear]   = useState(now.getFullYear());
  const { data, isLoading } = useQuery({ queryKey: ['salary-register', month, year], queryFn: () => reportsApi.salaryRegister(month, year) as any });
  const d = data as any;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <MonthPicker {...{ month, year, setMonth, setYear }} />
        {d?.employees?.length > 0 && (
          <button onClick={() => exportCsv(`salary-register-${month}-${year}.csv`,
            ['Code','Name','Designation','PAN','Paid Days','Gross','Deductions','Net'],
            d.employees.map((e: any) => [e.employeeCode, e.name, e.designation, e.pan, `${e.paidDays}/${e.workingDays}`, e.grossEarnings, e.totalDeductions, e.netPay]))}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">⬇ Export CSV</button>
        )}
      </div>
      {isLoading ? <div className="text-center py-12 text-gray-400">Loading…</div> :
       !d ? <div className="text-center py-12 text-gray-400">No payrun found for {MONTHS[month - 1]} {year}</div> : (
        <>
          <div className="grid grid-cols-4 gap-3 mb-4">
            {[
              { label: 'Employees', val: d.summary.totalEmployees, color: 'text-gray-900' },
              { label: 'Gross', val: fmt(d.summary.totalGross), color: 'text-gray-900' },
              { label: 'Deductions', val: fmt(d.summary.totalDeductions), color: 'text-red-600' },
              { label: 'Net Pay', val: fmt(d.summary.totalNetPay), color: 'text-green-700' },
            ].map(c => (
              <div key={c.label} className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-xs text-gray-500">{c.label}</p>
                <p className={`text-xl font-bold ${c.color}`}>{c.val}</p>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50"><tr>{['Employee','PAN','Paid Days','Gross','Deductions','Net Pay'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-gray-100">
                {d.employees.map((e: any) => (
                  <tr key={e.employeeCode} className="bg-white hover:bg-gray-50">
                    <td className="px-4 py-3"><p className="font-medium text-gray-900">{e.name}</p><p className="text-xs text-gray-400">{e.designation} · {e.employeeCode}</p></td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{e.pan}</td>
                    <td className="px-4 py-3 text-gray-600">{e.paidDays}/{e.workingDays}</td>
                    <td className="px-4 py-3 text-gray-900">{fmt(e.grossEarnings)}</td>
                    <td className="px-4 py-3 text-red-600">{fmt(e.totalDeductions)}</td>
                    <td className="px-4 py-3 font-semibold text-green-700">{fmt(e.netPay)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── Department Cost ───────────────────────────────────────────────────────────
function DepartmentCostTab() {
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear]   = useState(now.getFullYear());
  const { data, isLoading } = useQuery({ queryKey: ['dept-cost', month, year], queryFn: () => reportsApi.departmentCost(month, year) as any });
  const d = data as any;
  const maxCost = d?.departments?.length ? Math.max(...d.departments.map((x: any) => x.employerCost)) : 1;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <MonthPicker {...{ month, year, setMonth, setYear }} />
        {d?.departments?.length > 0 && (
          <button onClick={() => exportCsv(`dept-cost-${month}-${year}.csv`,
            ['Department','Headcount','Gross','Employer PF','Employer ESI','Total CTC Cost','Avg Cost'],
            d.departments.map((x: any) => [x.department, x.headcount, x.gross, x.employerPF, x.employerESI, x.employerCost, x.avgCost]))}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">⬇ Export CSV</button>
        )}
      </div>
      {isLoading ? <div className="text-center py-12 text-gray-400">Loading…</div> :
       !d?.found ? <div className="text-center py-12 text-gray-400">No payrun found for {MONTHS[month - 1]} {year}</div> : (
        <>
          <div className="grid grid-cols-4 gap-3 mb-4">
            {[
              { label: 'Headcount', val: d.totals.headcount, color: 'text-gray-900' },
              { label: 'Gross', val: fmt(d.totals.gross), color: 'text-gray-900' },
              { label: 'Net Paid', val: fmt(d.totals.net), color: 'text-green-700' },
              { label: 'Total Employer Cost', val: fmt(d.totals.employerCost), color: 'text-indigo-600' },
            ].map(c => (
              <div key={c.label} className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-xs text-gray-500">{c.label}</p>
                <p className={`text-xl font-bold ${c.color}`}>{c.val}</p>
              </div>
            ))}
          </div>
          {/* Bar chart */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">Cost by Department</p>
            <div className="space-y-2">
              {d.departments.map((x: any) => (
                <div key={x.department}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-gray-600">{x.department} <span className="text-gray-400">({x.headcount})</span></span>
                    <span className="font-medium text-gray-900">{fmt(x.employerCost)}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(x.employerCost / maxCost) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50"><tr>{['Department','Headcount','Gross','Employer PF','Employer ESI','Total Cost','Avg/Head'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-gray-100">
                {d.departments.map((x: any) => (
                  <tr key={x.department} className="bg-white hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{x.department}</td>
                    <td className="px-4 py-3 text-gray-600">{x.headcount}</td>
                    <td className="px-4 py-3 text-gray-900">{fmt(x.gross)}</td>
                    <td className="px-4 py-3 text-gray-600">{fmt(x.employerPF)}</td>
                    <td className="px-4 py-3 text-gray-600">{fmt(x.employerESI)}</td>
                    <td className="px-4 py-3 font-semibold text-indigo-600">{fmt(x.employerCost)}</td>
                    <td className="px-4 py-3 text-gray-600">{fmt(x.avgCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── Statutory Challans ────────────────────────────────────────────────────────
function ChallanTab() {
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear]   = useState(now.getFullYear());
  const [sub, setSub]     = useState<'pf'|'esi'|'pt'>('pf');

  const { data: pf }  = useQuery({ queryKey: ['challan-pf', month, year], queryFn: () => reportsApi.pfChallan(month, year) as any, enabled: sub === 'pf' });
  const { data: esi } = useQuery({ queryKey: ['challan-esi', month, year], queryFn: () => reportsApi.esiChallan(month, year) as any, enabled: sub === 'esi' });
  const { data: pt }  = useQuery({ queryKey: ['challan-pt', month, year], queryFn: () => reportsApi.ptChallan(month, year) as any, enabled: sub === 'pt' });

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg">
          {(['pf','esi','pt'] as const).map(s => (
            <button key={s} onClick={() => setSub(s)} className={`px-3 py-1 text-xs font-medium rounded-md uppercase transition-colors ${sub === s ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}>{s}</button>
          ))}
        </div>
        <MonthPicker {...{ month, year, setMonth, setYear }} />
      </div>

      {sub === 'pf' && (pf as any) && (
        <div>
          <div className="grid grid-cols-4 gap-3 mb-4">
            {[
              { label: 'Members', val: (pf as any).employeeCount },
              { label: 'PF Wages', val: fmt((pf as any).totals.pfWage) },
              { label: 'Employee + Employer', val: fmt((pf as any).totals.total), color: 'text-indigo-600' },
              { label: 'EPS (Pension)', val: fmt((pf as any).totals.eps) },
            ].map(c => (
              <div key={c.label} className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-xs text-gray-500">{c.label}</p>
                <p className={`text-lg font-bold ${c.color || 'text-gray-900'}`}>{c.val}</p>
              </div>
            ))}
          </div>
          <div className="flex justify-end mb-2">
            <button onClick={async () => { const e: any = await reportsApi.ecr(month, year); if (!e.content) return alert('No PF members for this period'); downloadText(e.filename, e.content); }}
              className="px-3 py-1.5 text-sm border border-indigo-300 text-indigo-600 rounded-lg hover:bg-indigo-50">⬇ Download ECR file (EPFO)</button>
          </div>
          <ChallanTable
            headers={['UAN','Name','PF Wage','Employee 12%','EPF 3.67%','EPS 8.33%','EDLI','Admin','Total']}
            rows={(pf as any).rows.map((r: any) => [r.uan || '—', r.name, fmt(r.pfWage), fmt(r.pfEmployee), fmt(r.epf), fmt(r.eps), fmt(r.edli), fmt(r.admin), fmt(r.total)])}
            empty={(pf as any).rows.length === 0}
            onExport={() => exportCsv(`pf-challan-${month}-${year}.csv`, ['UAN','Name','PF Wage','Employee','EPF','EPS','EDLI','Admin','Total'], (pf as any).rows.map((r: any) => [r.uan, r.name, r.pfWage, r.pfEmployee, r.epf, r.eps, r.edli, r.admin, r.total]))}
          />
        </div>
      )}

      {sub === 'esi' && (esi as any) && (
        <div>
          <div className="grid grid-cols-4 gap-3 mb-4">
            {[
              { label: 'Members', val: (esi as any).employeeCount },
              { label: 'Total Wages', val: fmt((esi as any).totals.grossWage) },
              { label: 'Employee 0.75%', val: fmt((esi as any).totals.esiEmployee) },
              { label: 'Employer 3.25%', val: fmt((esi as any).totals.esiEmployer), color: 'text-indigo-600' },
            ].map(c => (
              <div key={c.label} className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-xs text-gray-500">{c.label}</p>
                <p className={`text-lg font-bold ${c.color || 'text-gray-900'}`}>{c.val}</p>
              </div>
            ))}
          </div>
          <ChallanTable
            headers={['ESI No.','Name','Gross Wage','Employee 0.75%','Employer 3.25%','Total']}
            rows={(esi as any).rows.map((r: any) => [r.esiNumber || '—', r.name, fmt(r.grossWage), fmt(r.esiEmployee), fmt(r.esiEmployer), fmt(r.total)])}
            empty={(esi as any).rows.length === 0}
            onExport={() => exportCsv(`esi-challan-${month}-${year}.csv`, ['ESI No','Name','Gross','Employee','Employer','Total'], (esi as any).rows.map((r: any) => [r.esiNumber, r.name, r.grossWage, r.esiEmployee, r.esiEmployer, r.total]))}
          />
        </div>
      )}

      {sub === 'pt' && (pt as any) && (
        <div>
          <div className="flex flex-wrap gap-2 mb-4">
            {Object.entries((pt as any).byState || {}).map(([st, v]: [string, any]) => (
              <div key={st} className="bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
                <span className="text-xs font-semibold text-indigo-700">{st}</span>
                <span className="text-xs text-gray-500 ml-2">{v.count} emp · {fmt(v.total)}</span>
              </div>
            ))}
            <div className="bg-gray-800 rounded-lg px-3 py-2 ml-auto">
              <span className="text-xs text-gray-300">Total PT</span>
              <span className="text-sm font-bold text-white ml-2">{fmt((pt as any).totalPT)}</span>
            </div>
          </div>
          <ChallanTable
            headers={['Name','Code','State','Gross','PT']}
            rows={(pt as any).rows.map((r: any) => [r.name, r.employeeCode, r.state || '—', fmt(r.gross), fmt(r.pt)])}
            empty={(pt as any).rows.length === 0}
            onExport={() => exportCsv(`pt-challan-${month}-${year}.csv`, ['Name','Code','State','Gross','PT'], (pt as any).rows.map((r: any) => [r.name, r.employeeCode, r.state, r.gross, r.pt]))}
          />
        </div>
      )}
    </div>
  );
}

function ChallanTable({ headers, rows, empty, onExport }: { headers: string[]; rows: any[][]; empty: boolean; onExport: () => void }) {
  return (
    <div>
      {!empty && <div className="flex justify-end mb-2"><button onClick={onExport} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">⬇ Export CSV</button></div>}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50"><tr>{headers.map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r, i) => (
              <tr key={i} className="bg-white hover:bg-gray-50">
                {r.map((c, j) => <td key={j} className={`px-4 py-3 ${j === 0 ? 'font-medium text-gray-900' : 'text-gray-600'}`}>{c}</td>)}
              </tr>
            ))}
            {empty && <tr><td colSpan={headers.length} className="px-4 py-12 text-center text-gray-400">No finalized payslips for this period</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Year-End Tax ──────────────────────────────────────────────────────────────
function YearEndTaxTab() {
  const [fy, setFy] = useState(CUR_FY);
  const { data, isLoading } = useQuery({ queryKey: ['year-end-tax', fy], queryFn: () => reportsApi.yearEndTax(fy) as any });
  const d = data as any;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <select value={fy} onChange={e => setFy(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
          {fyList.map(f => <option key={f} value={f}>FY {f}</option>)}
        </select>
        {d?.rows?.length > 0 && (
          <button onClick={() => exportCsv(`year-end-tax-${fy}.csv`,
            ['Code','Name','PAN','Months','Gross','PF','PT','TDS','Net Paid'],
            d.rows.map((r: any) => [r.employeeCode, r.name, r.pan, r.monthsPaid, r.grossEarnings, r.pfDeducted, r.ptDeducted, r.tdsDeducted, r.netPaid]))}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">⬇ Export CSV</button>
        )}
      </div>
      {isLoading ? <div className="text-center py-12 text-gray-400">Loading…</div> :
       !d?.rows?.length ? <div className="text-center py-12 text-gray-400">No finalized payslips for FY {fy}</div> : (
        <>
          <div className="grid grid-cols-5 gap-3 mb-4">
            {[
              { label: 'Employees', val: d.employeeCount },
              { label: 'Gross', val: fmt(d.totals.grossEarnings) },
              { label: 'PF', val: fmt(d.totals.pfDeducted) },
              { label: 'TDS', val: fmt(d.totals.tdsDeducted), color: 'text-red-600' },
              { label: 'Net Paid', val: fmt(d.totals.netPaid), color: 'text-green-700' },
            ].map(c => (
              <div key={c.label} className="bg-white border border-gray-200 rounded-xl p-3">
                <p className="text-xs text-gray-500">{c.label}</p>
                <p className={`text-lg font-bold ${c.color || 'text-gray-900'}`}>{c.val}</p>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50"><tr>{['Employee','PAN','Months','Gross','PF','PT','TDS','Net Paid'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-gray-100">
                {d.rows.map((r: any) => (
                  <tr key={r.employeeCode} className="bg-white hover:bg-gray-50">
                    <td className="px-4 py-3"><p className="font-medium text-gray-900">{r.name}</p><p className="text-xs text-gray-400">{r.employeeCode}</p></td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{r.pan}</td>
                    <td className="px-4 py-3 text-gray-600">{r.monthsPaid}</td>
                    <td className="px-4 py-3 text-gray-900">{fmt(r.grossEarnings)}</td>
                    <td className="px-4 py-3 text-gray-600">{fmt(r.pfDeducted)}</td>
                    <td className="px-4 py-3 text-gray-600">{fmt(r.ptDeducted)}</td>
                    <td className="px-4 py-3 text-red-600">{fmt(r.tdsDeducted)}</td>
                    <td className="px-4 py-3 font-semibold text-green-700">{fmt(r.netPaid)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── Custom Report Builder ─────────────────────────────────────────────────────
function CustomBuilderTab() {
  const qc = useQueryClient();
  const [periodMode, setPeriodMode] = useState<'single' | 'range'>('single');
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear]   = useState(now.getFullYear());
  const [fromMonth, setFromMonth] = useState(now.getMonth() + 1);
  const [fromYear, setFromYear]   = useState(now.getFullYear());
  const [toMonth, setToMonth]     = useState(now.getMonth() + 1);
  const [toYear, setToYear]       = useState(now.getFullYear());
  const [payrunType, setPayrunType] = useState<'REGULAR' | 'ALL'>('REGULAR');

  const [selected, setSelected] = useState<string[]>(['employeeCode', 'name', 'grossEarnings', 'netPay']);
  const [groupBy, setGroupBy]   = useState<string>('');
  const [sortBy, setSortBy]     = useState<string>('');
  const [sortDir, setSortDir]   = useState<'asc' | 'desc'>('desc');
  const [filters, setFilters]   = useState<any>({});

  const { data: fields } = useQuery({ queryKey: ['report-fields'], queryFn: () => reportsApi.fields() as any });
  const { data: templates = [] } = useQuery({ queryKey: ['report-templates'], queryFn: () => reportsApi.templates() as any });
  const f = fields as any;
  const opts = f?.filterOptions || { departments: [], designations: [], employmentTypes: [] };

  function buildPayload() {
    const cleanFilters: any = {};
    for (const [k, v] of Object.entries(filters)) if (v !== '' && v != null) cleanFilters[k] = v;
    return {
      periodMode,
      ...(periodMode === 'single' ? { month, year } : { fromMonth, fromYear, toMonth, toYear }),
      payrunType,
      columns: selected,
      groupBy: groupBy || null,
      sortBy: sortBy || null,
      sortDir,
      filters: cleanFilters,
    };
  }

  const runMut = useMutation({ mutationFn: () => reportsApi.custom(buildPayload()) });
  const result = runMut.data as any;

  const saveMut = useMutation({
    mutationFn: (name: string) => reportsApi.saveTemplate({ name, config: buildPayload() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['report-templates'] }),
  });
  const delTplMut = useMutation({
    mutationFn: (id: string) => reportsApi.deleteTemplate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['report-templates'] }),
  });

  function loadTemplate(t: any) {
    const c = t.config || {};
    setPeriodMode(c.periodMode || 'single');
    if (c.month) { setMonth(c.month); setYear(c.year); }
    if (c.fromMonth) { setFromMonth(c.fromMonth); setFromYear(c.fromYear); setToMonth(c.toMonth); setToYear(c.toYear); }
    setPayrunType(c.payrunType || 'REGULAR');
    setSelected(c.columns || []);
    setGroupBy(c.groupBy || '');
    setSortBy(c.sortBy || '');
    setSortDir(c.sortDir || 'desc');
    setFilters(c.filters || {});
  }

  function toggle(key: string) {
    setSelected(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  }
  function moveCol(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= selected.length) return;
    const next = [...selected];
    [next[i], next[j]] = [next[j], next[i]];
    setSelected(next);
  }

  const allFields = [...(f?.standardFields || []), ...(f?.componentFields || [])];
  const labelOf = (key: string) => allFields.find((x: any) => x.key === key)?.label || key;
  const isCurrency = (key: string) => allFields.find((x: any) => x.key === key)?.kind === 'currency';
  const isNumeric  = (key: string) => { const k = allFields.find((x: any) => x.key === key)?.kind; return k === 'currency' || k === 'number'; };
  const numericSelected = selected.filter(isNumeric);

  function onSave() {
    const name = window.prompt('Save this report as (template name):');
    if (name?.trim()) saveMut.mutate(name.trim());
  }

  const setFilter = (k: string, v: any) => setFilters((prev: any) => ({ ...prev, [k]: v }));

  return (
    <div className="grid grid-cols-12 gap-5">
      {/* Builder panel */}
      <div className="col-span-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4 sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
          {/* Saved templates */}
          <div className="mb-3">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Saved Templates</label>
            <div className="flex gap-1">
              <select
                onChange={e => { const t = (templates as any[]).find(x => x.id === e.target.value); if (t) loadTemplate(t); }}
                value=""
                className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm">
                <option value="">Load template…</option>
                {(templates as any[]).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <button onClick={onSave} disabled={saveMut.isPending || selected.length === 0}
                className="px-2.5 py-1.5 text-xs border border-indigo-300 text-indigo-600 rounded-lg hover:bg-indigo-50 disabled:opacity-50" title="Save current config">💾</button>
            </div>
            {(templates as any[]).length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {(templates as any[]).map(t => (
                  <span key={t.id} className="inline-flex items-center gap-1 text-[10px] bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">
                    {t.name}
                    <button onClick={() => { if (confirm(`Delete template "${t.name}"?`)) delTplMut.mutate(t.id); }} className="text-red-400 hover:text-red-600">✕</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 pt-3">
            <p className="text-sm font-semibold text-gray-700 mb-2">Period</p>
            <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg mb-2 w-fit">
              {(['single', 'range'] as const).map(m => (
                <button key={m} onClick={() => setPeriodMode(m)} className={`px-3 py-1 text-xs font-medium rounded-md capitalize transition-colors ${periodMode === m ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}>{m === 'single' ? 'Single Month' : 'Date Range'}</button>
              ))}
            </div>
            {periodMode === 'single' ? (
              <MonthPicker {...{ month, year, setMonth, setYear }} />
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-1"><span className="text-xs text-gray-400 w-9">From</span><MonthPicker month={fromMonth} year={fromYear} setMonth={setFromMonth} setYear={setFromYear} /></div>
                <div className="flex items-center gap-1"><span className="text-xs text-gray-400 w-9">To</span><MonthPicker month={toMonth} year={toYear} setMonth={setToMonth} setYear={setToYear} /></div>
                <p className="text-[10px] text-gray-400">Values are summed per employee across the range.</p>
              </div>
            )}
            <div className="mt-2">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Payrun Type</label>
              <select value={payrunType} onChange={e => setPayrunType(e.target.value as any)} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
                <option value="REGULAR">Regular only</option>
                <option value="ALL">All payrun types</option>
              </select>
            </div>
          </div>

          {/* Columns */}
          <div className="border-t border-gray-100 mt-3 pt-3">
            <p className="text-sm font-semibold text-gray-700 mb-2">Columns</p>

            {/* Selected (ordered) */}
            {selected.length > 0 && (
              <div className="mb-2 space-y-1">
                {selected.map((key, i) => (
                  <div key={key} className="flex items-center gap-1 bg-indigo-50 rounded px-2 py-1 text-xs">
                    <span className="text-gray-400 w-4 text-center">{i + 1}</span>
                    <span className="flex-1 text-indigo-700 font-medium">{labelOf(key)}</span>
                    <button onClick={() => moveCol(i, -1)} disabled={i === 0} className="text-gray-400 hover:text-gray-700 disabled:opacity-30">↑</button>
                    <button onClick={() => moveCol(i, 1)} disabled={i === selected.length - 1} className="text-gray-400 hover:text-gray-700 disabled:opacity-30">↓</button>
                    <button onClick={() => toggle(key)} className="text-red-400 hover:text-red-600">✕</button>
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs font-semibold text-gray-500 mb-1 mt-2">Standard Fields</p>
            <div className="space-y-0.5 max-h-40 overflow-y-auto">
              {(f?.standardFields || []).map((fld: any) => (
                <label key={fld.key} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 px-2 py-1 rounded">
                  <input type="checkbox" checked={selected.includes(fld.key)} onChange={() => toggle(fld.key)} className="rounded" />
                  {fld.label}
                </label>
              ))}
            </div>

            {f?.componentFields?.length > 0 && (
              <div className="mt-2">
                <p className="text-xs font-semibold text-gray-500 mb-1">Salary Components</p>
                <div className="space-y-0.5 max-h-40 overflow-y-auto">
                  {f.componentFields.map((fld: any) => (
                    <label key={fld.key} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 px-2 py-1 rounded">
                      <input type="checkbox" checked={selected.includes(fld.key)} onChange={() => toggle(fld.key)} className="rounded" />
                      <span className="flex-1">{fld.label}</span>
                      <span className={`text-[10px] px-1 rounded ${fld.type === 'EARNING' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{fld.type === 'EARNING' ? 'E' : 'D'}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="border-t border-gray-100 mt-3 pt-3">
            <p className="text-sm font-semibold text-gray-700 mb-2">Filters</p>
            <div className="space-y-2">
              <select value={filters.departmentId || ''} onChange={e => setFilter('departmentId', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
                <option value="">All departments</option>
                {opts.departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <select value={filters.designation || ''} onChange={e => setFilter('designation', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
                <option value="">All designations</option>
                {opts.designations.map((d: string) => <option key={d} value={d}>{d}</option>)}
              </select>
              <select value={filters.employmentType || ''} onChange={e => setFilter('employmentType', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
                <option value="">All employment types</option>
                {opts.employmentTypes.map((t: string) => <option key={t} value={t}>{t}</option>)}
              </select>
              <input value={filters.search || ''} onChange={e => setFilter('search', e.target.value)} placeholder="Search name / code…" className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <input type="number" value={filters.minNet ?? ''} onChange={e => setFilter('minNet', e.target.value === '' ? '' : Number(e.target.value))} placeholder="Min net" className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
                <input type="number" value={filters.maxNet ?? ''} onChange={e => setFilter('maxNet', e.target.value === '' ? '' : Number(e.target.value))} placeholder="Max net" className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
                <input type="number" value={filters.minGross ?? ''} onChange={e => setFilter('minGross', e.target.value === '' ? '' : Number(e.target.value))} placeholder="Min gross" className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
                <input type="number" value={filters.maxGross ?? ''} onChange={e => setFilter('maxGross', e.target.value === '' ? '' : Number(e.target.value))} placeholder="Max gross" className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
              </div>
            </div>
          </div>

          {/* Group & sort */}
          <div className="border-t border-gray-100 mt-3 pt-3 space-y-2">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Group By</label>
              <select value={groupBy} onChange={e => setGroupBy(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
                <option value="">None (detail rows)</option>
                <option value="department">Department</option>
                <option value="designation">Designation</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Sort By</label>
              <div className="flex gap-1">
                <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
                  <option value="">Default</option>
                  {selected.map(c => <option key={c} value={c}>{labelOf(c)}</option>)}
                </select>
                <button onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50" title="Toggle direction">
                  {sortDir === 'asc' ? '↑ Asc' : '↓ Desc'}
                </button>
              </div>
            </div>
          </div>

          <button onClick={() => runMut.mutate()} disabled={runMut.isPending || selected.length === 0}
            className="mt-4 w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {runMut.isPending ? 'Running…' : 'Run Report'}
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="col-span-8">
        {!result ? (
          <div className="bg-white border border-gray-200 border-dashed rounded-xl p-12 text-center text-gray-400">
            <p className="text-3xl mb-2">📊</p>
            <p>Configure columns and filters, then click "Run Report"</p>
          </div>
        ) : !result.found ? (
          <div className="text-center py-12 text-gray-400">No payruns found for {result.periodLabel}</div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-medium text-gray-700">{result.periodLabel}</p>
                <p className="text-xs text-gray-400">
                  {result.groups ? `${result.groups.length} groups` : `${result.count} employees`}
                  {result.periodsIncluded > 1 ? ` · ${result.periodsIncluded} payruns aggregated` : ''}
                </p>
              </div>
              <button onClick={() => {
                const cols = result.groups ? ['group', 'count', ...numericSelected] : selected;
                const headers = result.groups ? [groupBy === 'department' ? 'Department' : 'Designation', 'Count', ...numericSelected.map(labelOf)] : selected.map(labelOf);
                const data = result.groups || result.rows;
                exportCsv(`custom-report.csv`, headers, data.map((row: any) => cols.map(c => row[c] ?? '')));
              }} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">⬇ Export CSV</button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                {result.groups ? (
                  <>
                    <thead className="bg-gray-50"><tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{groupBy === 'department' ? 'Department' : 'Designation'}</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Count</th>
                      {numericSelected.map(c => <th key={c} className="px-4 py-3 text-right text-xs font-semibold text-gray-500">{labelOf(c)}</th>)}
                    </tr></thead>
                    <tbody className="divide-y divide-gray-100">
                      {result.groups.map((g: any, i: number) => (
                        <tr key={i} className="bg-white hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{g.group}</td>
                          <td className="px-4 py-3 text-right text-gray-600">{g.count}</td>
                          {numericSelected.map(c => <td key={c} className="px-4 py-3 text-right text-gray-900">{fmt(g[c])}</td>)}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-100 font-semibold">
                        <td className="px-4 py-3 text-gray-900">Total</td>
                        <td className="px-4 py-3 text-right text-gray-900">{result.count}</td>
                        {numericSelected.map(c => <td key={c} className="px-4 py-3 text-right text-gray-900">{fmt(result.totals?.[c] ?? 0)}</td>)}
                      </tr>
                    </tfoot>
                  </>
                ) : (
                  <>
                    <thead className="bg-gray-50"><tr>{selected.map(c => <th key={c} className={`px-4 py-3 text-xs font-semibold text-gray-500 ${isNumeric(c) ? 'text-right' : 'text-left'}`}>{labelOf(c)}</th>)}</tr></thead>
                    <tbody className="divide-y divide-gray-100">
                      {result.rows.map((row: any, i: number) => (
                        <tr key={i} className="bg-white hover:bg-gray-50">
                          {selected.map(c => <td key={c} className={`px-4 py-3 ${isNumeric(c) ? 'text-right text-gray-900' : 'text-gray-700'}`}>{isCurrency(c) ? fmt(row[c]) : row[c]}</td>)}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-100 font-semibold">
                        {selected.map((c, idx) => (
                          <td key={c} className={`px-4 py-3 ${isNumeric(c) ? 'text-right text-gray-900' : 'text-gray-900'}`}>
                            {idx === 0 ? 'Total' : isNumeric(c) ? fmt(result.totals?.[c] ?? 0) : ''}
                          </td>
                        ))}
                      </tr>
                    </tfoot>
                  </>
                )}
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── More Reports ──────────────────────────────────────────────────────────────
const MORE = [
  { key: 'liability', label: 'Payroll Liability', period: 'month' },
  { key: 'annualpt',  label: 'Annual PT',         period: 'fy' },
  { key: 'encash',    label: 'Leave Encashment',  period: 'fy' },
  { key: 'variable',  label: 'Variable Pay',      period: 'month' },
  { key: 'donations', label: 'Donations (80G)',   period: 'fy' },
] as const;

function MoreReportsTab() {
  const [report, setReport] = useState<typeof MORE[number]['key']>('liability');
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear]   = useState(now.getFullYear());
  const [fy, setFy]       = useState(CUR_FY);
  const meta = MORE.find(m => m.key === report)!;

  const { data, isLoading } = useQuery({
    queryKey: ['more-report', report, month, year, fy],
    queryFn: () => {
      switch (report) {
        case 'liability': return reportsApi.payrollLiability(month, year) as any;
        case 'annualpt':  return reportsApi.annualPt(fy) as any;
        case 'encash':    return reportsApi.leaveEncashment(fy) as any;
        case 'variable':  return reportsApi.variablePay(month, year) as any;
        case 'donations': return reportsApi.donations(fy) as any;
      }
    },
  });
  const d = data as any;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg">
          {MORE.map(m => (
            <button key={m.key} onClick={() => setReport(m.key)} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${report === m.key ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}>{m.label}</button>
          ))}
        </div>
        {meta.period === 'month'
          ? <MonthPicker {...{ month, year, setMonth, setYear }} />
          : <select value={fy} onChange={e => setFy(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">{fyList.map(f => <option key={f} value={f}>FY {f}</option>)}</select>}
      </div>

      {isLoading ? <div className="text-center py-12 text-gray-400">Loading…</div> : !d ? null : (
        <>
          {/* Payroll Liability */}
          {report === 'liability' && (!d.found ? <Empty period={`${MONTHS[month - 1]} ${year}`} /> : (
            <div>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <Card label="Net Salary Payable" val={fmt(d.netPayable)} />
                <Card label="Statutory Payable" val={fmt(d.statutoryPayable)} color="text-orange-600" />
                <Card label="Total Liability" val={fmt(d.totalLiability)} color="text-indigo-600" />
              </div>
              <Table headers={['Liability','Category','Pay To','Due Date','Amount']}
                rows={d.lines.map((l: any) => [l.head, l.category, l.payTo, l.due || '—', fmt(l.payable)])}
                onExport={() => exportCsv(`payroll-liability-${month}-${year}.csv`, ['Liability','Category','PayTo','Due','Amount'], d.lines.map((l: any) => [l.head, l.category, l.payTo, l.due || '', l.payable]))} />
            </div>
          ))}

          {/* Annual PT */}
          {report === 'annualpt' && (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-xs">
                <thead className="bg-gray-50"><tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500">Employee</th>
                  {d.monthLabels.map((m: string) => <th key={m} className="px-2 py-2 text-right font-semibold text-gray-500">{m}</th>)}
                  <th className="px-3 py-2 text-right font-semibold text-gray-500">Total</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {d.rows.map((r: any) => (
                    <tr key={r.employeeCode} className="bg-white hover:bg-gray-50">
                      <td className="px-3 py-2"><span className="font-medium text-gray-900">{r.name}</span> <span className="text-gray-400">{r.state}</span></td>
                      {r.months.map((v: number, i: number) => <td key={i} className="px-2 py-2 text-right text-gray-600">{v ? v : '—'}</td>)}
                      <td className="px-3 py-2 text-right font-semibold text-orange-700">{fmt(r.total)}</td>
                    </tr>
                  ))}
                  {!d.rows.length && <tr><td colSpan={14} className="px-3 py-12 text-center text-gray-400">No PT deducted in FY {fy}</td></tr>}
                </tbody>
                {d.rows.length > 0 && <tfoot><tr className="bg-gray-100 font-semibold"><td className="px-3 py-2">Grand Total</td><td colSpan={12} /><td className="px-3 py-2 text-right">{fmt(d.grandTotal)}</td></tr></tfoot>}
              </table>
            </div>
          )}

          {/* Leave Encashment */}
          {report === 'encash' && (
            <div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <Card label="Total Days Encashed" val={String(d.totals.days)} />
                <Card label="Total Amount" val={fmt(d.totals.amount)} color="text-green-700" />
              </div>
              <Table headers={['Employee','Leave Type','Days','Rate/Day','Amount']}
                rows={d.rows.map((r: any) => [`${r.name} (${r.employeeCode})`, r.policy, r.daysEncashed, fmt(r.ratePerDay), fmt(r.amount)])}
                empty="No leave encashment recorded this FY"
                onExport={() => exportCsv(`leave-encashment-${fy}.csv`, ['Employee','Code','LeaveType','Days','RatePerDay','Amount'], d.rows.map((r: any) => [r.name, r.employeeCode, r.policy, r.daysEncashed, r.ratePerDay, r.amount]))} />
            </div>
          )}

          {/* Variable Pay */}
          {report === 'variable' && (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50"><tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Employee</th>
                  {d.components.map((c: string) => <th key={c} className="px-3 py-2 text-right text-xs font-semibold text-gray-500">{c}</th>)}
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Total</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {d.rows.map((r: any) => (
                    <tr key={r.employeeCode} className="bg-white hover:bg-gray-50">
                      <td className="px-3 py-2"><span className="font-medium text-gray-900">{r.name}</span> <span className="text-gray-400 text-xs">{r.employeeCode}</span></td>
                      {d.components.map((c: string) => <td key={c} className="px-3 py-2 text-right text-gray-600">{r.variable[c] ? fmt(r.variable[c]) : '—'}</td>)}
                      <td className="px-3 py-2 text-right font-semibold text-indigo-700">{fmt(r.total)}</td>
                    </tr>
                  ))}
                  {!d.rows.length && <tr><td colSpan={(d.components?.length || 0) + 2} className="px-3 py-12 text-center text-gray-400">No variable pay for {MONTHS[month - 1]} {year}</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* Donations */}
          {report === 'donations' && (
            <div>
              <Card label="Total 80G Donations" val={fmt(d.total)} color="text-green-700" />
              <div className="mt-4">
                <Table headers={['Employee','PAN','Regime','Approved','80G Donation']}
                  rows={d.rows.map((r: any) => [`${r.name} (${r.employeeCode})`, r.pan, r.regime, r.approved ? '✓' : '—', fmt(r.donation80G)])}
                  empty="No 80G donations declared this FY"
                  onExport={() => exportCsv(`donations-${fy}.csv`, ['Employee','Code','PAN','Regime','Approved','Donation80G'], d.rows.map((r: any) => [r.name, r.employeeCode, r.pan, r.regime, r.approved, r.donation80G]))} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Card({ label, val, color }: { label: string; val: string; color?: string }) {
  return <div className="bg-white border border-gray-200 rounded-xl p-4"><p className="text-xs text-gray-500">{label}</p><p className={`text-lg font-bold ${color || 'text-gray-900'}`}>{val}</p></div>;
}
function Empty({ period }: { period: string }) { return <div className="text-center py-12 text-gray-400">No approved payrun found for {period}</div>; }
function Table({ headers, rows, onExport, empty }: { headers: string[]; rows: any[][]; onExport?: () => void; empty?: string }) {
  return (
    <div>
      {onExport && rows.length > 0 && <div className="flex justify-end mb-2"><button onClick={onExport} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">⬇ Export CSV</button></div>}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50"><tr>{headers.map((h, i) => <th key={h} className={`px-4 py-3 text-xs font-semibold text-gray-500 ${i >= headers.length - 1 ? 'text-right' : 'text-left'}`}>{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r, i) => <tr key={i} className="bg-white hover:bg-gray-50">{r.map((c, j) => <td key={j} className={`px-4 py-3 ${j === 0 ? 'font-medium text-gray-900' : j === r.length - 1 ? 'text-right font-semibold text-gray-900' : 'text-gray-600'}`}>{c}</td>)}</tr>)}
            {!rows.length && <tr><td colSpan={headers.length} className="px-4 py-12 text-center text-gray-400">{empty || 'No data'}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
const TABS = ['Salary Register', 'Department Cost', 'Statutory Challans', 'Year-End Tax', 'More Reports', 'Custom Builder'];

export default function ReportsPage() {
  const [tab, setTab] = useState(0);
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Payroll Reports</h1>
        <p className="text-sm text-gray-500 mt-1">Salary registers, cost analysis, statutory challans, and custom reports</p>
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab === i ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>{t}</button>
        ))}
      </div>

      <div>
        {tab === 0 && <SalaryRegisterTab />}
        {tab === 1 && <DepartmentCostTab />}
        {tab === 2 && <ChallanTab />}
        {tab === 3 && <YearEndTaxTab />}
        {tab === 4 && <MoreReportsTab />}
        {tab === 5 && <CustomBuilderTab />}
      </div>
    </div>
  );
}
