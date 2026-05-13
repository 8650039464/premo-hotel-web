'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supremeLogin, saveAuth } from '@/lib/api';
import { Spinner } from '@/components/shared/ui';

// ─────────────────────────────────────────────────────────────
//  SUPER ADMIN LOGIN
//  Regular /p/api/auth/login NAHI — dedicated /p/supreme/login.
//  Backend returns role='supreme', par hum client pe 'admin' save
//  karte hain existing UI guards compatibility ke liye.
// ─────────────────────────────────────────────────────────────

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [showPass, setShowPass] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const { ok, status, data } = await supremeLogin(email, password);
      if (ok && data?.token) {
        // Backend ne role='supreme' diya — client pe 'admin' save karo
        saveAuth(data.token, 'admin', {
          id:    data.admin?.email || '',
          name:  'Super Admin',
          email: data.admin?.email || email,
          role:  'admin',
        });
        router.replace('/super-admin');
      } else if (status === 401) {
        setError('Invalid credentials. Email ya password galat hai.');
      } else if (status === 500) {
        setError(data?.error || 'Server error. Admin credentials .env me check karo.');
      } else {
        setError(data?.error || data?.message || 'Login failed.');
      }
    } catch (err) {
      const msg = (err as Error)?.message?.toLowerCase() || '';
      if (msg.includes('failed to fetch') || msg.includes('networkerror')) {
        setError('Server wake up ho raha hai (free tier). 30-60 sec ruk kar retry karo.');
      } else {
        setError('Connection error. Check your internet.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-50 to-white p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary rounded-2xl mb-4 text-4xl shadow-md">⚡</div>
          <h1 className="text-3xl font-black text-gray-900">Super Admin</h1>
          <p className="text-gray-500 mt-1">Platform Management</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Admin Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="supreme@premo.com"
                className="input-field"
                autoComplete="username"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="input-field pr-12"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {loading ? <Spinner size="sm" /> : null}
              {loading ? 'Logging in...' : 'LOGIN'}
            </button>
          </form>

          <div className="text-center mt-6">
            <Link href="/" className="text-xs text-gray-400 hover:text-gray-600">← Back to home</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
