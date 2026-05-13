'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { devLogin, devGoogleLogin, saveDevAuth } from '@/lib/api';
import { Spinner } from '@/components/shared/ui';
import GoogleLoginButton from '@/components/shared/GoogleLoginButton';

export default function DeveloperLoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [showPass, setShowPass] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const { ok, status, data } = await devLogin(email, password);
      if (ok) {
        saveDevAuth(data.token, data.developer);
        router.replace('/developer');
      } else if (status === 403) {
        if (data.message === 'pending')  setError('Your developer account is under review. Please wait for super admin approval.');
        else if (data.message === 'suspended') setError('Your account has been suspended. Contact support.');
        else setError(data.error || data.detail || 'Access denied.');
      } else {
        setError(data.error || 'Login failed. Check your credentials.');
      }
    } catch (err) {
      const msg = (err as Error)?.message?.toLowerCase() || '';
      if (msg.includes('failed to fetch') || msg.includes('networkerror')) {
        setError('Server wake up ho raha hai (free tier). 30-60 sec ruk kar retry karo.');
      } else {
        setError('Connection error. Check your internet.');
      }
    }
    finally { setLoading(false); }
  }

  // Google credential → POST /api/developers/google → save dev auth
  async function handleGoogle(idToken: string) {
    setError(''); setGoogleBusy(true);
    try {
      const { ok, status, data } = await devGoogleLogin(idToken);
      if (ok) {
        saveDevAuth(data.token, data.developer);
        router.replace('/developer');
      } else if (status === 403) {
        if (data.message === 'pending')        setError(data.detail || 'Your developer account is under review. Please wait for super admin approval.');
        else if (data.message === 'suspended') setError('Your account has been suspended. Contact support.');
        else                                   setError(data.error || data.detail || 'Access denied.');
      } else {
        setError(data.error || 'Google login failed.');
      }
    } catch {
      setError('Google login failed. Try again.');
    } finally {
      setGoogleBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-white p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary rounded-2xl mb-4 text-4xl shadow-md">🧪</div>
          <h1 className="text-3xl font-black text-gray-900">Developer Portal</h1>
          <p className="text-gray-500 mt-1">White-label partner dashboard</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email Address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                placeholder="developer@company.com" className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)} required placeholder="••••••••" className="input-field pr-12" />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">{error}</div>}
            <button type="submit" disabled={loading || googleBusy} className="btn-primary w-full flex items-center justify-center gap-2">
              {loading ? <Spinner size="sm" /> : null}
              {loading ? 'Logging in...' : 'LOGIN'}
            </button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs uppercase tracking-wider text-gray-400 font-semibold">OR</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
          <div className="flex justify-center">
            <GoogleLoginButton
              onCredential={handleGoogle}
              onError={(m) => setError(m)}
              busy={googleBusy || loading}
              text="continue_with"
            />
          </div>

          <p className="text-center text-sm text-gray-500 mt-6">
            Don&apos;t have a developer account?{' '}
            <Link href="/developer/register" className="text-primary font-bold hover:underline">Register as developer</Link>
          </p>
          <div className="text-center mt-4">
            <Link href="/" className="text-xs text-gray-400 hover:text-gray-600">← Back to home</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
