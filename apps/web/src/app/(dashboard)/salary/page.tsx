'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { salaryApi } from '@/lib/api';

type Tab = 'components' | 'structures' | 'simulator';

const CALC_TYPES = [
  { value: 'FIXED',               label: 'Fixed Amount (₹)' },
  { value: 'PERCENTAGE_OF_CTC',   label: '% of Monthly CTC' },
  { value: 'PERCENTAGE_OF_BASIC', label: '% of Basic' },
  { value: 'PERCENTAGE_OF_GROSS', label: '% of Gross Earnings' },
  { value: 'FORMULA',             label: 'Formula' },
];

const FORMULA_VARS = ['MONTHLY_CTC', 'CTC', 'BASIC', 'HRA', 'DA', 'LTA', 'BONUS', 'SA', 'GROSS',
  'PF_EMPLOYEE', 'PF_EMPLOYER', 'ESI_EMPLOYEE'];

export default function SalarySetupPage() {
  const [tab, setTab] = useState<Tab>('components');

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Salary Structure Engine</h1>
          <p className="text-gray-500 text-sm mt-1">Configure components, build templates, and simulate take-home</p>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit mb-6">
        {(['components', 'structures', 'simulator'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors capitalize ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
          >
            {t === 'components' ? 'Components' : t === 'structures' ? 'Templates' : 'Simulator'}
          </button>
        ))}
      </div>

      {tab === 'components' && <ComponentsTab />}
      {tab === 'structures' && <StructuresTab />}
      {tab === 'simulator' && <SimulatorTab />}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Components Tab
// ──────────────────────────────────────────────────────────────
function ComponentsTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [error, setError] = useState('');

  const { data: components = [], isLoading } = useQuery({
    queryKey: ['salary-components'],
    queryFn: salaryApi.components,
  });

  const seedMutation = useMutation({
    mutationFn: salaryApi.seedDefaults,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['salary-components'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => salaryApi.deleteComponent(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['salary-components'] }),
    onError: (e: any) => setError(e.message || 'Cannot deactivate component'),
  });

  const earnings = (components as any[]).filter((c: any) => c.type === 'EARNING');
  const deductions = (components as any[]).filter((c: any) => c.type === 'DEDUCTION');

  return (
    <div className="space-y-4">
      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

      <div className="flex gap-2 justify-end">
        {(components as any[]).length === 0 && (
          <button onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending} className="btn-secondary">
            {seedMutation.isPending ? 'Loading...' : '⚡ Load Defaults'}
          </button>
        )}
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="btn-primary">+ Add Component</button>
      </div>

      {isLoading ? <div className="p-8 text-center text-gray-500">Loading...</div> : (
        <div className="space-y-6">
          {[{ label: 'Earnings', items: earnings, color: 'green' }, { label: 'Deductions', items: deductions, color: 'red' }].map(group => (
            <div key={group.label} className="card overflow-hidden">
              <div className={`px-5 py-3 border-b border-gray-100 bg-${group.color}-50`}>
                <h3 className={`font-semibold text-${group.color}-800 text-sm`}>{group.label}</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-xs">
                    <th className="px-4 py-2 text-left font-medium text-gray-500">Name</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">Code</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">Calculation</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">Value / Formula</th>
                    <th className="px-4 py-2 text-center font-medium text-gray-500">Statutory</th>
                    <th className="px-4 py-2 text-center font-medium text-gray-500">Taxable</th>
                    <th className="px-4 py-2 text-center font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {group.items.map((c: any) => (
                    <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                      <td className="px-4 py-3"><span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{c.code}</span></td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{CALC_TYPES.find(t => t.value === c.calculationType)?.label || c.calculationType}</td>
                      <td className="px-4 py-3 text-gray-700 font-mono text-xs max-w-xs truncate">
                        {c.calculationType === 'FORMULA' ? c.formula || '—' : c.calculationType === 'FIXED' ? `₹${c.value}` : `${c.value}%`}
                      </td>
                      <td className="px-4 py-3 text-center">{c.isStatutory ? <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Yes</span> : '—'}</td>
                      <td className="px-4 py-3 text-center">{c.isTaxable ? '✓' : '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex gap-2 justify-center">
                          <button onClick={() => { setEditing(c); setShowForm(true); }} className="text-xs text-brand-600 hover:underline">Edit</button>
                          {!c.isStatutory && (
                            <button onClick={() => deleteMutation.mutate(c.id)} className="text-xs text-red-500 hover:underline">Remove</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {group.items.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400 text-sm">No {group.label.toLowerCase()} yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <ComponentForm
          initial={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSuccess={() => { setShowForm(false); setEditing(null); qc.invalidateQueries({ queryKey: ['salary-components'] }); }}
        />
      )}
    </div>
  );
}

function ComponentForm({ initial, onClose, onSuccess }: { initial: any; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    code: initial?.code || '',
    type: initial?.type || 'EARNING',
    calculationType: initial?.calculationType || 'PERCENTAGE_OF_CTC',
    value: initial?.value ?? 0,
    formula: initial?.formula || '',
    isTaxable: initial?.isTaxable ?? true,
    isStatutory: initial?.isStatutory ?? false,
  });
  const [error, setError] = useState('');

  const createMutation = useMutation({
    mutationFn: (data: any) => salaryApi.createComponent(data),
    onSuccess,
    onError: (e: any) => setError(e.message || 'Failed to save'),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => salaryApi.updateComponent(initial.id, data),
    onSuccess,
    onError: (e: any) => setError(e.message || 'Failed to save'),
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSave = () => {
    setError('');
    const payload = { ...form, value: Number(form.value), code: form.code.toUpperCase().replace(/\s+/g, '_') };
    if (initial) updateMutation.mutate(payload);
    else createMutation.mutate(payload);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">{initial ? 'Edit Component' : 'New Salary Component'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        {error && <div className="mx-5 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input className="input" value={form.name} onChange={set('name')} placeholder="e.g. House Rent Allowance" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
              <input className="input uppercase" value={form.code} onChange={set('code')} placeholder="e.g. HRA" disabled={!!initial} />
              {!initial && <p className="text-xs text-gray-400 mt-1">Used in formulas — no spaces</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
              <select className="input" value={form.type} onChange={set('type')}>
                <option value="EARNING">Earning</option>
                <option value="DEDUCTION">Deduction</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Calculation *</label>
              <select className="input" value={form.calculationType} onChange={set('calculationType')}>
                {CALC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          {form.calculationType !== 'FORMULA' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {form.calculationType === 'FIXED' ? 'Monthly Amount (₹)' : 'Percentage (%)'}
              </label>
              <input type="number" className="input" value={form.value} onChange={set('value')} min={0} step={0.01} />
            </div>
          )}

          {form.calculationType === 'FORMULA' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Formula *</label>
              <textarea className="input font-mono text-sm h-20 resize-none" value={form.formula} onChange={set('formula')}
                placeholder="e.g. MONTHLY_CTC - BASIC - HRA - DA - LTA - PF_EMPLOYER" />
              <div className="mt-2 flex flex-wrap gap-1">
                {FORMULA_VARS.map(v => (
                  <button key={v} type="button" onClick={() => setForm(f => ({ ...f, formula: (f.formula + ' ' + v).trimStart() }))}
                    className="text-xs bg-gray-100 hover:bg-brand-100 text-gray-700 hover:text-brand-700 px-1.5 py-0.5 rounded font-mono">
                    {v}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1">Click a variable to insert it. Use +, -, *, / and parentheses.</p>
            </div>
          )}

          <div className="flex gap-6 pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isTaxable} onChange={e => setForm(f => ({ ...f, isTaxable: e.target.checked }))} className="rounded" />
              <span className="text-sm text-gray-700">Taxable</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isStatutory} onChange={e => setForm(f => ({ ...f, isStatutory: e.target.checked }))} className="rounded" />
              <span className="text-sm text-gray-700">Statutory</span>
            </label>
          </div>
        </div>

        <div className="p-5 border-t border-gray-200 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={isPending} className="btn-primary">
            {isPending ? 'Saving...' : 'Save Component'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Structures (Templates) Tab
// ──────────────────────────────────────────────────────────────
function StructuresTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [error, setError] = useState('');

  const { data: structures = [], isLoading } = useQuery({
    queryKey: ['salary-structures'],
    queryFn: salaryApi.structures,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => salaryApi.deleteStructure(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['salary-structures'] }),
    onError: (e: any) => setError(e.message || 'Cannot remove structure'),
  });

  return (
    <div className="space-y-4">
      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
      <div className="flex justify-end">
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="btn-primary">+ New Template</button>
      </div>

      {isLoading ? <div className="p-8 text-center text-gray-500">Loading...</div> : (
        <div className="grid grid-cols-1 gap-4">
          {(structures as any[]).map((s: any) => {
            const earnings = s.components.filter((sc: any) => sc.component.type === 'EARNING');
            const deductions = s.components.filter((sc: any) => sc.component.type === 'DEDUCTION');
            return (
              <div key={s.id} className="card p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="font-semibold text-gray-900 text-base">{s.name}</div>
                    {s.description && <div className="text-sm text-gray-500 mt-0.5">{s.description}</div>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setEditing(s); setShowForm(true); }} className="text-xs text-brand-600 hover:underline">Edit</button>
                    <button onClick={() => deleteMutation.mutate(s.id)} className="text-xs text-red-500 hover:underline">Remove</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">Earnings</p>
                    <div className="space-y-1">
                      {earnings.map((sc: any) => (
                        <div key={sc.componentId} className="flex items-center justify-between text-sm">
                          <span className="text-gray-700">{sc.component.name}</span>
                          <span className="font-mono text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{sc.component.code}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2">Deductions</p>
                    <div className="space-y-1">
                      {deductions.map((sc: any) => (
                        <div key={sc.componentId} className="flex items-center justify-between text-sm">
                          <span className="text-gray-700">{sc.component.name}</span>
                          <span className="font-mono text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{sc.component.code}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
                  {s.components.length} components · Formula-based SA auto-balances take-home
                </div>
              </div>
            );
          })}
          {(structures as any[]).length === 0 && (
            <div className="card p-12 text-center text-gray-500">No templates yet. Create your first salary template.</div>
          )}
        </div>
      )}

      {showForm && (
        <StructureForm
          initial={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSuccess={() => { setShowForm(false); setEditing(null); qc.invalidateQueries({ queryKey: ['salary-structures'] }); }}
        />
      )}
    </div>
  );
}

function StructureForm({ initial, onClose, onSuccess }: { initial: any; onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState(initial?.name || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [selected, setSelected] = useState<string[]>(
    initial ? initial.components.map((sc: any) => sc.componentId) : []
  );
  const [error, setError] = useState('');

  const { data: components = [] } = useQuery({ queryKey: ['salary-components'], queryFn: salaryApi.components });

  const earnings = (components as any[]).filter((c: any) => c.type === 'EARNING');
  const deductions = (components as any[]).filter((c: any) => c.type === 'DEDUCTION');

  const toggle = (id: string) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const createMutation = useMutation({
    mutationFn: (data: any) => salaryApi.createStructure(data),
    onSuccess,
    onError: (e: any) => setError(e.message || 'Failed to save'),
  });
  const updateMutation = useMutation({
    mutationFn: (data: any) => salaryApi.updateStructure(initial.id, data),
    onSuccess,
    onError: (e: any) => setError(e.message || 'Failed to save'),
  });

  const handleSave = () => {
    setError('');
    if (!name.trim()) { setError('Name is required'); return; }
    if (selected.length === 0) { setError('Select at least one component'); return; }
    const payload = { name, description, componentIds: selected };
    if (initial) updateMutation.mutate(payload);
    else createMutation.mutate(payload);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const ComponentGroup = ({ label, items, color }: { label: string; items: any[]; color: string }) => (
    <div>
      <p className={`text-xs font-semibold text-${color}-700 uppercase tracking-wide mb-2`}>{label}</p>
      <div className="space-y-1">
        {items.map((c: any) => (
          <label key={c.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
            <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggle(c.id)} className="rounded" />
            <div className="flex-1">
              <span className="text-sm text-gray-800">{c.name}</span>
              {c.isStatutory && <span className="ml-2 text-xs text-blue-600 bg-blue-50 px-1 rounded">statutory</span>}
            </div>
            <span className="font-mono text-xs text-gray-400">{c.code}</span>
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="p-5 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <h2 className="font-semibold text-gray-900">{initial ? 'Edit Template' : 'New Salary Template'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        {error && <div className="mx-5 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Template Name *</label>
              <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Standard Full-time" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input className="input" value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional notes" />
            </div>
          </div>

          <div className="border border-gray-200 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">Select Components</p>
              <span className="text-xs text-gray-400">{selected.length} selected</span>
            </div>
            {(components as any[]).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No components yet — go to Components tab and seed defaults first.</p>
            ) : (
              <div className="grid grid-cols-2 gap-6">
                <ComponentGroup label="Earnings" items={earnings} color="green" />
                <ComponentGroup label="Deductions" items={deductions} color="red" />
              </div>
            )}
          </div>
        </div>

        <div className="p-5 border-t border-gray-200 flex justify-end gap-3 flex-shrink-0">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={isPending} className="btn-primary">
            {isPending ? 'Saving...' : 'Save Template'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Simulator Tab
// ──────────────────────────────────────────────────────────────
function SimulatorTab() {
  const [structureId, setStructureId] = useState('');
  const [ctc, setCtc] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const { data: structures = [] } = useQuery({ queryKey: ['salary-structures'], queryFn: salaryApi.structures });

  const simulateMutation = useMutation({
    mutationFn: (data: any) => salaryApi.simulate(data),
    onSuccess: (data) => setResult(data),
    onError: (e: any) => setError(e.message || 'Simulation failed'),
  });

  const handleSimulate = () => {
    setError('');
    setResult(null);
    if (!structureId || !ctc) { setError('Select a template and enter CTC'); return; }
    simulateMutation.mutate({ structureId, ctc: Number(ctc) });
  };

  const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="card p-6">
        <h3 className="font-semibold text-gray-800 mb-4">Salary Calculator</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Salary Template</label>
            <select className="input" value={structureId} onChange={e => setStructureId(e.target.value)}>
              <option value="">Select template</option>
              {(structures as any[]).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Annual CTC (₹)</label>
            <input type="number" className="input" value={ctc} onChange={e => setCtc(e.target.value)}
              placeholder="e.g. 600000" min={0} />
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-4">
          <button onClick={handleSimulate} disabled={simulateMutation.isPending} className="btn-primary">
            {simulateMutation.isPending ? 'Calculating...' : 'Calculate Take-Home'}
          </button>
        </div>
      </div>

      {result && (
        <div className="space-y-4 animate-in fade-in">
          {/* Summary strip */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Annual CTC',     value: fmt(result.ctc) },
              { label: 'Gross / Month',  value: fmt(result.grossEarnings) },
              { label: 'Deductions',     value: fmt(result.totalDeductions) },
              { label: 'Net Take-Home',  value: fmt(result.netPay), highlight: true },
            ].map(s => (
              <div key={s.label} className={`card p-4 text-center ${s.highlight ? 'bg-brand-50 border-brand-200' : ''}`}>
                <div className={`text-lg font-bold ${s.highlight ? 'text-brand-700' : 'text-gray-900'}`}>{s.value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Breakdown table */}
          <div className="card overflow-hidden">
            <div className="grid grid-cols-2 divide-x divide-gray-100">
              {/* Earnings */}
              <div>
                <div className="px-5 py-3 bg-green-50 border-b border-gray-100">
                  <p className="text-xs font-semibold text-green-800 uppercase tracking-wide">Earnings</p>
                </div>
                {result.earnings.map((e: any) => (
                  <div key={e.code} className="flex justify-between px-5 py-2.5 border-b border-gray-50 text-sm">
                    <div>
                      <span className="text-gray-800">{e.name}</span>
                      <span className="ml-2 font-mono text-xs text-gray-400">{e.code}</span>
                    </div>
                    <span className="font-medium text-gray-900">{fmt(e.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between px-5 py-3 bg-green-50 text-sm font-semibold text-green-800">
                  <span>Gross Earnings</span>
                  <span>{fmt(result.grossEarnings)}</span>
                </div>
              </div>

              {/* Deductions */}
              <div>
                <div className="px-5 py-3 bg-red-50 border-b border-gray-100">
                  <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">Deductions</p>
                </div>
                {result.deductions.map((d: any) => (
                  <div key={d.code} className="flex justify-between px-5 py-2.5 border-b border-gray-50 text-sm">
                    <div>
                      <span className="text-gray-800">{d.name}</span>
                      {d.isStatutory && <span className="ml-1 text-xs text-blue-600">★</span>}
                    </div>
                    <span className="font-medium text-red-600">{fmt(d.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between px-5 py-3 bg-red-50 text-sm font-semibold text-red-700">
                  <span>Total Deductions</span>
                  <span>{fmt(result.totalDeductions)}</span>
                </div>
              </div>
            </div>

            {/* Net pay */}
            <div className="flex justify-between px-5 py-4 bg-brand-600 text-white font-bold">
              <span>Monthly Net Pay</span>
              <span>{fmt(result.netPay)}</span>
            </div>
          </div>

          {/* Notes */}
          {result.notes?.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-amber-800 mb-1">Estimation Notes</p>
              <ul className="space-y-0.5">
                {result.notes.map((n: string, i: number) => (
                  <li key={i} className="text-xs text-amber-700">· {n}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
