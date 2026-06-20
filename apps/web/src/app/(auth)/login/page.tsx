'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore(s => s.setAuth);

  const [form, setForm] = useState({ email: '', password: '' });
  const [mfaStep, setMfaStep] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [totp, setTotp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res: any = await authApi.login(form.email, form.password);
      if (res.mfaRequired) {
        setTempToken(res.tempToken);
        setMfaStep(true);
      } else {
        setAuth(res.user, res.accessToken);
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res: any = await authApi.loginMfa(tempToken, totp.replace(/\s/g, ''));
      setAuth(res.user, res.accessToken);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-900 via-brand-700 to-brand-500 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-4">
            <span className="text-3xl font-bold text-brand-600">S</span>
          </div>
          <h1 className="text-3xl font-bold text-white">Saarlekha Payroll</h1>
          <p className="text-brand-200 mt-1">India-first payroll management</p>
        </div>

        <div className="card p-8">
          {!mfaStep ? (
            <>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Sign in to your account</h2>
              {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" className="input" value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="you@company.com" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input type="password" className="input" value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="••••••••" required />
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 mt-2">
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>
              <p className="text-center text-sm text-gray-600 mt-6">
                New company?{' '}
                <Link href="/register" className="text-brand-600 font-medium hover:underline">Register here</Link>
              </p>
            </>
          ) : (
            <>
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-brand-100 rounded-xl mb-3">
                  <span className="text-2xl">🔐</span>
                </div>
                <h2 className="text-xl font-semibold text-gray-900">Two-Factor Authentication</h2>
                <p className="text-gray-500 text-sm mt-1">Enter the 6-digit code from your authenticator app</p>
              </div>
              {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
              <form onSubmit={handleMfa} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Authentication Code</label>
                  <input
                    className="input text-center text-2xl font-mono tracking-widest"
                    value={totp}
                    onChange={e => setTotp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    autoFocus
                    required
                  />
                  <p className="text-xs text-gray-400 mt-1 text-center">Or enter an 8-character backup code</p>
                </div>
                <button type="submit" disabled={loading || totp.length < 6} className="btn-primary w-full py-2.5">
                  {loading ? 'Verifying...' : 'Verify'}
                </button>
                <button type="button" onClick={() => { setMfaStep(false); setTotp(''); setError(''); }}
                  className="w-full text-sm text-gray-500 hover:text-gray-700 text-center mt-1">
                  ← Back to login
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-brand-200 text-xs mt-6">
          Demo: admin@demo.com / password123
        </p>
      </div>
    </div>
  );
}
