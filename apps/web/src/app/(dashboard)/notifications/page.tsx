'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/lib/api';

const CHANNEL_ICON: Record<string, string> = { EMAIL: '✉️', SMS: '💬', WHATSAPP: '🟢', IN_APP: '🔔' };
const statusBadge: Record<string, string> = {
  SENT: 'bg-green-100 text-green-700', FAILED: 'bg-red-100 text-red-700',
  SKIPPED: 'bg-gray-100 text-gray-500', QUEUED: 'bg-blue-100 text-blue-700',
};
const sevBadge: Record<string, string> = {
  overdue: 'bg-red-100 text-red-700', high: 'bg-orange-100 text-orange-700',
  medium: 'bg-yellow-100 text-yellow-700', low: 'bg-gray-100 text-gray-500',
};

// ── Channels Tab ──────────────────────────────────────────────────────────────
function ChannelsTab() {
  const qc = useQueryClient();
  const { data: channels = [], isLoading } = useQuery({ queryKey: ['notif-channels'], queryFn: () => notificationsApi.channels() as any });
  const [modal, setModal] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [testTo, setTestTo] = useState('');

  const saveMut = useMutation({ mutationFn: () => notificationsApi.saveChannel(modal.channel, form), onSuccess: () => { qc.invalidateQueries({ queryKey: ['notif-channels'] }); setModal(null); } });
  const toggleMut = useMutation({ mutationFn: (v: { channel: string; enabled: boolean }) => notificationsApi.toggleChannel(v.channel, v.enabled), onSuccess: () => qc.invalidateQueries({ queryKey: ['notif-channels'] }) });
  const testMut = useMutation({ mutationFn: (channel: string) => notificationsApi.testChannel(channel, testTo) });

  function openConfig(c: any) {
    setModal(c);
    setForm({ provider: c.provider || c.providers[0]?.key, fromName: c.fromName || '', fromAddress: c.fromAddress || '', enabled: c.enabled, config: { ...(c.config || {}) } });
    setTestTo('');
  }

  const arr = channels as any[];
  const activeProvider = modal?.providers?.find((p: any) => p.key === form.provider);

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {isLoading ? <div className="col-span-3 text-center py-12 text-gray-400">Loading…</div> : arr.map((c: any) => (
          <div key={c.channel} className="bg-white border border-gray-200 rounded-2xl p-5">
            <div className="flex items-start justify-between mb-2">
              <span className="text-3xl">{CHANNEL_ICON[c.channel]}</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={c.enabled} disabled={!c.provider}
                  onChange={e => toggleMut.mutate({ channel: c.channel, enabled: e.target.checked })} />
                <div className="w-9 h-5 bg-gray-200 peer-checked:bg-green-500 rounded-full peer transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
              </label>
            </div>
            <p className="font-semibold text-gray-900">{c.channel}</p>
            <p className="text-xs text-gray-500 mt-0.5">{c.provider ? `Provider: ${c.provider}` : 'Not configured'}</p>
            <p className="text-[11px] text-gray-400 mt-1">{c.enabled ? '● Active' : c.provider ? '○ Disabled' : '○ Set up to enable'}</p>
            <button onClick={() => openConfig(c)} className="mt-3 w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">{c.provider ? 'Configure' : 'Set Up'}</button>
          </div>
        ))}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">{CHANNEL_ICON[modal.channel]} Configure {modal.channel}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Provider</label>
                <select value={form.provider} onChange={e => setForm({ ...form, provider: e.target.value, config: {} })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  {modal.providers.map((p: any) => <option key={p.key} value={p.key}>{p.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">From Name</label><input value={form.fromName} onChange={e => setForm({ ...form, fromName: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">{modal.channel === 'EMAIL' ? 'From Email' : 'Sender / Number'}</label><input value={form.fromAddress} onChange={e => setForm({ ...form, fromAddress: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              </div>
              {activeProvider?.fields.map((f: any) => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
                  <input type={f.secret ? 'password' : 'text'} value={form.config?.[f.key] || ''} onChange={e => setForm({ ...form, config: { ...form.config, [f.key]: e.target.value } })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono" />
                </div>
              ))}
              <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={form.enabled} onChange={e => setForm({ ...form, enabled: e.target.checked })} className="rounded" /> Enable this channel</label>

              {modal.provider && (
                <div className="border-t border-gray-100 pt-3">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Send Test To</label>
                  <div className="flex gap-2">
                    <input value={testTo} onChange={e => setTestTo(e.target.value)} placeholder={modal.channel === 'EMAIL' ? 'you@example.com' : '+91…'} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                    <button onClick={() => testMut.mutate(modal.channel)} disabled={testMut.isPending || !testTo} className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">Test</button>
                  </div>
                  {testMut.data && <p className={`text-xs mt-1 ${(testMut.data as any).status === 'SENT' ? 'text-green-600' : 'text-amber-600'}`}>{(testMut.data as any).status}: {(testMut.data as any).error || 'sent'}</p>}
                </div>
              )}
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

// ── Reminders Tab ─────────────────────────────────────────────────────────────
function RemindersTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['payrun-reminders'], queryFn: () => notificationsApi.payrunReminders() as any });
  const sendMut = useMutation({ mutationFn: () => notificationsApi.sendPayrunReminders(), onSuccess: () => qc.invalidateQueries({ queryKey: ['notif-log'] }) });
  const d = data as any;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">Outstanding payroll actions for this cycle</p>
        <button onClick={() => sendMut.mutate()} disabled={sendMut.isPending || !d?.items?.length} className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
          {sendMut.isPending ? 'Sending…' : 'Send Reminders to Admins'}
        </button>
      </div>
      {(sendMut.data as any) && <div className="mb-3 p-3 bg-green-50 rounded-lg text-sm text-green-800">Reminders sent to {(sendMut.data as any).notified} admin(s).</div>}
      {isLoading ? <div className="text-center py-12 text-gray-400">Loading…</div> :
       !d?.items?.length ? <div className="text-center py-12 text-green-600">✓ Payroll is on track — nothing pending.</div> : (
        <div className="space-y-2">
          {d.items.map((i: any, idx: number) => (
            <div key={idx} className="flex items-center justify-between bg-white border border-gray-200 rounded-xl p-4">
              <div>
                <p className="font-medium text-gray-900">{i.title}</p>
                <p className="text-xs text-gray-500">{i.detail}</p>
              </div>
              <div className="text-right">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sevBadge[i.severity] || ''}`}>{i.severity}</span>
                <p className="text-xs text-gray-400 mt-1">by {i.due}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Compliance Tab ────────────────────────────────────────────────────────────
function ComplianceTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['compliance-calendar'], queryFn: () => notificationsApi.complianceCalendar() as any });
  const sendMut = useMutation({ mutationFn: () => notificationsApi.sendComplianceAlerts(), onSuccess: () => qc.invalidateQueries({ queryKey: ['notif-log'] }) });
  const d = data as any;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">Statutory due dates — PF, ESI, PT, TDS & returns</p>
        <button onClick={() => sendMut.mutate()} disabled={sendMut.isPending} className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
          {sendMut.isPending ? 'Sending…' : 'Alert Admins (≤7 days)'}
        </button>
      </div>
      {(sendMut.data as any) && <div className="mb-3 p-3 bg-green-50 rounded-lg text-sm text-green-800">Alerts sent to {(sendMut.data as any).notified} admin(s).</div>}
      {isLoading ? <div className="text-center py-12 text-gray-400">Loading…</div> : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr>{['Obligation','Authority','Due Date','Days Left','Status'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100">
              {(d?.items || []).map((i: any) => (
                <tr key={i.key} className="bg-white hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{i.label}</td>
                  <td className="px-4 py-3 text-gray-600">{i.authority}</td>
                  <td className="px-4 py-3 text-gray-600">{i.dueDate}</td>
                  <td className="px-4 py-3 font-semibold">{i.daysLeft < 0 ? `${-i.daysLeft}d overdue` : `${i.daysLeft}d`}</td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sevBadge[i.severity] || ''}`}>{i.severity}</span></td>
                </tr>
              ))}
              {!d?.items?.length && <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400">No upcoming deadlines</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Broadcast Tab ─────────────────────────────────────────────────────────────
function BroadcastTab() {
  const [channels, setChannels] = useState<string[]>(['EMAIL']);
  const [recipientFilter, setRecipientFilter] = useState('ALL_EMPLOYEES');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const sendMut = useMutation({ mutationFn: () => notificationsApi.broadcast({ channels, recipientFilter, subject, body }) });

  function toggleCh(c: string) { setChannels(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]); }

  return (
    <div className="max-w-2xl">
      <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Channels</label>
          <div className="flex gap-2">
            {['EMAIL', 'SMS', 'WHATSAPP'].map(c => (
              <button key={c} onClick={() => toggleCh(c)} className={`px-3 py-1.5 text-sm rounded-lg border ${channels.includes(c) ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 text-gray-600'}`}>{CHANNEL_ICON[c]} {c}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Recipients</label>
          <select value={recipientFilter} onChange={e => setRecipientFilter(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="ALL_EMPLOYEES">All active employees</option>
            <option value="ALL_ADMINS">All admins / HR</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Subject (email)</label>
          <input value={subject} onChange={e => setSubject(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Message <span className="text-gray-400">— use {'{{name}}'} for recipient name</span></label>
          <textarea value={body} onChange={e => setBody(e.target.value)} rows={5} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <button onClick={() => sendMut.mutate()} disabled={sendMut.isPending || !body.trim() || !channels.length} className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
          {sendMut.isPending ? 'Sending…' : 'Send Broadcast'}
        </button>
        {(sendMut.data as any) && <div className="p-3 bg-green-50 rounded-lg text-sm text-green-800">Queued for {(sendMut.data as any).recipients} recipient(s) across {channels.length} channel(s).</div>}
        {sendMut.isError && <p className="text-sm text-red-600">{(sendMut.error as any)?.message || 'Failed'}</p>}
      </div>
    </div>
  );
}

// ── Log Tab ───────────────────────────────────────────────────────────────────
function LogTab() {
  const [filter, setFilter] = useState<any>({});
  const { data: stats } = useQuery({ queryKey: ['notif-stats'], queryFn: () => notificationsApi.stats() as any });
  const { data, isLoading } = useQuery({ queryKey: ['notif-log', filter], queryFn: () => notificationsApi.list(filter) as any });
  const s = stats as any;
  const d = data as any;

  return (
    <div>
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Total', val: s?.total ?? 0, color: 'text-gray-900' },
          { label: 'Sent', val: s?.sent ?? 0, color: 'text-green-600' },
          { label: 'Failed', val: s?.failed ?? 0, color: 'text-red-600' },
          { label: 'Skipped', val: s?.skipped ?? 0, color: 'text-gray-500' },
        ].map(c => (
          <div key={c.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500">{c.label}</p>
            <p className={`text-2xl font-bold ${c.color}`}>{c.val}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mb-4">
        {['', 'EMAIL', 'SMS', 'WHATSAPP'].map(ch => (
          <button key={ch} onClick={() => setFilter((f: any) => ({ ...f, channel: ch || undefined }))} className={`px-3 py-1.5 text-xs rounded-full border ${(filter.channel || '') === ch ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 text-gray-600'}`}>{ch || 'All channels'}</button>
        ))}
      </div>
      {isLoading ? <div className="text-center py-12 text-gray-400">Loading…</div> : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr>{['Channel','Event','Recipient','Subject','Status','When'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100">
              {(d?.data || []).map((n: any) => (
                <tr key={n.id} className="bg-white hover:bg-gray-50">
                  <td className="px-4 py-3">{CHANNEL_ICON[n.channel]} <span className="text-xs text-gray-500">{n.channel}</span></td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{n.eventType}</td>
                  <td className="px-4 py-3 text-gray-700">{n.recipientName || n.recipient}<div className="text-[11px] text-gray-400">{n.recipient}</div></td>
                  <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{n.subject || n.body}</td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge[n.status] || ''}`}>{n.status}</span>{n.error && <div className="text-[11px] text-red-500 mt-0.5">{n.error}</div>}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{new Date(n.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                </tr>
              ))}
              {!d?.data?.length && <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">No notifications yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
const TABS = ['Channels', 'Payrun Reminders', 'Compliance Calendar', 'Broadcast', 'Log'];

export default function NotificationsPage() {
  const [tab, setTab] = useState(0);
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Notifications 📤</h1>
        <p className="text-sm text-gray-500 mt-1">Email / SMS / WhatsApp alerts, payrun reminders, compliance deadlines & approvals</p>
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab === i ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>{t}</button>
        ))}
      </div>

      <div>
        {tab === 0 && <ChannelsTab />}
        {tab === 1 && <RemindersTab />}
        {tab === 2 && <ComplianceTab />}
        {tab === 3 && <BroadcastTab />}
        {tab === 4 && <LogTab />}
      </div>
    </div>
  );
}
