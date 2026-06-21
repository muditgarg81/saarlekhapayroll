'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { compensationApi, employeesApi, salaryApi } from '@/lib/api';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmt = (n: number) => `₹${Math.round(n ?? 0).toLocaleString('en-IN')}`;
const now = new Date();
const CUR_FY = now.getMonth() >= 3 ? `${now.getFullYear()}-${String(now.getFullYear()+1).slice(2)}` : `${now.getFullYear()-1}-${String(now.getFullYear()).slice(2)}`;
const fyList = Array.from({ length: 4 }, (_, i) => { const y = now.getFullYear() - i + (now.getMonth() >= 3 ? 0 : -1); return `${y}-${String(y+1).slice(2)}`; });
const PERQ_TYPES = ['ACCOMMODATION','CAR','LOAN','ESOP','DRIVER','UTILITIES','OTHER'];
const POI_SECTIONS = ['80C','80D','80CCD1B','HRA','24B','80G','OTHER'];

// ── Salary Revisions ──────────────────────────────────────────────────────────
function RevisionsTab() {
  const qc = useQueryClient();
  const { data: revisions = [], isLoading } = useQuery({ queryKey: ['revisions'], queryFn: () => compensationApi.revisions() as any });
  const { data: employees = [] } = useQuery({ queryKey: ['employees'], queryFn: () => employeesApi.list() as any });
  const { data: structures = [] } = useQuery({ queryKey: ['salary-structures'], queryFn: () => salaryApi.structures() as any });
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<any>({ effectiveDate: now.toISOString().split('T')[0] });
  const createMut = useMutation({ mutationFn: () => compensationApi.createRevision({ ...form, newCtc: Number(form.newCtc) }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['revisions'] }); setModal(false); setForm({ effectiveDate: now.toISOString().split('T')[0] }); } });
  const sel = (employees as any[]).find((e: any) => e.id === form.employeeId);
  const arr = revisions as any[];
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">{arr.length} revisions recorded</p>
        <button onClick={() => setModal(true)} className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">+ Revise Salary</button>
      </div>
      {isLoading ? <div className="text-center py-12 text-gray-400">Loading…</div> : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr>{['Employee','Effective','Previous CTC','New CTC','Change','%','Reason'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100">
              {arr.map((r: any) => (
                <tr key={r.id} className="bg-white hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.employee?.firstName} {r.employee?.lastName}<div className="text-xs text-gray-400">{r.employee?.employeeCode}</div></td>
                  <td className="px-4 py-3 text-gray-600">{new Date(r.effectiveDate).toLocaleDateString('en-IN')}</td>
                  <td className="px-4 py-3 text-gray-600">{fmt(r.previousCtc)}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">{fmt(r.newCtc)}</td>
                  <td className={`px-4 py-3 ${r.changeAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>{r.changeAmount >= 0 ? '+' : ''}{fmt(r.changeAmount)}</td>
                  <td className={`px-4 py-3 font-medium ${r.changePct >= 0 ? 'text-green-600' : 'text-red-600'}`}>{r.changePct >= 0 ? '+' : ''}{r.changePct}%</td>
                  <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{r.reason || '—'}</td>
                </tr>
              ))}
              {arr.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">No salary revisions yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h3 className="text-lg font-semibold mb-4">Revise Salary</h3>
            <div className="space-y-3">
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Employee *</label>
                <select value={form.employeeId || ''} onChange={e => setForm({ ...form, employeeId: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="">Select…</option>{(employees as any[]).map((e: any) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeCode})</option>)}
                </select>
              </div>
              {sel && <p className="text-xs text-gray-500">Current CTC: <strong>{fmt(sel.ctc)}</strong></p>}
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">New Annual CTC *</label><input type="number" value={form.newCtc || ''} onChange={e => setForm({ ...form, newCtc: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Effective Date</label><input type="date" value={form.effectiveDate} onChange={e => setForm({ ...form, effectiveDate: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              </div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">New Structure (optional)</label>
                <select value={form.newStructureId || ''} onChange={e => setForm({ ...form, newStructureId: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="">Keep current</option>{(structures as any[]).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Reason</label><input value={form.reason || ''} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="Annual increment, promotion…" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              {sel && form.newCtc && <p className="text-xs p-2 bg-indigo-50 rounded-lg text-indigo-700">Change: {fmt(Number(form.newCtc) - sel.ctc)} ({(((Number(form.newCtc) - sel.ctc) / sel.ctc) * 100).toFixed(1)}%) — applies to the employee on save.</p>}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
              <button onClick={() => createMut.mutate()} disabled={createMut.isPending || !form.employeeId || !form.newCtc} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm disabled:opacity-50">{createMut.isPending ? 'Saving…' : 'Apply Revision'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Perquisites ───────────────────────────────────────────────────────────────
function PerquisitesTab() {
  const qc = useQueryClient();
  const [fy, setFy] = useState(CUR_FY);
  const { data, isLoading } = useQuery({ queryKey: ['perquisites', fy], queryFn: () => compensationApi.perquisites(fy) as any });
  const { data: employees = [] } = useQuery({ queryKey: ['employees'], queryFn: () => employeesApi.list() as any });
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<any>({ type: 'CAR', isTaxable: true });
  const createMut = useMutation({ mutationFn: () => compensationApi.createPerquisite({ ...form, financialYear: fy, taxableValue: Number(form.taxableValue) }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['perquisites'] }); setModal(false); setForm({ type: 'CAR', isTaxable: true }); } });
  const delMut = useMutation({ mutationFn: (id: string) => compensationApi.deletePerquisite(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['perquisites'] }) });
  const d = data as any;
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <select value={fy} onChange={e => setFy(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">{fyList.map(f => <option key={f} value={f}>FY {f}</option>)}</select>
        <button onClick={() => setModal(true)} className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">+ Add Perquisite</button>
      </div>
      {isLoading ? <div className="text-center py-12 text-gray-400">Loading…</div> : !d ? null : (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            {Object.entries(d.byType || {}).map(([t, v]: any) => <div key={t} className="bg-purple-50 border border-purple-100 rounded-lg px-3 py-2 text-sm"><span className="font-medium text-purple-700">{t}</span><span className="text-gray-500 ml-2">{fmt(v)}</span></div>)}
            <div className="bg-gray-800 rounded-lg px-3 py-2 ml-auto"><span className="text-xs text-gray-300">Total Taxable</span><span className="text-sm font-bold text-white ml-2">{fmt(d.totalTaxable)}</span></div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50"><tr>{['Employee','Type','Description','Taxable Value','Taxable',''].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-gray-100">
                {d.rows.map((r: any) => (
                  <tr key={r.id} className="bg-white hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{r.name}<div className="text-xs text-gray-400">{r.employeeCode}</div></td>
                    <td className="px-4 py-3"><span className="px-1.5 py-0.5 text-xs rounded bg-purple-100 text-purple-700">{r.type}</span></td>
                    <td className="px-4 py-3 text-gray-500">{r.description || '—'}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{fmt(r.taxableValue)}</td>
                    <td className="px-4 py-3">{r.isTaxable ? '✓' : '—'}</td>
                    <td className="px-4 py-3"><button onClick={() => delMut.mutate(r.id)} className="text-xs text-red-500 hover:underline">Delete</button></td>
                  </tr>
                ))}
                {!d.rows.length && <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">No perquisites for FY {fy}</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h3 className="text-lg font-semibold mb-4">Add Perquisite ({fy})</h3>
            <div className="space-y-3">
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Employee *</label>
                <select value={form.employeeId || ''} onChange={e => setForm({ ...form, employeeId: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"><option value="">Select…</option>{(employees as any[]).map((e: any) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}</select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Type</label><select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">{PERQ_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Taxable Value (₹) *</label><input type="number" value={form.taxableValue || ''} onChange={e => setForm({ ...form, taxableValue: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              </div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Description</label><input value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={form.isTaxable} onChange={e => setForm({ ...form, isTaxable: e.target.checked })} className="rounded" /> Taxable perquisite</label>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
              <button onClick={() => createMut.mutate()} disabled={createMut.isPending || !form.employeeId || !form.taxableValue} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm disabled:opacity-50">{createMut.isPending ? 'Saving…' : 'Add'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Proof of Investment ───────────────────────────────────────────────────────
function PoiTab() {
  const qc = useQueryClient();
  const [fy, setFy] = useState(CUR_FY);
  const [status, setStatus] = useState('');
  const { data: proofs = [], isLoading } = useQuery({ queryKey: ['poi', fy, status], queryFn: () => compensationApi.poi({ financialYear: fy, status: status || undefined }) as any });
  const { data: employees = [] } = useQuery({ queryKey: ['employees'], queryFn: () => employeesApi.list() as any });
  const [modal, setModal] = useState(false);
  const [review, setReview] = useState<any>(null);
  const [form, setForm] = useState<any>({ section: '80C' });
  const submitMut = useMutation({ mutationFn: () => compensationApi.submitPoi({ ...form, financialYear: fy, proofAmount: Number(form.proofAmount), declaredAmount: Number(form.declaredAmount || 0) }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['poi'] }); setModal(false); setForm({ section: '80C' }); } });
  const reviewMut = useMutation({ mutationFn: (d: any) => compensationApi.reviewPoi(d.id, { status: d.status, proofAmount: d.proofAmount, comment: d.comment }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['poi'] }); setReview(null); } });
  const arr = proofs as any[];
  const sb: Record<string,string> = { PENDING: 'bg-yellow-100 text-yellow-700', VERIFIED: 'bg-green-100 text-green-700', REJECTED: 'bg-red-100 text-red-700' };
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2 items-center">
          <select value={fy} onChange={e => setFy(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">{fyList.map(f => <option key={f} value={f}>FY {f}</option>)}</select>
          {['','PENDING','VERIFIED','REJECTED'].map(s => <button key={s} onClick={() => setStatus(s)} className={`px-3 py-1.5 text-xs rounded-full border ${status === s ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 text-gray-600'}`}>{s || 'All'}</button>)}
        </div>
        <button onClick={() => setModal(true)} className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">+ Submit Proof</button>
      </div>
      {isLoading ? <div className="text-center py-12 text-gray-400">Loading…</div> : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr>{['Employee','Section','Description','Declared','Proof','Status',''].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100">
              {arr.map((p: any) => (
                <tr key={p.id} className="bg-white hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{p.employee?.firstName} {p.employee?.lastName}<div className="text-xs text-gray-400">{p.employee?.employeeCode}</div></td>
                  <td className="px-4 py-3"><span className="px-1.5 py-0.5 text-xs rounded bg-indigo-100 text-indigo-700">{p.section}</span></td>
                  <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{p.description}</td>
                  <td className="px-4 py-3 text-gray-600">{fmt(p.declaredAmount)}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">{fmt(p.proofAmount)}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 text-xs rounded-full font-medium ${sb[p.status]}`}>{p.status}</span></td>
                  <td className="px-4 py-3">{p.status === 'PENDING' && <button onClick={() => setReview({ ...p, proofAmount: p.proofAmount })} className="text-xs text-indigo-600 hover:underline">Review</button>}</td>
                </tr>
              ))}
              {arr.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">No proofs for FY {fy}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h3 className="text-lg font-semibold mb-4">Submit Proof of Investment ({fy})</h3>
            <div className="space-y-3">
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Employee *</label><select value={form.employeeId || ''} onChange={e => setForm({ ...form, employeeId: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"><option value="">Select…</option>{(employees as any[]).map((e: any) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}</select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Section</label><select value={form.section} onChange={e => setForm({ ...form, section: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">{POI_SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Proof Amount (₹) *</label><input type="number" value={form.proofAmount || ''} onChange={e => setForm({ ...form, proofAmount: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Declared Amount</label><input type="number" value={form.declaredAmount || ''} onChange={e => setForm({ ...form, declaredAmount: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Proof URL</label><input value={form.fileUrl || ''} onChange={e => setForm({ ...form, fileUrl: e.target.value })} placeholder="link to receipt" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              </div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Description *</label><input value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="ELSS / PPF / LIC policy no…" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
              <button onClick={() => submitMut.mutate()} disabled={submitMut.isPending || !form.employeeId || !form.proofAmount || !form.description} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm disabled:opacity-50">{submitMut.isPending ? 'Submitting…' : 'Submit'}</button>
            </div>
          </div>
        </div>
      )}
      {review && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
            <h3 className="text-lg font-semibold mb-2">Verify Proof</h3>
            <p className="text-sm text-gray-600 mb-3">{review.employee?.firstName} {review.employee?.lastName} · {review.section} · declared {fmt(review.declaredAmount)}</p>
            <div className="space-y-3">
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Verified Amount</label><input type="number" value={review.proofAmount} onChange={e => setReview({ ...review, proofAmount: Number(e.target.value) })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Comment</label><input onChange={e => setReview({ ...review, comment: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setReview(null)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
              <button onClick={() => reviewMut.mutate({ id: review.id, status: 'REJECTED', comment: review.comment })} disabled={reviewMut.isPending} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm disabled:opacity-50">Reject</button>
              <button onClick={() => reviewMut.mutate({ id: review.id, status: 'VERIFIED', proofAmount: review.proofAmount, comment: review.comment })} disabled={reviewMut.isPending} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm disabled:opacity-50">Verify</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Salary Withhold ───────────────────────────────────────────────────────────
function WithholdTab() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const { data: holds = [], isLoading } = useQuery({ queryKey: ['holds', status], queryFn: () => compensationApi.holds(status || undefined) as any });
  const { data: employees = [] } = useQuery({ queryKey: ['employees'], queryFn: () => employeesApi.list() as any });
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<any>({ month: now.getMonth() + 1, year: now.getFullYear() });
  const holdMut = useMutation({ mutationFn: () => compensationApi.hold({ ...form, month: Number(form.month), year: Number(form.year) }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['holds'] }); setModal(false); setForm({ month: now.getMonth() + 1, year: now.getFullYear() }); } });
  const releaseMut = useMutation({ mutationFn: (id: string) => compensationApi.release(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['holds'] }) });
  const arr = holds as any[];
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">{['','HELD','RELEASED'].map(s => <button key={s} onClick={() => setStatus(s)} className={`px-3 py-1.5 text-xs rounded-full border ${status === s ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 text-gray-600'}`}>{s || 'All'}</button>)}</div>
        <button onClick={() => setModal(true)} className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">+ Hold Salary</button>
      </div>
      <div className="p-3 bg-amber-50 rounded-xl text-xs text-amber-800 mb-4">Held employees should be excluded from the period's bank disbursement until released.</div>
      {isLoading ? <div className="text-center py-12 text-gray-400">Loading…</div> : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr>{['Employee','Period','Reason','Status','Released',''].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100">
              {arr.map((h: any) => (
                <tr key={h.id} className="bg-white hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{h.employee?.firstName} {h.employee?.lastName}<div className="text-xs text-gray-400">{h.employee?.employeeCode}</div></td>
                  <td className="px-4 py-3 text-gray-600">{MONTHS[h.month-1]} {h.year}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{h.reason}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 text-xs rounded-full font-medium ${h.status === 'HELD' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{h.status}</span></td>
                  <td className="px-4 py-3 text-xs text-gray-400">{h.releasedAt ? new Date(h.releasedAt).toLocaleDateString('en-IN') : '—'}</td>
                  <td className="px-4 py-3">{h.status === 'HELD' && <button onClick={() => releaseMut.mutate(h.id)} className="text-xs text-green-600 hover:underline">Release</button>}</td>
                </tr>
              ))}
              {arr.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">No salary holds</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h3 className="text-lg font-semibold mb-4">Hold Salary</h3>
            <div className="space-y-3">
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Employee *</label><select value={form.employeeId || ''} onChange={e => setForm({ ...form, employeeId: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"><option value="">Select…</option>{(employees as any[]).map((e: any) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}</select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Month</label><select value={form.month} onChange={e => setForm({ ...form, month: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">{MONTHS.map((m, i) => <option key={m} value={i+1}>{m}</option>)}</select></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Year</label><input type="number" value={form.year} onChange={e => setForm({ ...form, year: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              </div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Reason *</label><textarea rows={2} value={form.reason || ''} onChange={e => setForm({ ...form, reason: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
              <button onClick={() => holdMut.mutate()} disabled={holdMut.isPending || !form.employeeId || !form.reason} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm disabled:opacity-50">{holdMut.isPending ? 'Holding…' : 'Hold Salary'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const TABS = ['Salary Revisions', 'Perquisites', 'Proof of Investment', 'Salary Withhold'];
export default function CompensationPage() {
  const [tab, setTab] = useState(0);
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Compensation 📈</h1>
        <p className="text-sm text-gray-500 mt-1">Salary revisions, perquisites valuation, proof of investment & salary withholding</p>
      </div>
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map((t, i) => <button key={t} onClick={() => setTab(i)} className={`px-4 py-2 text-sm font-medium rounded-lg ${tab === i ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600'}`}>{t}</button>)}
      </div>
      <div>{tab === 0 && <RevisionsTab />}{tab === 1 && <PerquisitesTab />}{tab === 2 && <PoiTab />}{tab === 3 && <WithholdTab />}</div>
    </div>
  );
}
