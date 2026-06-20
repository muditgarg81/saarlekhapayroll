'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { companyApi, branchesApi, usersApi, auditApi, authApi, departmentsApi } from '@/lib/api';
import { INDIA_STATES, MONTHS } from '@saarlekha/shared';
import { useAuthStore } from '@/stores/auth.store';

type Tab = 'company' | 'branches' | 'departments' | 'users' | 'security' | 'audit';

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('company');
  const user = useAuthStore(s => s.user);
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  const TABS: { key: Tab; label: string; adminOnly?: boolean }[] = [
    { key: 'company',   label: 'Company' },
    { key: 'branches',  label: 'Branches' },
    { key: 'departments', label: 'Departments' },
    { key: 'users',     label: 'Users & Roles', adminOnly: true },
    { key: 'security',  label: 'Security' },
    { key: 'audit',     label: 'Audit Log', adminOnly: true },
  ];

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Company configuration, access control and security</p>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit mb-6">
        {TABS.filter(t => !t.adminOnly || isAdmin).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'company'  && <CompanyTab />}
      {tab === 'branches' && <BranchesCard />}
      {tab === 'departments' && <DepartmentsTab />}
      {tab === 'users'    && <UsersTab />}
      {tab === 'security' && <SecurityTab />}
      {tab === 'audit'    && <AuditTab />}
    </div>
  );
}

