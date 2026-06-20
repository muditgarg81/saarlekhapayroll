'use client';
import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bankApi, payrunApi } from '@/lib/api';
import { MONTHS } from '@saarlekha/shared';

const fmt = (n: number) => `₹${Math.round(n ?? 0).toLocaleString('en-IN')}`;

const STATUS_META: Record<string, { label: string; cls: string }> = {
  GENERATED:      { label: 'Generated',      cls: 'bg-gray-100 text-gray-600' },
  UPLOADED:       { label: 'Uploaded',        cls: 'bg-blue-100 text-blue-700' },
  PROCESSING:     { label: 'Processing',      cls: 'bg-yellow-100 text-yellow-700' },
  COMPLETED:      { label: 'Completed',       cls: 'bg-green-100 text-green-700' },
  PARTIALLY_PAID: { label: 'Partially Paid',  cls: 'bg-orange-100 text-orange-700' },
  FAILED:         { label: 'Failed',          cls: 'bg-red-100 text-red-700' },
};

const TX_STATUS_META: Record<string, { label: string; cls: string; dot: string }> = {
  PENDING:  { label: 'Pending',  cls: 'bg-gray-100 text-gray-500',  dot: 'bg-gray-400' },
  SUCCESS:  { label: 'Success',  cls: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  FAILED:   { label: 'Failed',   cls: 'bg-red-100 text-red-700',    dot: 'bg-red-500' },
  RETURNED: { label: 'Returned', cls: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
};

const TABS = [
  { id: 'advices',  label: 'Bank Advices',   icon: '🏦' },
  { id: 'generate', label: 'Generate Advice', icon: '⚡' },
] as const;
type TabId = typeof TABS[number]['id'];

export default function BankPage() {
  const [tab, setTab] = useState<TabId>('advices');
  const [detailId, setDetailId] = useState<string | null>(null);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Bank Payments</h1>
        <p className="text-gray-500 text-sm mt-1">NEFT / IMPS bulk disbursement · Advice file generation · UTR tracking</p>
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${tab === t.id ? 'bg-white shadow text-brand-700' : 'text-gray-500 hover:text-gray-700'}`}>
            <span>{t.icon}</span><span>{t.label}</span>
          </button>
        ))}
      </div>

      {tab === 'advices'  && <AdviceListTab onSelect={setDetailId} />}
      {tab === 'generate' && <GenerateTab onCreated={id => { setDetailId(id); setTab('advices'); }} />}

      {detailId && <AdviceDrawer id={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}

// ── Advice List Tab ───────────────────────────────────────────
function AdviceListTab({ onSelect }: { onSelect: (id: string) => void }) {
  const [statusFilter, setStatusFilter] = useState('');
  const { data = [], isLoading } = useQuery({
    queryKey: ['bank-advices', statusFilter],
    queryFn:  () => bankApi.listAdvices(statusFilter ? { status: statusFilter } : undefined),
  });
  const advices = data as any[];

  // Aggregate stats
  const stats = advices.reduce((a, r) => ({
    total:     a.total     + r.totalAmount,
    completed: a.completed + (r.status === 'COMPLETED' ? r.totalAmount : 0),
    pending:   a.pending   + (['GENERATED','UPLOADED','PROCESSING'].includes(r.status) ? r.totalAmount : 0),
    failed:    a.failed    + (r.status === 'FAILED' ? r.totalAmount : 0),
  }), { total: 0, completed: 0, pending: 0, failed: 0 });

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        <SCard label="Total Disbursed (all time)" value={fmt(stats.total)} />
        <SCard label="Completed"   value={fmt(stats.completed)} cls="bg-green-50 border-green-200" vcls="text-green-700" />
        <SCard label="In Progress" value={fmt(stats.pending)}   cls="bg-blue-50 border-blue-200"   vcls="text-blue-700" />
        <SCard label="Failed"      value={fmt(stats.failed)}    cls="bg-red-50 border-red-200"     vcls="text-red-700" />
      </div>

      {/* Filter strip */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">Filter by status:</span>
        {['', 'GENERATED', 'UPLOADED', 'PROCESSING', 'COMPLETED', 'PARTIALLY_PAID', 'FAILED'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${statusFilter === s ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? <div className="p-8 text-center text-gray-400">Loading…</div> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs">
                <th className="px-4 py-2.5 text-left font-medium text-gray-600">Advice No.</th>
                <th className="px-4 py-2.5 text-left font-medium text-gray-600">Payrun</th>
                <th className="px-4 py-2.5 text-left font-medium text-gray-600">Debit Bank</th>
                <th className="px-4 py-2.5 text-center font-medium text-gray-600">Mode</th>
                <th className="px-4 py-2.5 text-right font-medium text-gray-600">Employees</th>
                <th className="px-4 py-2.5 text-right font-medium text-gray-600">Total Amount</th>
                <th className="px-4 py-2.5 text-center font-medium text-gray-600">Status</th>
                <th className="px-4 py-2.5 text-left font-medium text-gray-600">Generated</th>
                <th className="px-4 py-2.5 text-center font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {advices.map((a: any) => (
                <tr key={a.id} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => onSelect(a.id)}>
                  <td className="px-4 py-2.5 font-mono text-xs text-brand-700 font-semibold">{a.adviceNo}</td>
                  <td className="px-4 py-2.5 text-xs">
                    {a.payrun ? `${MONTHS[a.payrun.month - 1]} ${a.payrun.year} · ${a.payrun.type.replace('_', ' ')}` : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-600">{a.bankName}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${a.mode === 'IMPS' ? 'bg-purple-100 text-purple-700' : a.mode === 'RTGS' ? 'bg-blue-100 text-blue-700' : 'bg-teal-100 text-teal-700'}`}>
                      {a.mode}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">{a.employeeCount}</td>
                  <td className="px-4 py-2.5 text-right font-semibold">{fmt(a.totalAmount)}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_META[a.status]?.cls || ''}`}>
                      {STATUS_META[a.status]?.label || a.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">
                    {new Date(a.generatedAt).toLocaleDateString('en-IN')}
                  </td>
                  <td className="px-4 py-2.5 text-center" onClick={e => e.stopPropagation()}>
                    <button onClick={() => onSelect(a.id)} className="text-xs text-brand-600 hover:underline">View</button>
                  </td>
                </tr>
              ))}
              {advices.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400">
                  No bank advices yet. Generate one from an approved payrun.
                </td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Generate Advice Tab ───────────────────────────────────────
function GenerateTab({ onCreated }: { onCreated: (id: string) => void }) {
  const [form, setForm] = useState({
    payrunId: '', mode: 'NEFT', bankName: '', accountNo: '', ifscCode: '',
  });
  const [error, setError] = useState('');
  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));

  const { data: payruns = [] } = useQuery({
    queryKey: ['payruns-approved'],
    queryFn:  () => payrunApi.list(),
  });
  const approvedPayruns = (payruns as any[]).filter(p => ['APPROVED', 'PAID'].includes(p.status));

  const mut = useMutation({
    mutationFn: () => bankApi.generateAdvice(form),
    onSuccess:  (data: any) => onCreated(data.id),
    onError:    (e: any) => setError(e.message || e.error || 'Failed to generate advice'),
  });

  const BANKS = [
    'HDFC Bank', 'State Bank of India', 'ICICI Bank', 'Axis Bank',
    'Kotak Mahindra Bank', 'Punjab National Bank', 'Canara Bank',
    'Bank of Baroda', 'Union Bank of India', 'Yes Bank', 'Indusind Bank',
    'Federal Bank', 'RBL Bank', 'IDFC First Bank',
  ];

  return (
    <div className="max-w-lg">
      <h2 className="text-lg font-semibold mb-4">Generate Bank Advice File</h2>
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

      <div className="card p-6 space-y-4">
        <div>
          <label className="label">Select Approved Payrun *</label>
          <select className="input" value={form.payrunId} onChange={f('payrunId')}>
            <option value="">Choose payrun…</option>
            {approvedPayruns.map((p: any) => (
              <option key={p.id} value={p.id}>
                {MONTHS[p.month - 1]} {p.year} — {p.type.replace('_', ' ')} — {fmt(p.totalNetPay)} ({p.totalEmployees} employees)
              </option>
            ))}
          </select>
          {approvedPayruns.length === 0 && (
            <p className="text-xs text-amber-600 mt-1">No approved payruns found. Approve a payrun first.</p>
          )}
        </div>

        <div>
          <label className="label">Payment Mode *</label>
          <div className="flex gap-2">
            {['NEFT', 'IMPS', 'RTGS'].map(m => (
              <button key={m} onClick={() => setForm(p => ({ ...p, mode: m }))}
                className={`flex-1 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors ${form.mode === m ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                {m}
                <div className="text-xs font-normal mt-0.5 opacity-60">
                  {m === 'NEFT' ? 'Batch · 2h settlement' : m === 'IMPS' ? 'Instant · 24×7' : '> ₹2L · Same day'}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Company Debit Bank *</label>
          <select className="input" value={form.bankName} onChange={f('bankName')}>
            <option value="">Select company bank…</option>
            {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Debit Account No.</label>
            <input className="input" value={form.accountNo} onChange={f('accountNo')} placeholder="e.g. 12345678901" />
          </div>
          <div>
            <label className="label">Debit IFSC</label>
            <input className="input" value={form.ifscCode} onChange={f('ifscCode')} placeholder="e.g. HDFC0001234" />
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
          The advice file will include each employee's bank account, IFSC, net pay amount, and narration. Download it after generation and upload to your bank portal.
        </div>

        <button
          onClick={() => mut.mutate()}
          disabled={mut.isPending || !form.payrunId || !form.bankName}
          className="btn-primary w-full"
        >
          {mut.isPending ? 'Generating…' : 'Generate Bank Advice'}
        </button>
      </div>
    </div>
  );
}

// ── Advice Detail Drawer ──────────────────────────────────────
function AdviceDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'transactions' | 'banks' | 'utr'>('transactions');
  const [txEdit, setTxEdit] = useState<any>(null);
  const [utrCsv, setUtrCsv] = useState('');
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['bank-advice', id],
    queryFn:  () => bankApi.getAdvice(id),
  });
  const { data: bankData } = useQuery({
    queryKey: ['bank-summary', id],
    queryFn:  () => bankApi.bankSummary(id),
    enabled:  activeTab === 'banks',
  });

  const advice = data as any;

  const uploadMut = useMutation({
    mutationFn: () => bankApi.markUploaded(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['bank-advice', id] }); qc.invalidateQueries({ queryKey: ['bank-advices'] }); },
    onError:    (e: any) => setError(e.message || 'Failed'),
  });

  const bulkMut = useMutation({
    mutationFn: () => bankApi.bulkUTR(id, utrCsv),
    onSuccess:  (r: any) => { qc.invalidateQueries({ queryKey: ['bank-advice', id] }); qc.invalidateQueries({ queryKey: ['bank-advices'] }); setError(`Processed ${r.processed} records`); },
    onError:    (e: any) => setError(e.message || 'Failed'),
  });

  const handleDownload = async () => {
    try {
      const blob = await bankApi.downloadAdvice(id);
      const url  = URL.createObjectURL(blob as any);
      const a    = document.createElement('a');
      a.href = url; a.download = `${advice?.adviceNo}_${advice?.mode}.txt`;
      a.click(); URL.revokeObjectURL(url);
    } catch { setError('Download failed'); }
  };

  const txs = advice?.transactions || [];
  const successCount  = txs.filter((t: any) => t.status === 'SUCCESS').length;
  const pendingCount  = txs.filter((t: any) => t.status === 'PENDING').length;
  const failedCount   = txs.filter((t: any) => t.status === 'FAILED').length;
  const successAmount = txs.filter((t: any) => t.status === 'SUCCESS').reduce((s: number, t: any) => s + t.amount, 0);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
      <div className="bg-white w-full max-w-3xl h-full overflow-y-auto flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-200 flex-shrink-0">
          <div>
            {advice && (
              <>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-semibold font-mono text-brand-700">{advice.adviceNo}</h2>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_META[advice.status]?.cls || ''}`}>
                    {STATUS_META[advice.status]?.label}
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${advice.mode === 'IMPS' ? 'bg-purple-100 text-purple-700' : 'bg-teal-100 text-teal-700'}`}>
                    {advice.mode}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {advice.bankName} · {advice.employeeCount} employees · {fmt(advice.totalAmount)}
                </p>
              </>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        {isLoading ? <div className="p-8 text-center text-gray-400">Loading…</div> : advice && (
          <div className="flex-1 overflow-y-auto">
            {/* Action bar */}
            <div className="flex items-center gap-2 px-6 py-3 border-b border-gray-100 bg-gray-50">
              <button onClick={handleDownload} className="btn-secondary text-xs gap-1">
                ↓ Download Advice File
              </button>
              {advice.status === 'GENERATED' && (
                <button onClick={() => uploadMut.mutate()} disabled={uploadMut.isPending}
                  className="btn-primary text-xs">Mark Uploaded to Bank</button>
              )}
            </div>

            {/* Error / info bar */}
            {error && (
              <div className="mx-6 mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-xs flex justify-between">
                <span>{error}</span>
                <button onClick={() => setError('')} className="text-blue-400">✕</button>
              </div>
            )}

            {/* Progress summary */}
            <div className="grid grid-cols-4 gap-3 p-6 pb-0">
              <SCard label="Total" value={fmt(advice.totalAmount)} />
              <SCard label={`Success (${successCount})`} value={fmt(successAmount)} cls="bg-green-50 border-green-200" vcls="text-green-700" />
              <SCard label={`Pending (${pendingCount})`} value={fmt(txs.filter((t: any) => t.status === 'PENDING').reduce((s: number, t: any) => s + t.amount, 0))} />
              <SCard label={`Failed (${failedCount})`}   value={fmt(txs.filter((t: any) => t.status === 'FAILED').reduce((s: number, t: any) => s + t.amount, 0))} cls="bg-red-50 border-red-200" vcls="text-red-700" />
            </div>

            {/* Progress bar */}
            {txs.length > 0 && (
              <div className="mx-6 mt-3 h-2 bg-gray-200 rounded-full overflow-hidden flex">
                <div className="bg-green-500 transition-all" style={{ width: `${(successCount / txs.length) * 100}%` }} />
                <div className="bg-red-400 transition-all"   style={{ width: `${(failedCount  / txs.length) * 100}%` }} />
              </div>
            )}

            {/* Sub tabs */}
            <div className="flex gap-1 px-6 pt-4 border-b border-gray-200">
              {[['transactions', 'Transactions'], ['banks', 'Bank-wise'], ['utr', 'UTR Upload']].map(([t, l]) => (
                <button key={t} onClick={() => setActiveTab(t as any)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === t ? 'border-brand-500 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  {l}
                </button>
              ))}
            </div>

            {/* Transactions list */}
            {activeTab === 'transactions' && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-xs">
                      <th className="px-4 py-2 text-left font-medium text-gray-600">Employee</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">Bank</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">Account</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">IFSC</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-600">Amount</th>
                      <th className="px-4 py-2 text-center font-medium text-gray-600">Status</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">UTR</th>
                      <th className="px-4 py-2 text-center font-medium text-gray-600">Edit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txs.map((tx: any) => (
                      <tr key={tx.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-2">
                          <div className="font-medium text-xs">{tx.employeeName}</div>
                          <div className="text-gray-400 text-xs">{tx.employeeCode}</div>
                        </td>
                        <td className="px-4 py-2 text-xs text-gray-600">{tx.bankName}</td>
                        <td className="px-4 py-2 font-mono text-xs text-gray-500">
                          {'•'.repeat(Math.max(0, tx.accountNumber.length - 4))}{tx.accountNumber.slice(-4)}
                        </td>
                        <td className="px-4 py-2 font-mono text-xs text-gray-500">{tx.ifscCode}</td>
                        <td className="px-4 py-2 text-right font-semibold text-xs">{fmt(tx.amount)}</td>
                        <td className="px-4 py-2 text-center">
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${TX_STATUS_META[tx.status]?.cls || ''}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${TX_STATUS_META[tx.status]?.dot}`} />
                            {TX_STATUS_META[tx.status]?.label || tx.status}
                          </span>
                        </td>
                        <td className="px-4 py-2 font-mono text-xs text-gray-400">{tx.utr || '—'}</td>
                        <td className="px-4 py-2 text-center">
                          <button onClick={() => setTxEdit(tx)} className="text-xs text-brand-600 hover:underline">Edit</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Bank-wise breakdown */}
            {activeTab === 'banks' && (
              <div className="p-6">
                <h3 className="font-semibold text-sm text-gray-700 mb-3">Multi-bank Breakdown</h3>
                <p className="text-xs text-gray-500 mb-4">Salary disbursed to employees across {(bankData as unknown as any[])?.length || '…'} banks</p>
                <div className="space-y-3">
                  {(bankData as unknown as any[])?.map((b: any) => (
                    <div key={b.bank} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                      <div className="w-10 h-10 bg-white border border-gray-200 rounded-lg flex items-center justify-center text-lg">🏦</div>
                      <div className="flex-1">
                        <div className="font-medium text-sm text-gray-900">{b.bank}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{b.count} employees</div>
                        {/* Mini progress bar */}
                        <div className="mt-1.5 h-1.5 bg-gray-200 rounded-full overflow-hidden flex">
                          {b.successCount > 0 && <div className="bg-green-500" style={{ width: `${(b.successCount / b.count) * 100}%` }} />}
                          {b.failedCount  > 0 && <div className="bg-red-400"   style={{ width: `${(b.failedCount  / b.count) * 100}%` }} />}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-sm">{fmt(b.amount)}</div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {b.successCount} ok · {b.pendingCount} pending · {b.failedCount} failed
                        </div>
                      </div>
                    </div>
                  ))}
                  {!(bankData as unknown as any[])?.length && <p className="text-gray-400 text-sm text-center py-6">No data yet</p>}
                </div>
              </div>
            )}

            {/* UTR Bulk Upload */}
            {activeTab === 'utr' && (
              <div className="p-6 space-y-4">
                <div>
                  <h3 className="font-semibold text-sm text-gray-700 mb-1">Bulk UTR Upload</h3>
                  <p className="text-xs text-gray-500">Paste CSV with columns: <code className="bg-gray-100 px-1 py-0.5 rounded">employeeCode,utr,status,failureReason</code></p>
                  <p className="text-xs text-gray-400 mt-0.5">Status values: SUCCESS | FAILED | RETURNED · header row is skipped</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-xs font-mono text-gray-500 border border-gray-200">
                  employeeCode,utr,status,failureReason<br />
                  EMP001,UTR123456789,SUCCESS,<br />
                  EMP002,UTR987654321,SUCCESS,<br />
                  EMP003,,FAILED,Invalid IFSC
                </div>
                <textarea
                  className="input font-mono text-xs h-36 resize-none"
                  placeholder="employeeCode,utr,status,failureReason&#10;EMP001,UTR123456,SUCCESS,"
                  value={utrCsv}
                  onChange={e => setUtrCsv(e.target.value)}
                />
                <button onClick={() => bulkMut.mutate()} disabled={bulkMut.isPending || !utrCsv.trim()}
                  className="btn-primary text-sm">
                  {bulkMut.isPending ? 'Processing…' : 'Upload UTR Data'}
                </button>

                {/* Manual single transaction update shortcut */}
                <div className="border-t border-gray-200 pt-4">
                  <p className="text-xs text-gray-500 mb-2">Or update a single transaction from the Transactions tab → Edit button.</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {txEdit && (
        <TxEditModal
          tx={txEdit}
          adviceId={id}
          onClose={() => setTxEdit(null)}
          onSuccess={() => { setTxEdit(null); qc.invalidateQueries({ queryKey: ['bank-advice', id] }); qc.invalidateQueries({ queryKey: ['bank-advices'] }); }}
        />
      )}
    </div>
  );
}

