'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { integrationsApi } from '@/lib/api';

const CATEGORIES = [
  { key: 'ALL',        label: 'All' },
  { key: 'HRMS',       label: 'HRMS / ATS' },
  { key: 'ACCOUNTING', label: 'Accounting' },
  { key: 'BIOMETRIC',  label: 'Biometric' },
  { key: 'TAX',        label: 'TDS / TRACES' },
  { key: 'ESIGN',      label: 'DigiLocker / eSign' },
];

const statusBadge: Record<string, string> = {
  CONNECTED: 'bg-green-100 text-green-700',
  DISCONNECTED: 'bg-gray-100 text-gray-500',
  ERROR: 'bg-red-100 text-red-700',
};
const syncBadge: Record<string, string> = {
  SUCCESS: 'bg-green-100 text-green-700',
  PARTIAL: 'bg-yellow-100 text-yellow-700',
  FAILED: 'bg-red-100 text-red-700',
  RUNNING: 'bg-blue-100 text-blue-700',
};

function timeAgo(d?: string) {
  if (!d) return 'never';
  return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// ── Connect / config drawer ───────────────────────────────────────────────────
function ConnectDrawer({ item, onClose }: { item: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [config, setConfig] = useState<any>(() => ({ ...(item.config || {}) }));
  const [autoSync, setAutoSync] = useState<boolean>(item.autoSync ?? false);
  const [syncFrequency, setSyncFrequency] = useState<string>(item.syncFrequency || 'MANUAL');
  const [testResult, setTestResult] = useState<any>(null);

  const invalidate = () => { qc.invalidateQueries({ queryKey: ['integrations'] }); qc.invalidateQueries({ queryKey: ['integration-logs'] }); };
  const connectMut = useMutation({ mutationFn: () => integrationsApi.connect(item.provider, { config, autoSync, syncFrequency }), onSuccess: () => { invalidate(); onClose(); } });
  const testMut    = useMutation({ mutationFn: () => integrationsApi.test(item.provider), onSuccess: (r: any) => setTestResult(r) });
  const syncMut    = useMutation({ mutationFn: (op: string) => integrationsApi.sync(item.provider, op), onSuccess: () => invalidate() });
  const disconnectMut = useMutation({ mutationFn: () => integrationsApi.disconnect(item.provider), onSuccess: () => { invalidate(); onClose(); } });

  const connected = item.status === 'CONNECTED';
  const isBiometric = item.category === 'BIOMETRIC';

  const [punchText, setPunchText] = useState('');
  const { data: endpoint } = useQuery({
    queryKey: ['device-endpoint', item.provider],
    queryFn: () => integrationsApi.deviceEndpoint(item.provider) as any,
    enabled: isBiometric && connected,
  });
  const uploadMut = useMutation({ mutationFn: () => integrationsApi.punchUpload(item.provider, punchText), onSuccess: () => invalidate() });
  const [copied, setCopied] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/40 flex justify-end z-50" onClick={onClose}>
      <div className="bg-white w-full max-w-md h-full overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{item.icon}</span>
            <div>
              <h3 className="text-lg font-semibold">{item.displayName}</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge[item.status] || ''}`}>{item.status}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <p className="text-sm text-gray-500 mb-5">{item.description}</p>

        {/* Config form */}
        <div className="space-y-3">
          {item.fields.map((fld: any) => (
            <div key={fld.key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{fld.label}{fld.required && <span className="text-red-500"> *</span>}</label>
              {fld.type === 'select' ? (
                <select value={config[fld.key] || ''} onChange={e => setConfig({ ...config, [fld.key]: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="">Select…</option>
                  {fld.options.map((o: string) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input
                  type={fld.type === 'password' ? 'password' : 'text'}
                  value={config[fld.key] || ''}
                  onChange={e => setConfig({ ...config, [fld.key]: e.target.value })}
                  placeholder={fld.placeholder}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                />
              )}
              {fld.help && <p className="text-[11px] text-gray-400 mt-0.5">{fld.help}</p>}
            </div>
          ))}
        </div>

        {/* Sync settings */}
        <div className="mt-4 border border-gray-200 rounded-xl p-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer mb-2">
            <input type="checkbox" checked={autoSync} onChange={e => setAutoSync(e.target.checked)} className="rounded" />
            Auto-sync
          </label>
          <select value={syncFrequency} onChange={e => setSyncFrequency(e.target.value)} disabled={!autoSync} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:opacity-50">
            {['MANUAL', 'HOURLY', 'DAILY', 'WEEKLY'].map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>

        {testResult && (
          <div className={`mt-3 p-3 rounded-lg text-sm ${testResult.reachable ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {testResult.reachable ? '✓ ' : '✕ '}{testResult.message}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-5">
          <button onClick={() => connectMut.mutate()} disabled={connectMut.isPending} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {connectMut.isPending ? 'Saving…' : connected ? 'Update Credentials' : 'Connect'}
          </button>
          {connected && (
            <button onClick={() => testMut.mutate()} disabled={testMut.isPending} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50">
              {testMut.isPending ? 'Testing…' : 'Test'}
            </button>
          )}
        </div>

        {/* Operations */}
        {connected && (
          <div className="mt-5">
            <p className="text-xs font-semibold text-gray-500 mb-2">Available Operations</p>
            <div className="space-y-2">
              {item.operations.map((op: any) => (
                <div key={op.key} className="flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{op.label}</p>
                    <p className="text-[11px] text-gray-400">{op.direction === 'INBOUND' ? '⬇ Import' : '⬆ Export'}</p>
                  </div>
                  <button onClick={() => syncMut.mutate(op.key)} disabled={syncMut.isPending} className="px-3 py-1.5 text-xs bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 disabled:opacity-50">
                    {syncMut.isPending ? 'Running…' : 'Run'}
                  </button>
                </div>
              ))}
            </div>
            {syncMut.data && (
              <div className="mt-2 p-3 bg-gray-50 rounded-lg text-xs text-gray-600">
                <span className={`px-1.5 py-0.5 rounded font-medium ${syncBadge[(syncMut.data as any).status] || ''}`}>{(syncMut.data as any).status}</span>
                <span className="ml-2">{(syncMut.data as any).message}</span>
              </div>
            )}

            {/* Biometric: device push endpoint + manual punch upload */}
            {isBiometric && (
              <div className="mt-5 border-t border-gray-100 pt-4 space-y-4">
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1">Device Push Endpoint (iClock / ADMS)</p>
                  <p className="text-[11px] text-gray-400 mb-2">Configure this URL as the server on your ZKTeco/eSSL device. The device serial (SN) must match.</p>
                  <div className="flex gap-2">
                    <input readOnly value={endpoint?.pushUrl || 'Loading…'} className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-[11px] font-mono bg-gray-50" />
                    <button
                      onClick={() => { if (endpoint?.pushUrl) { navigator.clipboard.writeText(endpoint.pushUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); } }}
                      className="px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50">{copied ? '✓' : 'Copy'}</button>
                  </div>
                  {endpoint?.instructions && (
                    <ul className="mt-2 text-[11px] text-gray-500 list-disc list-inside space-y-0.5">
                      {endpoint.instructions.map((s: string, i: number) => <li key={i}>{s}</li>)}
                    </ul>
                  )}
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1">Manual Punch Upload</p>
                  <p className="text-[11px] text-gray-400 mb-2">Paste device ATTLOG / CSV rows: <code>userId&nbsp;&lt;tab&gt;&nbsp;YYYY-MM-DD HH:mm:ss</code> (one per line). Matched to employees by Biometric Code or Employee Code.</p>
                  <textarea
                    value={punchText}
                    onChange={e => setPunchText(e.target.value)}
                    rows={5}
                    placeholder={'1001\t2026-06-21 09:05:00\n1001\t2026-06-21 18:30:00\n1002\t2026-06-21 09:15:00'}
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-[11px] font-mono"
                  />
                  <button onClick={() => uploadMut.mutate()} disabled={uploadMut.isPending || !punchText.trim()} className="mt-2 w-full px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                    {uploadMut.isPending ? 'Ingesting…' : 'Ingest Punches'}
                  </button>
                  {uploadMut.isError && <p className="mt-2 text-xs text-red-600">{(uploadMut.error as any)?.message || 'Upload failed'}</p>}
                  {uploadMut.data && (
                    <div className="mt-2 p-3 bg-green-50 rounded-lg text-xs text-green-800">
                      <span className={`px-1.5 py-0.5 rounded font-medium ${syncBadge[(uploadMut.data as any).status] || ''}`}>{(uploadMut.data as any).status}</span>
                      <span className="ml-2">{(uploadMut.data as any).daysWritten} day(s) written for {(uploadMut.data as any).employeesAffected} employee(s) from {(uploadMut.data as any).matchedPunches}/{(uploadMut.data as any).totalPunches} punches.</span>
                      {(uploadMut.data as any).unmatchedUserIds?.length > 0 && (
                        <p className="mt-1 text-amber-700">Unmatched IDs: {(uploadMut.data as any).unmatchedUserIds.join(', ')}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            <button onClick={() => disconnectMut.mutate()} disabled={disconnectMut.isPending} className="mt-4 w-full px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm hover:bg-red-50 disabled:opacity-50">
              Disconnect
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function IntegrationsPage() {
  const [category, setCategory] = useState('ALL');
  const [drawer, setDrawer] = useState<any>(null);
  const [showLogs, setShowLogs] = useState(false);

  const { data: integrations = [], isLoading } = useQuery({ queryKey: ['integrations'], queryFn: () => integrationsApi.list() as any });
  const { data: logs = [] } = useQuery({ queryKey: ['integration-logs'], queryFn: () => integrationsApi.logs() as any, enabled: showLogs });

  const arr = integrations as any[];
  const filtered = category === 'ALL' ? arr : arr.filter(i => i.category === category);
  const connectedCount = arr.filter(i => i.status === 'CONNECTED').length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
          <p className="text-sm text-gray-500 mt-1">Connect HRMS, accounting, biometric, TDS and eSign providers · {connectedCount} connected</p>
        </div>
        <button onClick={() => setShowLogs(s => !s)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
          {showLogs ? 'Hide Sync History' : 'Sync History'}
        </button>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2 mb-5">
        {CATEGORIES.map(c => (
          <button key={c.key} onClick={() => setCategory(c.key)} className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${category === c.key ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
            {c.label}
          </button>
        ))}
      </div>

      {showLogs && (
        <div className="mb-6 overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr>{['Provider','Operation','Direction','Status','Records','When','Message'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100">
              {(logs as any[]).map((l: any) => (
                <tr key={l.id} className="bg-white">
                  <td className="px-4 py-3 font-medium text-gray-900">{l.integration?.displayName}</td>
                  <td className="px-4 py-3 text-gray-600">{l.operation}</td>
                  <td className="px-4 py-3 text-gray-500">{l.direction === 'INBOUND' ? '⬇ In' : '⬆ Out'}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 text-xs rounded-full font-medium ${syncBadge[l.status] || ''}`}>{l.status}</span></td>
                  <td className="px-4 py-3 text-gray-600">{l.recordsOk}/{l.recordsTotal}{l.recordsFailed > 0 ? ` (${l.recordsFailed} failed)` : ''}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{timeAgo(l.startedAt)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">{l.message}</td>
                </tr>
              ))}
              {(logs as any[]).length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No sync activity yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Cards grid */}
      {isLoading ? <div className="text-center py-12 text-gray-400">Loading…</div> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item: any) => (
            <button key={item.provider} onClick={() => setDrawer(item)} className="text-left bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-md hover:border-indigo-200 transition-all">
              <div className="flex items-start justify-between mb-2">
                <span className="text-3xl">{item.icon}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge[item.status] || ''}`}>{item.status === 'CONNECTED' ? 'Connected' : item.status === 'ERROR' ? 'Error' : 'Not connected'}</span>
              </div>
              <p className="font-semibold text-gray-900">{item.displayName}</p>
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.description}</p>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                <span className="text-[11px] text-gray-400 uppercase tracking-wide">{item.category}</span>
                {item.status === 'CONNECTED' && (
                  <span className="text-[11px] text-gray-400">
                    {item.lastSyncStatus && <span className={`px-1.5 py-0.5 rounded mr-1 ${syncBadge[item.lastSyncStatus] || ''}`}>{item.lastSyncStatus}</span>}
                    {item.lastSyncAt ? timeAgo(item.lastSyncAt) : 'no sync'}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {drawer && <ConnectDrawer item={drawer} onClose={() => setDrawer(null)} />}
    </div>
  );
}
