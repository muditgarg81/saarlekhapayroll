'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leaveApi } from '@/lib/api';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const INDIAN_STATES = ['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal'];

function currentFY() {
  const now = new Date(); const m = now.getMonth() + 1; const y = now.getFullYear();
  return m >= 4 ? `${y}-${String(y+1).slice(2)}` : `${y-1}-${String(y).slice(2)}`;
}

// ── Policies Tab ────────────────────────────────────────────────────────────
function PoliciesTab() {
  const qc = useQueryClient();
  const { data: policies = [], isLoading } = useQuery({ queryKey: ['leave-policies'], queryFn: () => leaveApi.policies() as any });
  const [modal, setModal] = useState<any>(null);
  const [form, setForm] = useState<any>({});

  const seedMut = useMutation({ mutationFn: () => leaveApi.seedPolicies(), onSuccess: () => qc.invalidateQueries({ queryKey: ['leave-policies'] }) });
  const saveMut = useMutation({
    mutationFn: () => modal?.id ? leaveApi.updatePolicy(modal.id, form) : leaveApi.createPolicy(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leave-policies'] }); setModal(null); },
  });
  const delMut = useMutation({ mutationFn: (id: string) => leaveApi.deletePolicy(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['leave-policies'] }) });

  function openEdit(p: any) { setModal(p); setForm({ leaveType: p.leaveType, name: p.name, annualAllotment: p.annualAllotment, isPaid: p.isPaid, carryForwardAllowed: p.carryForwardAllowed, maxCarryForward: p.maxCarryForward, encashmentAllowed: p.encashmentAllowed, requiresApproval: p.requiresApproval, maxConsecutiveDays: p.maxConsecutiveDays, color: p.color, description: p.description }); }
  function openCreate() { setModal('create'); setForm({ color: '#6366f1', isPaid: true, carryForwardAllowed: false, encashmentAllowed: false, requiresApproval: true }); }

  const arr = policies as any[];
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">{arr.length} leave types configured</p>
        <div className="flex gap-2">
          <button onClick={() => seedMut.mutate()} disabled={seedMut.isPending} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
            {seedMut.isPending ? 'Seeding...' : 'Seed Defaults'}
          </button>
          <button onClick={openCreate} className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">+ Add Policy</button>
        </div>
      </div>

      {isLoading ? <div className="text-center py-12 text-gray-400">Loading…</div> : (
        <div className="grid gap-3">
          {arr.map((p: any) => (
            <div key={p.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-xl bg-white">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full" style={{ background: p.color }} />
                <div>
                  <p className="font-medium text-gray-900">{p.name} <span className="text-xs text-gray-500 ml-1">({p.leaveType})</span></p>
                  <p className="text-xs text-gray-500 mt-0.5">{p.description || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-6 text-sm text-gray-600">
                <span className="text-center"><div className="font-semibold text-gray-900">{p.annualAllotment}</div><div className="text-xs">days/yr</div></span>
                <div className="flex gap-2 flex-wrap max-w-xs">
                  {p.isPaid && <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">Paid</span>}
                  {p.carryForwardAllowed && <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">Carry Fwd{p.maxCarryForward ? ` ≤${p.maxCarryForward}` : ''}</span>}
                  {p.encashmentAllowed && <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-700">Encashable</span>}
                  {!p.requiresApproval && <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">Auto-approve</span>}
                  {p.maxConsecutiveDays && <span className="px-2 py-0.5 text-xs rounded-full bg-orange-100 text-orange-700">Max {p.maxConsecutiveDays}d</span>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(p)} className="text-xs text-indigo-600 hover:underline">Edit</button>
                  <button onClick={() => delMut.mutate(p.id)} className="text-xs text-red-500 hover:underline">Delete</button>
                </div>
              </div>
            </div>
          ))}
          {arr.length === 0 && <div className="text-center py-12 text-gray-400">No leave policies yet. Click &quot;Seed Defaults&quot; to add standard Indian leave types.</div>}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">{modal === 'create' ? 'Add Leave Policy' : 'Edit Leave Policy'}</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Leave Code *</label><input value={form.leaveType || ''} onChange={e => setForm({ ...form, leaveType: e.target.value })} placeholder="e.g. EL" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Name *</label><input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Earned Leave" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              </div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Description</label><input value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Annual Days</label><input type="number" value={form.annualAllotment || ''} onChange={e => setForm({ ...form, annualAllotment: Number(e.target.value) })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Max Consecutive Days</label><input type="number" value={form.maxConsecutiveDays || ''} onChange={e => setForm({ ...form, maxConsecutiveDays: e.target.value ? Number(e.target.value) : null })} placeholder="Unlimited" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Color</label><input type="color" value={form.color || '#6366f1'} onChange={e => setForm({ ...form, color: e.target.value })} className="w-full h-9 border border-gray-300 rounded-lg px-1" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Max Carry Forward Days</label><input type="number" value={form.maxCarryForward || ''} onChange={e => setForm({ ...form, maxCarryForward: e.target.value ? Number(e.target.value) : null })} placeholder="Unlimited" disabled={!form.carryForwardAllowed} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:opacity-50" /></div>
              </div>
              <div className="flex flex-wrap gap-4 mt-1">
                {[['isPaid','Paid Leave'],['carryForwardAllowed','Carry Forward'],['encashmentAllowed','Encashable'],['requiresApproval','Requires Approval']].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={!!form[key]} onChange={e => setForm({ ...form, [key]: e.target.checked })} className="rounded" />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setModal(null)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
                {saveMut.isPending ? 'Saving…' : 'Save Policy'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Applications Tab ────────────────────────────────────────────────────────
function ApplicationsTab() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const { data: apps = [], isLoading } = useQuery({ queryKey: ['leave-apps', status], queryFn: () => leaveApi.applications(status ? { status } : undefined) as any });
  const { data: policies = [] } = useQuery({ queryKey: ['leave-policies'], queryFn: () => leaveApi.policies() as any });
  const [applyModal, setApplyModal] = useState(false);
  const [form, setForm] = useState<any>({ isHalfDay: false });
  const [reviewModal, setReviewModal] = useState<any>(null);

  const applyMut  = useMutation({ mutationFn: () => leaveApi.apply(form), onSuccess: () => { qc.invalidateQueries({ queryKey: ['leave-apps'] }); setApplyModal(false); setForm({ isHalfDay: false }); } });
  const reviewMut = useMutation({ mutationFn: (d: any) => leaveApi.review(d.id, { status: d.status, comment: d.comment }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['leave-apps'] }); setReviewModal(null); } });
  const cancelMut = useMutation({ mutationFn: (id: string) => leaveApi.cancel(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['leave-apps'] }) });

  const statusColor: Record<string, string> = { PENDING: 'bg-yellow-100 text-yellow-700', APPROVED: 'bg-green-100 text-green-700', REJECTED: 'bg-red-100 text-red-700', CANCELLED: 'bg-gray-100 text-gray-500' };
  const arr = apps as any[];
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-2">
          {['', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].map(s => (
            <button key={s} onClick={() => setStatus(s)} className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${status === s ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>{s || 'All'}</button>
          ))}
        </div>
        <button onClick={() => setApplyModal(true)} className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Apply for Leave</button>
      </div>

      {isLoading ? <div className="text-center py-12 text-gray-400">Loading…</div> : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr>{['Employee','Leave Type','From','To','Days','Reason','Status','Actions'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100">
              {arr.map((a: any) => (
                <tr key={a.id} className="bg-white hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{a.employee?.firstName} {a.employee?.lastName}<div className="text-xs text-gray-400">{a.employee?.employeeCode}</div></td>
                  <td className="px-4 py-3 text-gray-600">{a.leaveType}{a.isHalfDay && <span className="ml-1 text-xs text-purple-600">(Half)</span>}</td>
                  <td className="px-4 py-3 text-gray-600">{new Date(a.fromDate).toLocaleDateString('en-IN')}</td>
                  <td className="px-4 py-3 text-gray-600">{new Date(a.toDate).toLocaleDateString('en-IN')}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">{a.days}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{a.reason}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 text-xs rounded-full font-medium ${statusColor[a.status] || ''}`}>{a.status}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {a.status === 'PENDING' && <button onClick={() => setReviewModal(a)} className="text-xs text-indigo-600 hover:underline">Review</button>}
                      {['PENDING','APPROVED'].includes(a.status) && <button onClick={() => cancelMut.mutate(a.id)} className="text-xs text-red-500 hover:underline">Cancel</button>}
                    </div>
                  </td>
                </tr>
              ))}
              {arr.length === 0 && <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">No applications found</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {applyModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h3 className="text-lg font-semibold mb-4">Apply for Leave</h3>
            <div className="space-y-3">
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Leave Type *</label>
                <select value={form.leavePolicyId || ''} onChange={e => setForm({ ...form, leavePolicyId: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="">Select…</option>
                  {(policies as any[]).map((p: any) => <option key={p.id} value={p.id}>{p.name} ({p.leaveType})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">From Date *</label><input type="date" value={form.fromDate || ''} onChange={e => setForm({ ...form, fromDate: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">To Date *</label><input type="date" value={form.toDate || ''} onChange={e => setForm({ ...form, toDate: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={form.isHalfDay} onChange={e => setForm({ ...form, isHalfDay: e.target.checked })} className="rounded" /> Half Day</label>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Reason *</label><textarea value={form.reason || ''} onChange={e => setForm({ ...form, reason: e.target.value })} rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setApplyModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={() => applyMut.mutate()} disabled={applyMut.isPending} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">{applyMut.isPending ? 'Submitting…' : 'Submit'}</button>
            </div>
          </div>
        </div>
      )}

      {reviewModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
            <h3 className="text-lg font-semibold mb-2">Review Application</h3>
            <p className="text-sm text-gray-600 mb-4">{reviewModal.employee?.firstName} {reviewModal.employee?.lastName} · {reviewModal.leaveType} · {reviewModal.days} days</p>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Comment (optional)</label><textarea rows={2} onChange={e => setReviewModal({ ...reviewModal, comment: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setReviewModal(null)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
              <button onClick={() => reviewMut.mutate({ id: reviewModal.id, status: 'REJECTED', comment: reviewModal.comment })} disabled={reviewMut.isPending} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50">Reject</button>
              <button onClick={() => reviewMut.mutate({ id: reviewModal.id, status: 'APPROVED', comment: reviewModal.comment })} disabled={reviewMut.isPending} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50">Approve</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Balances Tab ────────────────────────────────────────────────────────────
function BalancesTab() {
  const qc = useQueryClient();
  const fy = currentFY();
  const { data: rows = [], isLoading } = useQuery({ queryKey: ['leave-all-balances', fy], queryFn: () => leaveApi.allBalances(fy) as any });
  const { data: policies = [] } = useQuery({ queryKey: ['leave-policies'], queryFn: () => leaveApi.policies() as any });
  const [encashModal, setEncashModal] = useState<any>(null);
  const [encashForm, setEncashForm] = useState<any>({});

  const initMut   = useMutation({ mutationFn: () => leaveApi.initBalances(fy), onSuccess: () => qc.invalidateQueries({ queryKey: ['leave-all-balances'] }) });
  const cfMut     = useMutation({ mutationFn: () => { const [y] = fy.split('-'); return leaveApi.carryForward(`${Number(y)-1}-${y.slice(2)}`, fy); }, onSuccess: () => qc.invalidateQueries({ queryKey: ['leave-all-balances'] }) });
  const encashMut = useMutation({ mutationFn: () => leaveApi.encash(encashModal.employee.id, { ...encashForm, financialYear: fy }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['leave-all-balances'] }); setEncashModal(null); } });

  const arr = rows as any[];
  const policyList = policies as any[];
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">FY {fy} · {arr.length} employees</p>
        <div className="flex gap-2">
          <button onClick={() => cfMut.mutate()} disabled={cfMut.isPending} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">{cfMut.isPending ? 'Processing…' : 'Process Carry Forward'}</button>
          <button onClick={() => initMut.mutate()} disabled={initMut.isPending} className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">{initMut.isPending ? 'Initializing…' : 'Initialize Balances'}</button>
        </div>
      </div>

      {isLoading ? <div className="text-center py-12 text-gray-400">Loading…</div> : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Employee</th>
                {policyList.map((p: any) => <th key={p.id} className="px-3 py-3 text-center text-xs font-semibold text-gray-500">{p.leaveType}</th>)}
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {arr.map((row: any) => (
                <tr key={row.employee.id} className="bg-white hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{row.employee.firstName} {row.employee.lastName}</p>
                    <p className="text-xs text-gray-400">{row.employee.employeeCode} · {row.employee.designation}</p>
                  </td>
                  {policyList.map((p: any) => {
                    const b = row.balances.find((x: any) => x.leavePolicyId === p.id);
                    const avail = b ? (b.allocated + b.carryForward - b.taken - b.pending - b.encashed) : 0;
                    return (
                      <td key={p.id} className="px-3 py-3 text-center">
                        {b ? (
                          <div>
                            <div className="font-semibold text-gray-900">{avail}</div>
                            <div className="text-xs text-gray-400">{b.taken}T {b.pending > 0 ? `${b.pending}P` : ''}</div>
                          </div>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3">
                    <button onClick={() => { setEncashModal(row); setEncashForm({}); }} className="text-xs text-indigo-600 hover:underline">Encash</button>
                  </td>
                </tr>
              ))}
              {arr.length === 0 && <tr><td colSpan={policyList.length + 2} className="px-4 py-12 text-center text-gray-400">No balance records. Click &quot;Initialize Balances&quot; to create for current FY.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {encashModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
            <h3 className="text-lg font-semibold mb-2">Leave Encashment</h3>
            <p className="text-sm text-gray-600 mb-4">{encashModal.employee.firstName} {encashModal.employee.lastName}</p>
            <div className="space-y-3">
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Leave Type</label>
                <select value={encashForm.leavePolicyId || ''} onChange={e => setEncashForm({ ...encashForm, leavePolicyId: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="">Select…</option>
                  {encashModal.balances.filter((b: any) => b.policy?.encashmentAllowed).map((b: any) => <option key={b.leavePolicyId} value={b.leavePolicyId}>{b.policy?.name}</option>)}
                </select>
              </div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Days to Encash</label><input type="number" min={1} value={encashForm.days || ''} onChange={e => setEncashForm({ ...encashForm, days: Number(e.target.value) })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setEncashModal(null)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
              <button onClick={() => encashMut.mutate()} disabled={encashMut.isPending} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm disabled:opacity-50">{encashMut.isPending ? 'Processing…' : 'Encash'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Calendar Tab ────────────────────────────────────────────────────────────
function CalendarTab() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year,  setYear]  = useState(now.getFullYear());
  const { data, isLoading } = useQuery({ queryKey: ['leave-calendar', month, year], queryFn: () => leaveApi.calendar(month, year) as any });

  const d         = data as any;
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay    = new Date(year, month - 1, 1).getDay();
  const apps        = d?.applications || [];
  const holidays    = d?.holidays     || [];

  function getForDay(day: number) {
    const date = new Date(year, month - 1, day);
    const holiday = holidays.find((h: any) => new Date(h.date).toDateString() === date.toDateString());
    const onLeave = apps.filter((a: any) => {
      const f = new Date(a.fromDate); const t = new Date(a.toDate);
      return date >= f && date <= t;
    });
    return { holiday, onLeave };
  }

  const statusColor: Record<string, string> = { PENDING: 'bg-yellow-400', APPROVED: 'bg-green-500' };
  const calDays: number[] = [];
  for (let i = 0; i < firstDay; i++) calDays.push(0);
  for (let i = 1; i <= daysInMonth; i++) calDays.push(i);

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); }} className="p-1.5 rounded-lg hover:bg-gray-100">◀</button>
        <h3 className="text-base font-semibold text-gray-800">{MONTHS[month - 1]} {year}</h3>
        <button onClick={() => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); }} className="p-1.5 rounded-lg hover:bg-gray-100">▶</button>
        <div className="ml-auto flex gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500 inline-block" /> Approved</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-400 inline-block" /> Pending</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-400 inline-block" /> Holiday</span>
        </div>
      </div>

      {isLoading ? <div className="text-center py-12 text-gray-400">Loading…</div> : (
        <div className="grid grid-cols-7 gap-1 text-xs">
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(wd => <div key={wd} className="text-center font-semibold text-gray-400 py-1">{wd}</div>)}
          {calDays.map((day, i) => {
            if (!day) return <div key={`e-${i}`} />;
            const { holiday, onLeave } = getForDay(day);
            const isToday = new Date().getDate() === day && new Date().getMonth() + 1 === month && new Date().getFullYear() === year;
            return (
              <div key={day} className={`min-h-[80px] p-1 rounded-lg border ${holiday ? 'bg-red-50 border-red-100' : 'bg-white border-gray-100'} ${isToday ? 'ring-2 ring-indigo-400' : ''}`}>
                <div className={`font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full text-xs ${isToday ? 'bg-indigo-600 text-white' : 'text-gray-700'}`}>{day}</div>
                {holiday && <div className="text-red-600 text-[10px] leading-tight truncate" title={holiday.name}>{holiday.name}</div>}
                {(onLeave as any[]).slice(0, 3).map((a: any) => (
                  <div key={a.id} className={`flex items-center gap-1 mt-0.5 px-1 py-0.5 rounded text-[10px] text-white leading-tight ${statusColor[a.status] || 'bg-gray-400'}`}>
                    <span className="truncate">{a.employee?.firstName}</span>
                  </div>
                ))}
                {onLeave.length > 3 && <div className="text-[10px] text-gray-400">+{onLeave.length - 3}</div>}
              </div>
            );
          })}
        </div>
      )}

      {apps.length > 0 && (
        <div className="mt-4 p-4 bg-gray-50 rounded-xl">
          <p className="text-xs font-semibold text-gray-600 mb-2">On Leave This Month ({apps.length})</p>
          <div className="flex flex-wrap gap-2">
            {(apps as any[]).map((a: any) => (
              <span key={a.id} className="px-2 py-0.5 bg-white border border-gray-200 rounded-full text-xs text-gray-700">{a.employee?.firstName} {a.employee?.lastName} · {a.leaveType} · {new Date(a.fromDate).getDate()}–{new Date(a.toDate).getDate()}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Holidays Tab ────────────────────────────────────────────────────────────
function HolidaysTab() {
  const qc = useQueryClient();
  const [year, setYear] = useState(new Date().getFullYear());
  const [state, setState] = useState('');
  const [addModal, setAddModal] = useState(false);
  const [form, setForm] = useState<any>({ type: 'NATIONAL' });

  const { data: holidays = [], isLoading } = useQuery({ queryKey: ['leave-holidays', year], queryFn: () => leaveApi.holidays(year) as any });
  const seedMut   = useMutation({ mutationFn: () => leaveApi.seedHolidays(year, state || undefined), onSuccess: () => qc.invalidateQueries({ queryKey: ['leave-holidays'] }) });
  const createMut = useMutation({ mutationFn: () => leaveApi.createHoliday(form), onSuccess: () => { qc.invalidateQueries({ queryKey: ['leave-holidays'] }); setAddModal(false); setForm({ type: 'NATIONAL' }); } });
  const delMut    = useMutation({ mutationFn: (id: string) => leaveApi.deleteHoliday(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['leave-holidays'] }) });

  const arr = holidays as any[];
  const typeColor: Record<string, string> = { NATIONAL: 'bg-orange-100 text-orange-700', STATE: 'bg-blue-100 text-blue-700', OPTIONAL: 'bg-purple-100 text-purple-700', COMPANY: 'bg-green-100 text-green-700' };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-1">
          <button onClick={() => setYear(y => y - 1)} className="p-1.5 rounded hover:bg-gray-100">◀</button>
          <span className="text-sm font-semibold text-gray-800 px-2">{year}</span>
          <button onClick={() => setYear(y => y + 1)} className="p-1.5 rounded hover:bg-gray-100">▶</button>
        </div>
        <select value={state} onChange={e => setState(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
          <option value="">All States (National)</option>
          {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="ml-auto flex gap-2">
          <button onClick={() => seedMut.mutate()} disabled={seedMut.isPending} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">{seedMut.isPending ? 'Seeding…' : `Seed ${year} Holidays`}</button>
          <button onClick={() => setAddModal(true)} className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">+ Add Holiday</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {MONTHS.map((m, mi) => {
          const mHols = arr.filter((h: any) => new Date(h.date).getMonth() === mi);
          if (mHols.length === 0) return null;
          return (
            <div key={m} className="border border-gray-200 rounded-xl p-3 bg-white">
              <p className="text-xs font-semibold text-gray-500 mb-2">{m} {year}</p>
              <div className="space-y-1.5">
                {mHols.map((h: any) => (
                  <div key={h.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700 w-6 text-center">{new Date(h.date).getDate()}</span>
                      <span className={`px-1.5 py-0.5 text-[10px] rounded font-medium ${typeColor[h.type] || 'bg-gray-100 text-gray-600'}`}>{h.type}</span>
                      <span className="text-sm text-gray-800">{h.name}</span>
                      {h.isOptional && <span className="text-[10px] text-purple-600">(Optional)</span>}
                    </div>
                    <button onClick={() => delMut.mutate(h.id)} className="text-xs text-red-400 hover:text-red-600">✕</button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {isLoading && <div className="col-span-2 text-center py-12 text-gray-400">Loading…</div>}
        {!isLoading && arr.length === 0 && (
          <div className="col-span-2 text-center py-12 text-gray-400">No holidays for {year}. Click &quot;Seed {year} Holidays&quot; to add national holidays.</div>
        )}
      </div>

      {addModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
            <h3 className="text-lg font-semibold mb-4">Add Holiday</h3>
            <div className="space-y-3">
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Name *</label><input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Date *</label><input type="date" value={form.date || ''} onChange={e => setForm({ ...form, date: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  {['NATIONAL','STATE','OPTIONAL','COMPANY'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={!!form.isOptional} onChange={e => setForm({ ...form, isOptional: e.target.checked })} className="rounded" /> Optional Holiday</label>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setAddModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
              <button onClick={() => createMut.mutate()} disabled={createMut.isPending} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm disabled:opacity-50">{createMut.isPending ? 'Saving…' : 'Add'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────
const TABS = ['Policies', 'Applications', 'Balances', 'Calendar', 'Holidays'];

export default function LeavePage() {
  const [tab, setTab] = useState(0);
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Leave Management</h1>
        <p className="text-sm text-gray-500 mt-1">Manage leave policies, applications, balances, and holiday calendar</p>
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab === i ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>{t}</button>
        ))}
      </div>

      <div>
        {tab === 0 && <PoliciesTab />}
        {tab === 1 && <ApplicationsTab />}
        {tab === 2 && <BalancesTab />}
        {tab === 3 && <CalendarTab />}
        {tab === 4 && <HolidaysTab />}
      </div>
    </div>
  );
}