// ── Transaction Edit Modal ────────────────────────────────────
function TxEditModal({ tx, adviceId, onClose, onSuccess }: any) {
  const [form, setForm] = useState({ status: tx.status, utr: tx.utr || '', failureReason: tx.failureReason || '' });
  const [error, setError] = useState('');
  const mut = useMutation({
    mutationFn: () => bankApi.updateTx(adviceId, tx.id, form),
    onSuccess,
    onError: (e: any) => setError(e.message || 'Failed'),
  });

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Update Transaction</h3>
            <p className="text-xs text-gray-500 mt-0.5">{tx.employeeName} · {fmt(tx.amount)}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div className="p-5 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
          <div>
            <label className="label">Status</label>
            <select className="input" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
              <option value="PENDING">Pending</option>
              <option value="SUCCESS">Success</option>
              <option value="FAILED">Failed</option>
              <option value="RETURNED">Returned</option>
            </select>
          </div>
          <div>
            <label className="label">UTR / Reference No.</label>
            <input className="input font-mono" value={form.utr} onChange={e => setForm(p => ({ ...p, utr: e.target.value }))} placeholder="e.g. UTRIBK2024061900001" />
          </div>
          {['FAILED','RETURNED'].includes(form.status) && (
            <div>
              <label className="label">Failure Reason</label>
              <input className="input" value={form.failureReason} onChange={e => setForm(p => ({ ...p, failureReason: e.target.value }))} placeholder="e.g. Invalid account number" />
            </div>
          )}
        </div>
        <div className="p-5 border-t border-gray-200 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={() => mut.mutate()} disabled={mut.isPending} className="btn-primary">
            {mut.isPending ? 'Saving…' : 'Update'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────
function SCard({ label, value, cls = 'bg-gray-50 border-gray-200', vcls = 'text-gray-900' }: any) {
  return (
    <div className={`rounded-xl border p-3 text-center ${cls}`}>
      <div className={`text-base font-bold ${vcls}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}
