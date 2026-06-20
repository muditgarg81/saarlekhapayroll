'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contractorApi } from '@/lib/api';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmt = (n: number) => `₹${Math.round(n ?? 0).toLocaleString('en-IN')}`;
const ENTITY_TYPES = ['INDIVIDUAL','HUF','FIRM','COMPANY','LLP'];
const TDS_SECTIONS = [
  { code: '194C', label: '194C – Contractors (1%/2%)' },
  { code: '194J', label: '194J – Professional/Technical (10%)' },
  { code: '194H', label: '194H – Commission/Brokerage (5%)' },
  { code: '194I', label: '194I – Rent (10%)' },
  { code: 'NONE', label: 'No TDS' },
];

const now = new Date();
const CUR_FY = now.getMonth() >= 3
  ? `${now.getFullYear()}-${String(now.getFullYear() + 1).slice(2)}`
  : `${now.getFullYear() - 1}-${String(now.getFullYear()).slice(2)}`;
const fyList = Array.from({ length: 4 }, (_, i) => {
  const yr = now.getFullYear() - i + (now.getMonth() >= 3 ? 0 : -1);
  return `${yr}-${String(yr + 1).slice(2)}`;
});

// ── Contractors Tab ───────────────────────────────────────────────────────────
function ContractorsTab() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const { data: contractors = [], isLoading } = useQuery({ queryKey: ['contractors', status], queryFn: () => contractorApi.list(status || undefined) as any });
  const [modal, setModal] = useState<any>(null);
  const [form, setForm] = useState<any>({});

  const saveMut = useMutation({
    mutationFn: () => modal?.id ? contractorApi.update(modal.id, form) : contractorApi.create(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contractors'] }); setModal(null); },
  });
  const deactMut = useMutation({ mutationFn: (id: string) => contractorApi.deactivate(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['contractors'] }) });

  function openCreate() { setModal('create'); setForm({ entityType: 'INDIVIDUAL', tdsSection: '194C', status: 'ACTIVE' }); }
  function openEdit(c: any) { setModal(c); setForm({ ...c }); }

  const arr = contractors as any[];
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          {['','ACTIVE','INACTIVE'].map(s => (
            <button key={s} onClick={() => setStatus(s)} className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${status === s ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>{s || 'All'}</button>
          ))}
        </div>
        <button onClick={openCreate} className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">+ Add Contractor</button>
      </div>

      {isLoading ? <div className="text-center py-12 text-gray-400">Loading…</div> : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr>{['Contractor','Type','PAN','GSTIN','TDS Section','Status','Actions'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100">
              {arr.map((c: any) => (
                <tr key={c.id} className="bg-white hover:bg-gray-50">
                  <td className="px-4 py-3"><p className="font-medium text-gray-900">{c.name}</p><p className="text-xs text-gray-400">{c.contractorCode}{c.contactPerson ? ` · ${c.contactPerson}` : ''}</p></td>
                  <td className="px-4 py-3 text-gray-600">{c.entityType}</td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{c.pan || '—'}</td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{c.gstin || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 text-xs rounded-full bg-indigo-100 text-indigo-700 font-medium">{c.tdsSection}</span>
                    {c.lowerTdsRate != null && <span className="ml-1 text-[10px] text-green-600">cert {c.lowerTdsRate}%</span>}
                  </td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 text-xs rounded-full font-medium ${c.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{c.status}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(c)} className="text-xs text-indigo-600 hover:underline">Edit</button>
                      {c.status === 'ACTIVE' && <button onClick={() => deactMut.mutate(c.id)} className="text-xs text-red-500 hover:underline">Deactivate</button>}
                    </div>
                  </td>
                </tr>
              ))}
              {arr.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">No contractors yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">{modal === 'create' ? 'Add Contractor' : 'Edit Contractor'}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Name *</label><input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Contact Person</label><input value={form.contactPerson || ''} onChange={e => setForm({ ...form, contactPerson: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Email *</label><input value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Phone *</label><input value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">PAN *</label><input value={form.pan || ''} onChange={e => setForm({ ...form, pan: e.target.value.toUpperCase() })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">GSTIN</label><input value={form.gstin || ''} onChange={e => setForm({ ...form, gstin: e.target.value.toUpperCase() })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Entity Type</label>
                <select value={form.entityType} onChange={e => setForm({ ...form, entityType: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  {ENTITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Default TDS Section</label>
                <select value={form.tdsSection} onChange={e => setForm({ ...form, tdsSection: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  {TDS_SECTIONS.map(s => <option key={s.code} value={s.code}>{s.label}</option>)}
                </select>
              </div>
            </div>

            {/* Lower TDS certificate */}
            <div className="mt-3 border border-gray-200 rounded-xl p-3">
              <p className="text-xs font-semibold text-gray-600 mb-2">Lower / Nil Deduction Certificate (Sec 197) — optional</p>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Lower Rate (%)</label><input type="number" step="0.01" value={form.lowerTdsRate ?? ''} onChange={e => setForm({ ...form, lowerTdsRate: e.target.value === '' ? null : Number(e.target.value) })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Certificate No.</label><input value={form.lowerTdsCertNo || ''} onChange={e => setForm({ ...form, lowerTdsCertNo: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Valid To</label><input type="date" value={form.lowerTdsValidTo ? String(form.lowerTdsValidTo).split('T')[0] : ''} onChange={e => setForm({ ...form, lowerTdsValidTo: e.target.value || null })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              </div>
            </div>

            {/* Bank */}
            <div className="mt-3 grid grid-cols-3 gap-3">
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Bank Name</label><input value={form.bankName || ''} onChange={e => setForm({ ...form, bankName: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Account No.</label><input value={form.accountNumber || ''} onChange={e => setForm({ ...form, accountNumber: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">IFSC</label><input value={form.ifscCode || ''} onChange={e => setForm({ ...form, ifscCode: e.target.value.toUpperCase() })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono" /></div>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => setModal(null)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
              <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm disabled:opacity-50">{saveMut.isPending ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Payruns Tab ───────────────────────────────────────────────────────────────
function PayrunsTab() {
  const qc = useQueryClient();
  const { data: payruns = [], isLoading } = useQuery({ queryKey: ['contractor-payruns'], queryFn: () => contractorApi.payruns() as any });
  const { data: contractors = [] } = useQuery({ queryKey: ['contractors', 'ACTIVE'], queryFn: () => contractorApi.list('ACTIVE') as any });
  const [showCreate, setShowCreate] = useState(false);
  const [drawer, setDrawer] = useState<string | null>(null);
  const [form, setForm] = useState<any>({ month: now.getMonth() + 1, year: now.getFullYear(), lines: [] });

  const createMut = useMutation({ mutationFn: () => contractorApi.createPayrun(form), onSuccess: () => { qc.invalidateQueries({ queryKey: ['contractor-payruns'] }); setShowCreate(false); setForm({ month: now.getMonth() + 1, year: now.getFullYear(), lines: [] }); } });

  const arr = payruns as any[];
  const cArr = contractors as any[];
  const statusColor: Record<string, string> = { DRAFT: 'bg-gray-100 text-gray-600', PENDING_APPROVAL: 'bg-yellow-100 text-yellow-700', APPROVED: 'bg-blue-100 text-blue-700', PAID: 'bg-green-100 text-green-700', CANCELLED: 'bg-red-100 text-red-500' };

  function addLine() { setForm({ ...form, lines: [...form.lines, { contractorId: '', grossAmount: 0, section: '', invoiceNumber: '', description: '' }] }); }
  function updateLine(i: number, patch: any) { const lines = [...form.lines]; lines[i] = { ...lines[i], ...patch }; setForm({ ...form, lines }); }
  function removeLine(i: number) { setForm({ ...form, lines: form.lines.filter((_: any, idx: number) => idx !== i) }); }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{arr.length} contractor payruns</p>
        <button onClick={() => setShowCreate(true)} className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">+ New Payrun</button>
      </div>

      {isLoading ? <div className="text-center py-12 text-gray-400">Loading…</div> : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr>{['Period','Contractors','Gross','TDS','Net','Status','Actions'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100">
              {arr.map((pr: any) => (
                <tr key={pr.id} className="bg-white hover:bg-gray-50 cursor-pointer" onClick={() => setDrawer(pr.id)}>
                  <td className="px-4 py-3 font-medium text-gray-900">{MONTHS[pr.month - 1]} {pr.year}</td>
                  <td className="px-4 py-3 text-gray-600">{pr.totalContractors}</td>
                  <td className="px-4 py-3 text-gray-900">{fmt(pr.totalGross)}</td>
                  <td className="px-4 py-3 text-red-600">{fmt(pr.totalTDS)}</td>
                  <td className="px-4 py-3 text-green-700 font-medium">{fmt(pr.totalNet)}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 text-xs rounded-full font-medium ${statusColor[pr.status] || ''}`}>{pr.status.replace('_', ' ')}</span></td>
                  <td className="px-4 py-3"><button onClick={e => { e.stopPropagation(); setDrawer(pr.id); }} className="text-xs text-indigo-600 hover:underline">View</button></td>
                </tr>
              ))}
              {arr.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">No contractor payruns yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Create payrun modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-3xl p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">New Contractor Payrun</h3>
            <div className="flex gap-3 mb-4">
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Month</label>
                <select value={form.month} onChange={e => setForm({ ...form, month: Number(e.target.value) })} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Year</label><input type="number" value={form.year} onChange={e => setForm({ ...form, year: Number(e.target.value) })} className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-24" /></div>
            </div>

            <div className="border border-gray-200 rounded-xl overflow-hidden mb-3">
              <table className="w-full text-sm">
                <thead className="bg-gray-50"><tr>{['Contractor','Section','Gross','Invoice #','Description',''].map(h => <th key={h} className="px-2 py-2 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr></thead>
                <tbody>
                  {form.lines.map((line: any, i: number) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="px-2 py-1.5">
                        <select value={line.contractorId} onChange={e => updateLine(i, { contractorId: e.target.value })} className="w-full border border-gray-300 rounded px-2 py-1 text-xs">
                          <option value="">Select…</option>
                          {cArr.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <select value={line.section} onChange={e => updateLine(i, { section: e.target.value })} className="w-full border border-gray-300 rounded px-2 py-1 text-xs">
                          <option value="">Default</option>
                          {TDS_SECTIONS.map(s => <option key={s.code} value={s.code}>{s.code}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1.5"><input type="number" value={line.grossAmount || ''} onChange={e => updateLine(i, { grossAmount: Number(e.target.value) })} className="w-24 border border-gray-300 rounded px-2 py-1 text-xs" /></td>
                      <td className="px-2 py-1.5"><input value={line.invoiceNumber || ''} onChange={e => updateLine(i, { invoiceNumber: e.target.value })} className="w-24 border border-gray-300 rounded px-2 py-1 text-xs" /></td>
                      <td className="px-2 py-1.5"><input value={line.description || ''} onChange={e => updateLine(i, { description: e.target.value })} className="w-full border border-gray-300 rounded px-2 py-1 text-xs" /></td>
                      <td className="px-2 py-1.5"><button onClick={() => removeLine(i)} className="text-red-500 text-xs">✕</button></td>
                    </tr>
                  ))}
                  {form.lines.length === 0 && <tr><td colSpan={6} className="px-2 py-6 text-center text-gray-400 text-xs">No lines. Click "Add Line".</td></tr>}
                </tbody>
              </table>
            </div>
            <button onClick={addLine} className="text-sm text-indigo-600 hover:underline mb-4">+ Add Line</button>

            <div className="flex gap-2">
              <button onClick={() => setShowCreate(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
              <button onClick={() => createMut.mutate()} disabled={createMut.isPending || form.lines.length === 0} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm disabled:opacity-50">{createMut.isPending ? 'Creating…' : 'Create Payrun'}</button>
            </div>
          </div>
        </div>
      )}

      {drawer && <PayrunDrawer id={drawer} onClose={() => setDrawer(null)} />}
    </div>
  );
}

function PayrunDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: pr, isLoading } = useQuery({ queryKey: ['contractor-payrun', id], queryFn: () => contractorApi.payrun(id) as any });
  const p = pr as any;

  const invalidate = () => { qc.invalidateQueries({ queryKey: ['contractor-payrun', id] }); qc.invalidateQueries({ queryKey: ['contractor-payruns'] }); };
  const approveMut = useMutation({ mutationFn: () => contractorApi.approvePayrun(id), onSuccess: invalidate });
  const paidMut    = useMutation({ mutationFn: () => contractorApi.markPayrunPaid(id), onSuccess: invalidate });
  const cancelMut  = useMutation({ mutationFn: () => contractorApi.cancelPayrun(id), onSuccess: invalidate });

  return (
    <div className="fixed inset-0 bg-black/40 flex justify-end z-50" onClick={onClose}>
      <div className="bg-white w-full max-w-2xl h-full overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        {isLoading || !p ? <div className="text-center py-12 text-gray-400">Loading…</div> : (
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">{MONTHS[p.month - 1]} {p.year} — Contractor Payrun</h3>
                <p className="text-sm text-gray-400">{p.status.replace('_', ' ')}</p>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: 'Gross', val: fmt(p.totalGross), color: 'text-gray-900' },
                { label: 'TDS', val: fmt(p.totalTDS), color: 'text-red-600' },
                { label: 'Net', val: fmt(p.totalNet), color: 'text-green-700' },
              ].map(c => (
                <div key={c.label} className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className={`text-lg font-bold ${c.color}`}>{c.val}</p>
                  <p className="text-xs text-gray-400">{c.label}</p>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 mb-4">
              {(p.status === 'DRAFT' || p.status === 'PENDING_APPROVAL') && (
                <button onClick={() => approveMut.mutate()} disabled={approveMut.isPending} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">Approve</button>
              )}
              {p.status === 'APPROVED' && (
                <button onClick={() => paidMut.mutate()} disabled={paidMut.isPending} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm disabled:opacity-50">Mark Paid</button>
              )}
              {p.status !== 'PAID' && p.status !== 'CANCELLED' && (
                <button onClick={() => cancelMut.mutate()} disabled={cancelMut.isPending} className="px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm disabled:opacity-50">Cancel</button>
              )}
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50"><tr>{['Contractor','Section','Rate','Gross','TDS','Net','Status'].map(h => <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {p.payments.map((pay: any) => (
                    <tr key={pay.id} className="bg-white">
                      <td className="px-3 py-2"><p className="font-medium text-gray-900">{pay.contractor?.name}</p><p className="text-xs text-gray-400 font-mono">{pay.contractor?.pan}</p></td>
                      <td className="px-3 py-2"><span className="px-1.5 py-0.5 text-xs rounded bg-indigo-100 text-indigo-700">{pay.tdsSection}</span></td>
                      <td className="px-3 py-2 text-gray-600">{pay.tdsRate}%</td>
                      <td className="px-3 py-2 text-gray-900">{fmt(pay.grossAmount)}</td>
                      <td className="px-3 py-2 text-red-600">{fmt(pay.tdsAmount)}</td>
                      <td className="px-3 py-2 text-green-700 font-medium">{fmt(pay.netAmount)}</td>
                      <td className="px-3 py-2 text-xs text-gray-500">{pay.status}</td>
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

// ── Form 16A Tab ──────────────────────────────────────────────────────────────
function Form16ATab() {
  const qc = useQueryClient();
  const [fy, setFy] = useState(CUR_FY);
  const [quarter, setQuarter] = useState(1);
  const { data: rows = [], isLoading } = useQuery({ queryKey: ['contractor-form16a', fy, quarter], queryFn: () => contractorApi.form16aSummary(fy, quarter) as any });

  const genMut   = useMutation({ mutationFn: (cid: string) => contractorApi.generateForm16a(cid, fy, quarter), onSuccess: () => qc.invalidateQueries({ queryKey: ['contractor-form16a'] }) });
  const esignMut = useMutation({ mutationFn: (id: string) => contractorApi.esignForm16a(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['contractor-form16a'] }) });

  const arr = rows as any[];
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <select value={fy} onChange={e => setFy(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
          {fyList.map(f => <option key={f} value={f}>FY {f}</option>)}
        </select>
        <div className="flex gap-1">
          {[1,2,3,4].map(q => (
            <button key={q} onClick={() => setQuarter(q)} className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${quarter === q ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>Q{q}</button>
          ))}
        </div>
        <span className="text-xs text-gray-400">{quarter === 1 ? 'Apr-Jun' : quarter === 2 ? 'Jul-Sep' : quarter === 3 ? 'Oct-Dec' : 'Jan-Mar'}</span>
      </div>

      {isLoading ? <div className="text-center py-12 text-gray-400">Loading…</div> : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr>{['Contractor','PAN','Section','Total Paid','Total TDS','Payments','Certificate','Action'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100">
              {arr.map((row: any) => (
                <tr key={row.contractor.id} className="bg-white hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{row.contractor.name}<div className="text-xs text-gray-400">{row.contractor.contractorCode}</div></td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{row.contractor.pan}</td>
                  <td className="px-4 py-3"><span className="px-1.5 py-0.5 text-xs rounded bg-indigo-100 text-indigo-700">{row.tdsSection}</span></td>
                  <td className="px-4 py-3 text-gray-900">{fmt(row.totalPaid)}</td>
                  <td className="px-4 py-3 text-red-600 font-medium">{fmt(row.totalTDS)}</td>
                  <td className="px-4 py-3 text-gray-500">{row.paymentCount}</td>
                  <td className="px-4 py-3">
                    {row.certificate
                      ? <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${row.certificate.status === 'ESIGNED' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{row.certificate.status}</span>
                      : <span className="text-xs text-gray-400">Not issued</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {!row.certificate || row.certificate.status === 'DRAFT'
                        ? <button onClick={() => genMut.mutate(row.contractor.id)} disabled={genMut.isPending} className="text-xs text-indigo-600 hover:underline">Generate</button>
                        : row.certificate.status === 'ISSUED'
                          ? <button onClick={() => esignMut.mutate(row.certificate.id)} disabled={esignMut.isPending} className="text-xs text-green-600 hover:underline">eSign</button>
                          : <span className="text-xs text-gray-400">✓ Done</span>}
                    </div>
                  </td>
                </tr>
              ))}
              {arr.length === 0 && <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">No paid contractor payments for Q{quarter} FY {fy}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── TDS Register Tab ──────────────────────────────────────────────────────────
function TdsRegisterTab() {
  const [fy, setFy] = useState(CUR_FY);
  const [quarter, setQuarter] = useState<number | ''>('');
  const { data, isLoading } = useQuery({ queryKey: ['contractor-tds-register', fy, quarter], queryFn: () => contractorApi.tdsRegister(fy, quarter || undefined) as any });
  const d = data as any;

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <select value={fy} onChange={e => setFy(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
          {fyList.map(f => <option key={f} value={f}>FY {f}</option>)}
        </select>
        <select value={quarter} onChange={e => setQuarter(e.target.value === '' ? '' : Number(e.target.value))} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
          <option value="">All Quarters</option>
          {[1,2,3,4].map(q => <option key={q} value={q}>Q{q}</option>)}
        </select>
      </div>

      {isLoading ? <div className="text-center py-12 text-gray-400">Loading…</div> : d && (
        <>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-500">Total Payments (Gross)</p>
              <p className="text-2xl font-bold text-gray-900">{fmt(d.totalGross)}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-500">Total TDS Deducted</p>
              <p className="text-2xl font-bold text-red-600">{fmt(d.totalTDS)}</p>
            </div>
          </div>

          {/* Section-wise summary */}
          <div className="mb-4 flex flex-wrap gap-2">
            {Object.entries(d.bySection || {}).map(([sec, v]: [string, any]) => (
              <div key={sec} className="bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
                <span className="text-xs font-semibold text-indigo-700">{sec}</span>
                <span className="text-xs text-gray-500 ml-2">{v.count} pmts · {fmt(v.gross)} → TDS {fmt(v.tds)}</span>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50"><tr>{['Contractor','PAN','Section','Rate','Gross','TDS','Q','Status'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-gray-100">
                {(d.payments as any[]).map((p: any) => (
                  <tr key={p.id} className="bg-white hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{p.contractor?.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{p.contractor?.pan}</td>
                    <td className="px-4 py-3"><span className="px-1.5 py-0.5 text-xs rounded bg-indigo-100 text-indigo-700">{p.tdsSection}</span></td>
                    <td className="px-4 py-3 text-gray-600">{p.tdsRate}%</td>
                    <td className="px-4 py-3 text-gray-900">{fmt(p.grossAmount)}</td>
                    <td className="px-4 py-3 text-red-600">{fmt(p.tdsAmount)}</td>
                    <td className="px-4 py-3 text-gray-500">Q{p.quarter}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{p.status}</td>
                  </tr>
                ))}
                {(d.payments as any[]).length === 0 && <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">No TDS entries for this period</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
const TABS = ['Contractors', 'Payruns', 'Form 16A', 'TDS Register'];

export default function ContractorPage() {
  const [tab, setTab] = useState(0);
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Contractor Payroll</h1>
        <p className="text-sm text-gray-500 mt-1">Manage contractors, TDS on payments, and Form 16A certificates</p>
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab === i ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>{t}</button>
        ))}
      </div>

      <div>
        {tab === 0 && <ContractorsTab />}
        {tab === 1 && <PayrunsTab />}
        {tab === 2 && <Form16ATab />}
        {tab === 3 && <TdsRegisterTab />}
      </div>
    </div>
  );
}