// ── Company Tab ───────────────────────────────────────────────
function CompanyTab() {
  const qc = useQueryClient();
  const { data: company, isLoading } = useQuery({ queryKey: ['company'], queryFn: companyApi.get });
  const [form, setForm] = useState<any>(null);
  const [saved, setSaved] = useState(false);

  const mutation = useMutation({
    mutationFn: (data: any) => companyApi.update(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['company'] }); setSaved(true); setTimeout(() => setSaved(false), 3000); },
  });

  const current = form || (company as any) || {};
  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f: any) => ({ ...(f || company), [key]: e.target.value }));

  if (isLoading) return <div className="text-gray-500 text-sm">Loading...</div>;

  return (
    <div className="card p-6 max-w-2xl">
      <h3 className="font-semibold text-gray-900 mb-4">Company Details</h3>
      {saved && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">Settings saved.</div>}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label><input className="input" value={current.name || ''} onChange={set('name')} /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Legal Name</label><input className="input" value={current.legalName || ''} onChange={set('legalName')} /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">PAN</label><input className="input uppercase" value={current.pan || ''} onChange={set('pan')} /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">TAN</label><input className="input" value={current.tan || ''} onChange={set('tan')} /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">PF Registration No.</label><input className="input" value={current.pfRegistrationNo || ''} onChange={set('pfRegistrationNo')} /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">ESI Registration No.</label><input className="input" value={current.esiRegistrationNo || ''} onChange={set('esiRegistrationNo')} /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">GST No.</label><input className="input" value={current.gstNo || ''} onChange={set('gstNo')} /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">State</label>
            <select className="input" value={current.state || ''} onChange={set('state')}>
              {INDIA_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Payroll Cycle</label>
            <select className="input" value={current.payrollCycle || 'MONTHLY'} onChange={set('payrollCycle')}>
              <option value="MONTHLY">Monthly</option>
              <option value="WEEKLY">Weekly</option>
            </select>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Financial Year Starts</label>
            <select className="input" value={current.financialYearStart || 4} onChange={set('financialYearStart')}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end pt-2">
          <button onClick={() => mutation.mutate(form)} disabled={mutation.isPending || !form} className="btn-primary">
            {mutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Branches Card ─────────────────────────────────────────────
function BranchesCard() {
  const qc = useQueryClient();
  const { data: branches = [], isLoading } = useQuery({ queryKey: ['branches'], queryFn: branchesApi.list });
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<any>({ name: '', code: '', state: '', city: '', isHeadOffice: false });
  const [error, setError] = useState('');

  const create = useMutation({
    mutationFn: () => branchesApi.create(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['branches'] }); setAdding(false); setForm({ name: '', code: '', state: '', city: '', isHeadOffice: false }); setError(''); },
    onError: (e: any) => setError(e.message || 'Failed to add branch'),
  });
  const remove = useMutation({
    mutationFn: (id: string) => branchesApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['branches'] }),
    onError: (e: any) => setError(e.message || 'Failed to delete branch'),
  });

  const set = (k: string) => (e: any) => setForm((f: any) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="card p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Branches</h3>
        <button onClick={() => setAdding(a => !a)} className="btn-secondary text-sm py-1.5">{adding ? 'Cancel' : '+ Add Branch'}</button>
      </div>
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

      {adding && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg grid grid-cols-2 gap-3">
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Name</label><input className="input" value={form.name} onChange={set('name')} placeholder="Mumbai HO" /></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Code</label><input className="input uppercase" value={form.code} onChange={set('code')} placeholder="MUM" /></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">State</label>
            <select className="input" value={form.state} onChange={set('state')}>
              <option value="">Select state</option>
              {INDIA_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">City</label><input className="input" value={form.city} onChange={set('city')} /></div>
          <label className="col-span-2 flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.isHeadOffice} onChange={e => setForm((f: any) => ({ ...f, isHeadOffice: e.target.checked }))} />
            Head Office
          </label>
          <div className="col-span-2 flex justify-end">
            <button onClick={() => create.mutate()} disabled={create.isPending || !form.name || !form.code || !form.state} className="btn-primary text-sm">
              {create.isPending ? 'Adding...' : 'Add'}
            </button>
          </div>
        </div>
      )}

      {isLoading ? <div className="text-gray-500 text-sm">Loading...</div> : (
        <div className="space-y-2">
          {(branches as any[]).map((b: any) => (
            <div key={b.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <div>
                <div className="text-sm font-medium text-gray-900">
                  {b.name} {b.isHeadOffice && <span className="badge-blue ml-1">HO</span>}
                </div>
                <div className="text-xs text-gray-500">{b.code} · {b.state}{b.city ? ` · ${b.city}` : ''} · {b._count?.employees ?? 0} employees</div>
              </div>
              <button onClick={() => remove.mutate(b.id)} className="text-red-600 hover:text-red-800 text-xs font-medium">Delete</button>
            </div>
          ))}
          {(branches as any[]).length === 0 && <div className="text-gray-500 text-sm">No branches yet.</div>}
        </div>
      )}
    </div>
  );
}

// ── Users & Roles Tab ─────────────────────────────────────────
const ROLES = ['ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE'];
const ROLE_BADGE: Record<string, string> = {
  SUPER_ADMIN: 'bg-purple-100 text-purple-700',
  ADMIN: 'bg-red-100 text-red-700',
  HR_MANAGER: 'bg-orange-100 text-orange-700',
  MANAGER: 'bg-blue-100 text-blue-700',
  EMPLOYEE: 'bg-gray-100 text-gray-600',
};

function UsersTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [resetId, setResetId] = useState<string | null>(null);
  const [newPwd, setNewPwd] = useState('');
  const [error, setError] = useState('');

  const { data: users = [], isLoading } = useQuery({ queryKey: ['users'], queryFn: usersApi.list });

  const updateRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => usersApi.update(id, { role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
    onError: (e: any) => setError(e.message || 'Failed to update role'),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => usersApi.update(id, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
    onError: (e: any) => setError(e.message || 'Failed to update user'),
  });

  const resetPwd = useMutation({
    mutationFn: ({ id, pwd }: { id: string; pwd: string }) => usersApi.resetPassword(id, pwd),
    onSuccess: () => { setResetId(null); setNewPwd(''); },
    onError: (e: any) => setError(e.message || 'Failed to reset password'),
  });

  return (
    <div className="space-y-4 max-w-4xl">
      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
      <div className="flex justify-end">
        <button onClick={() => setShowForm(true)} className="btn-primary">+ Invite User</button>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? <div className="p-8 text-center text-gray-500">Loading...</div> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-600">User</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Role</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">MFA</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Last Login</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(users as any[]).map((u: any) => (
                <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{u.email}</div>
                    {u.employee && <div className="text-xs text-gray-400">{u.employee.firstName} {u.employee.lastName} · {u.employee.designation}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      className="text-xs border border-gray-200 rounded px-2 py-1 bg-white"
                      value={u.role}
                      onChange={e => updateRole.mutate({ id: u.id, role: e.target.value })}
                    >
                      {ROLES.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    {u.mfaEnabled
                      ? <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Enabled</span>
                      : <span className="text-xs text-gray-400">Off</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('en-IN') : 'Never'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleActive.mutate({ id: u.id, isActive: !u.isActive })}
                      className={`text-xs px-2 py-0.5 rounded font-medium ${u.isActive ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
                    >
                      {u.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => setResetId(u.id)} className="text-xs text-brand-600 hover:underline">Reset pwd</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Reset password inline */}
      {resetId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="font-semibold mb-4">Reset Password</h3>
            {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
            <input type="password" className="input mb-3" placeholder="New password (min 8 chars)" value={newPwd} onChange={e => setNewPwd(e.target.value)} />
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setResetId(null); setNewPwd(''); setError(''); }} className="btn-secondary">Cancel</button>
              <button onClick={() => resetPwd.mutate({ id: resetId, pwd: newPwd })} disabled={newPwd.length < 8 || resetPwd.isPending} className="btn-primary">
                {resetPwd.isPending ? 'Resetting...' : 'Reset'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <InviteUserModal
          onClose={() => setShowForm(false)}
          onSuccess={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ['users'] }); }}
        />
      )}
    </div>
  );
}

function InviteUserModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ email: '', password: '', role: 'EMPLOYEE' });
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (data: any) => usersApi.create(data),
    onSuccess,
    onError: (e: any) => setError(e.message || 'Failed to create user'),
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Invite User</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input type="email" className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="user@company.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Temporary Password *</label>
            <input type="password" className="input" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Min 8 characters" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
            <select className="input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              {ROLES.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-3 justify-end mt-5">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={() => mutation.mutate(form)} disabled={mutation.isPending || !form.email || form.password.length < 8} className="btn-primary">
            {mutation.isPending ? 'Creating...' : 'Create User'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Security Tab ──────────────────────────────────────────────
function SecurityTab() {
  const user = useAuthStore(s => s.user);
  const setAuth = useAuthStore(s => s.setAuth);
  const token = useAuthStore(s => s.token);

  const [pwdForm, setPwdForm] = useState({ oldPassword: '', newPassword: '', confirm: '' });
  const [pwdMsg, setPwdMsg] = useState('');
  const [pwdErr, setPwdErr] = useState('');

  const [mfaStep, setMfaStep] = useState<'idle' | 'setup' | 'backup'>('idle');
  const [qrData, setQrData] = useState('');
  const [secret, setSecret] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [disablePwd, setDisablePwd] = useState('');
  const [mfaErr, setMfaErr] = useState('');
  const [mfaMsg, setMfaMsg] = useState('');

  const changePwd = useMutation({
    mutationFn: () => authApi.changePassword(pwdForm.oldPassword, pwdForm.newPassword),
    onSuccess: () => { setPwdMsg('Password changed successfully.'); setPwdForm({ oldPassword: '', newPassword: '', confirm: '' }); setTimeout(() => setPwdMsg(''), 4000); },
    onError: (e: any) => setPwdErr(e.message || 'Failed to change password'),
  });

  const setupMfa = useMutation({
    mutationFn: () => authApi.setupMfa(),
    onSuccess: (data: any) => { setQrData(data.qrDataUrl); setSecret(data.secret); setMfaStep('setup'); setMfaErr(''); },
    onError: (e: any) => setMfaErr(e.message || 'Setup failed'),
  });

  const enableMfa = useMutation({
    mutationFn: () => authApi.enableMfa(totpCode),
    onSuccess: (data: any) => { setBackupCodes(data.backupCodes); setMfaStep('backup'); setTotpCode(''); setMfaErr(''); },
    onError: (e: any) => setMfaErr(e.message || 'Invalid code'),
  });

  const disableMfa = useMutation({
    mutationFn: () => authApi.disableMfa(disablePwd),
    onSuccess: () => { setMfaMsg('MFA disabled.'); setDisablePwd(''); if (user && token) setAuth({ ...user, mfaEnabled: false }, token); setTimeout(() => setMfaMsg(''), 4000); },
    onError: (e: any) => setMfaErr(e.message || 'Failed to disable MFA'),
  });

  const mfaEnabled = user?.mfaEnabled;

  return (
    <div className="space-y-6 max-w-lg">
      {/* Change password */}
      <div className="card p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Change Password</h3>
        {pwdMsg && <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">{pwdMsg}</div>}
        {pwdErr && <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{pwdErr}</div>}
        <div className="space-y-3">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
            <input type="password" className="input" value={pwdForm.oldPassword} onChange={e => setPwdForm(f => ({ ...f, oldPassword: e.target.value }))} />
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input type="password" className="input" value={pwdForm.newPassword} onChange={e => setPwdForm(f => ({ ...f, newPassword: e.target.value }))} />
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <input type="password" className="input" value={pwdForm.confirm} onChange={e => setPwdForm(f => ({ ...f, confirm: e.target.value }))} />
          </div>
          <button
            onClick={() => { setPwdErr(''); if (pwdForm.newPassword !== pwdForm.confirm) { setPwdErr('Passwords do not match'); return; } changePwd.mutate(); }}
            disabled={changePwd.isPending || !pwdForm.oldPassword || pwdForm.newPassword.length < 8}
            className="btn-primary"
          >
            {changePwd.isPending ? 'Saving...' : 'Change Password'}
          </button>
        </div>
      </div>

      {/* MFA */}
      <div className="card p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-900">Two-Factor Authentication</h3>
            <p className="text-sm text-gray-500 mt-0.5">Use an authenticator app (Google Authenticator, Authy) for extra security.</p>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${mfaEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {mfaEnabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>

        {mfaMsg && <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">{mfaMsg}</div>}
        {mfaErr && <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{mfaErr}</div>}

        {/* Step: idle, MFA off → show enable button */}
        {!mfaEnabled && mfaStep === 'idle' && (
          <button onClick={() => setupMfa.mutate()} disabled={setupMfa.isPending} className="btn-primary">
            {setupMfa.isPending ? 'Generating...' : 'Set up MFA'}
          </button>
        )}

        {/* Step: show QR code */}
        {mfaStep === 'setup' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Scan this QR code with your authenticator app, then enter the 6-digit code to confirm.</p>
            {qrData && <img src={qrData} alt="MFA QR Code" className="w-48 h-48 border border-gray-200 rounded-lg" />}
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Or enter this secret manually:</p>
              <code className="text-xs font-mono text-gray-800 break-all">{secret}</code>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Enter verification code</label>
              <input className="input font-mono text-center text-xl tracking-widest max-w-[160px]"
                value={totpCode} onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000" maxLength={6} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setMfaStep('idle'); setQrData(''); setTotpCode(''); }} className="btn-secondary">Cancel</button>
              <button onClick={() => enableMfa.mutate()} disabled={totpCode.length < 6 || enableMfa.isPending} className="btn-primary">
                {enableMfa.isPending ? 'Verifying...' : 'Enable MFA'}
              </button>
            </div>
          </div>
        )}

        {/* Step: show backup codes */}
        {mfaStep === 'backup' && (
          <div className="space-y-4">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-sm font-semibold text-amber-800 mb-2">Save your backup codes</p>
              <p className="text-xs text-amber-700 mb-3">These codes can be used if you lose access to your authenticator app. Each code can only be used once.</p>
              <div className="grid grid-cols-2 gap-1">
                {backupCodes.map((c, i) => <code key={i} className="text-sm font-mono bg-white border border-amber-200 rounded px-2 py-1 text-center">{c}</code>)}
              </div>
            </div>
            <button onClick={() => { setMfaStep('idle'); setBackupCodes([]); setMfaMsg('MFA is now enabled.'); if (user && token) setAuth({ ...user, mfaEnabled: true }, token); }} className="btn-primary">
              I have saved my backup codes
            </button>
          </div>
        )}

        {/* MFA enabled → disable option */}
        {mfaEnabled && mfaStep === 'idle' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">MFA is active on your account. To disable it, enter your current password.</p>
            <div className="flex gap-3">
              <input type="password" className="input max-w-[200px]" placeholder="Current password" value={disablePwd} onChange={e => setDisablePwd(e.target.value)} />
              <button onClick={() => disableMfa.mutate()} disabled={!disablePwd || disableMfa.isPending} className="btn-secondary text-red-600 border-red-200 hover:bg-red-50">
                {disableMfa.isPending ? 'Disabling...' : 'Disable MFA'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Audit Log Tab ─────────────────────────────────────────────
const ACTION_COLORS: Record<string, string> = {
  LOGIN:   'bg-blue-100 text-blue-700',
  CREATE:  'bg-green-100 text-green-700',
  UPDATE:  'bg-yellow-100 text-yellow-700',
  DELETE:  'bg-red-100 text-red-700',
  APPROVE: 'bg-purple-100 text-purple-700',
  EXPORT:  'bg-gray-100 text-gray-700',
};

function AuditTab() {
  const [filters, setFilters] = useState({ action: '', entity: '', from: '', to: '', page: 1 });

  const { data, isLoading } = useQuery({
    queryKey: ['audit', filters],
    queryFn: () => auditApi.list({ ...filters, page: filters.page, limit: 50 }),
  });

  const result = data as any;
  const logs: any[] = result?.data || [];

  const setF = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFilters(f => ({ ...f, [k]: e.target.value, page: 1 }));

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Action</label>
            <select className="input text-sm" value={filters.action} onChange={setF('action')}>
              <option value="">All actions</option>
              {['LOGIN','CREATE','UPDATE','DELETE','APPROVE','EXPORT'].map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Entity</label>
            <select className="input text-sm" value={filters.entity} onChange={setF('entity')}>
              <option value="">All entities</option>
              {['User','Employee','Payrun','Payslip','Branch','Company','SalaryStructure'].map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
            <input type="date" className="input text-sm" value={filters.from} onChange={setF('from')} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
            <input type="date" className="input text-sm" value={filters.to} onChange={setF('to')} />
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? <div className="p-8 text-center text-gray-500">Loading audit logs...</div> : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-600 w-36">Time</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">User</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">Action</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Entity</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Summary</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log: any) => (
                  <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-400 text-xs whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="text-gray-900 text-xs">{log.user?.email}</div>
                      <div className="text-gray-400 text-xs">{log.user?.role?.replace('_',' ')}</div>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-600'}`}>{log.action}</span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 text-xs">{log.entity}</td>
                    <td className="px-4 py-2.5 text-gray-700 text-xs max-w-xs truncate">{log.summary || '—'}</td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400">No audit logs found.</td></tr>
                )}
              </tbody>
            </table>

            {/* Pagination */}
            {result?.pages > 1 && (
              <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm">
                <span className="text-gray-500">Page {result.page} of {result.pages} · {result.total} entries</span>
                <div className="flex gap-2">
                  <button onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))} disabled={result.page <= 1} className="btn-secondary text-xs py-1 px-3">Prev</button>
                  <button onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))} disabled={result.page >= result.pages} className="btn-secondary text-xs py-1 px-3">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function DepartmentsTab() {
  const qc = useQueryClient();
  const { data: departments = [], isLoading } = useQuery({ queryKey: ['departments'], queryFn: departmentsApi.list });
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<any>({ name: '', code: '', type: 'DEPARTMENT', parentId: '' });
  const [error, setError] = useState('');

  const create = useMutation({
    mutationFn: () => departmentsApi.create({
      name: form.name,
      code: form.code,
      type: form.type,
      parentId: form.parentId || null
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['departments'] });
      setAdding(false);
      setForm({ name: '', code: '', type: 'DEPARTMENT', parentId: '' });
      setError('');
    },
    onError: (e: any) => setError(e.message || 'Failed to add department'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => departmentsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['departments'] }),
    onError: (e: any) => setError(e.message || 'Failed to delete department'),
  });

  const set = (k: string) => (e: any) => setForm((f: any) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="card p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Departments & Teams</h3>
        <button onClick={() => setAdding(a => !a)} className="btn-secondary text-sm py-1.5">{adding ? 'Cancel' : '+ Add Department'}</button>
      </div>
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

      {adding && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg grid grid-cols-2 gap-3 text-sm">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
            <input className="input" value={form.name} onChange={set('name')} placeholder="Engineering" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Code *</label>
            <input className="input uppercase" value={form.code} onChange={set('code')} placeholder="ENG" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Type *</label>
            <select className="input" value={form.type} onChange={set('type')}>
              <option value="DEPARTMENT">Department</option>
              <option value="TEAM">Team</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Parent Department (optional)</label>
            <select className="input" value={form.parentId} onChange={set('parentId')}>
              <option value="">None</option>
              {(departments as any[]).filter((d: any) => d.type === 'DEPARTMENT').map((d: any) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2 flex justify-end">
            <button onClick={() => create.mutate()} disabled={create.isPending || !form.name || !form.code} className="btn-primary text-sm">
              {create.isPending ? 'Adding...' : 'Add'}
            </button>
          </div>
        </div>
      )}

      {isLoading ? <div className="text-gray-500 text-sm">Loading...</div> : (
        <div className="space-y-2">
          {(departments as any[]).map((d: any) => (
            <div key={d.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <div>
                <div className="text-sm font-medium text-gray-900">
                  {d.name}{' '}
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ml-1.5 ${d.type === 'TEAM' ? 'bg-teal-50 text-teal-700 border border-teal-200' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'}`}>
                    {d.type}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  Code: {d.code} {d.parentId ? `· Parent ID: ${d.parentId}` : ''} · {d._count?.employees ?? 0} employees
                </div>
              </div>
              <button onClick={() => remove.mutate(d.id)} className="text-red-600 hover:text-red-800 text-xs font-medium">Delete</button>
            </div>
          ))}
          {(departments as any[]).length === 0 && <div className="text-gray-500 text-sm">No departments yet.</div>}
        </div>
      )}
    </div>
  );
}
