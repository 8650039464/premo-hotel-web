'use client';
import { useState } from 'react';
import { API_ROOT, API_TOKEN, saveAuth, googleLogin } from '@/lib/api';
import Link from 'next/link';
import { Spinner } from './ui';
import GoogleLoginButton from './GoogleLoginButton';

interface LoginFormProps {
  role: string;
  onSuccess: (data: { token: string; auth: Record<string, string> }) => void;
  allowedRoles: string[];
  title: string;
  subtitle: string;
  icon: string;
  registerLink?: string;
  registerText?: string;
  forgotLink?: string;
  /**
   * Backend `/p/api/auth/login` accepts an optional `role` field — same email
   * can exist under multiple roles (user/hotel/sales) so passing the role
   * disambiguates which account to authenticate. If omitted, backend defaults
   * to 'user'. Pass this for non-user portals (sales, hotel, etc.).
   */
  loginRole?: string;
  /**
   * Show Google sign-in option. Pass the role you want Google to register/auth
   * the user as — must be 'user' | 'hotel' | 'sales'. Super-admin should NOT
   * pass this; supreme login is email+password only.
   */
  googleRole?: 'user' | 'hotel' | 'sales';
}

const ROLE_LABEL: Record<string, string> = {
  user: 'Customer', hotel: 'Hotel Admin', admin: 'Super Admin', sales: 'Sales Agent',
};

export default function LoginForm({ role, onSuccess, allowedRoles, title, subtitle, icon, registerLink, registerText, forgotLink, loginRole, googleRole }: LoginFormProps) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [showPass, setShowPass] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  // Google credential handler — same flow as email login on success
  async function handleGoogle(idToken: string) {
    if (!googleRole) return;
    setError(''); setGoogleBusy(true);
    try {
      const { ok, status, data } = await googleLogin(idToken, googleRole);
      if (ok) {
        const userRole = data.auth?.role;
        if (!allowedRoles.includes(userRole)) {
          const expected = allowedRoles.map(r => ROLE_LABEL[r] || r).join(' or ');
          const got      = ROLE_LABEL[userRole] || userRole;
          setError(`Wrong portal! You are a "${got}". This portal is for "${expected}".`);
          return;
        }
        saveAuth(data.token, userRole, {
          id: data.auth.id || data.auth._id || '',
          name: data.auth.name || '', email: data.auth.email || '', role: userRole,
        });
        onSuccess(data);
      } else if (status === 403) {
        if (data.message === 'pending')        setError(data.detail || 'Your account is under admin review. Please wait for approval.');
        else if (data.message === 'rejected')  setError('Your account has been rejected. Contact support.');
        else                                   setError(data.detail || data.error || 'Access denied.');
      } else {
        setError(data.error || data.message || 'Google login failed.');
      }
    } catch {
      setError('Google login failed. Try again.');
    } finally {
      setGoogleBusy(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch(`${API_ROOT}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-token': API_TOKEN },
        body: JSON.stringify({ email, password, ...(loginRole ? { role: loginRole } : {}) }),
      });
      const data = await res.json();
      if (res.ok) {
        const userRole = data.auth?.role;
        if (!allowedRoles.includes(userRole)) {
          const expected = allowedRoles.map(r => ROLE_LABEL[r] || r).join(' or ');
          const got      = ROLE_LABEL[userRole] || userRole;
          setError(`Wrong portal! You are a "${got}". This portal is for "${expected}".`);
          setLoading(false); return;
        }
        saveAuth(data.token, userRole, {
          id: data.auth.id || data.auth._id || '',
          name: data.auth.name || '', email: data.auth.email || '', role: userRole,
        });
        onSuccess(data);
      } else if (res.status === 403) {
        if (data.message === 'pending')  setError('Your account is under admin review. Please wait for approval.');
        else if (data.message === 'rejected') setError('Your account has been rejected. Contact support.');
        else setError(data.detail || 'Access denied.');
      } else {
        setError(data.message || 'Login failed. Check your email and password.');
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-50 to-white p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary rounded-2xl mb-4 text-4xl shadow-md">{icon}</div>
          <h1 className="text-3xl font-black text-gray-900">{title}</h1>
          <p className="text-gray-500 mt-1">{subtitle}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email Address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                placeholder="your@email.com" className="input-field" />
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
            {forgotLink && (
              <div className="text-right">
                <Link href={forgotLink} className="text-sm text-gray-400 hover:text-gray-600">Forgot Password?</Link>
              </div>
            )}
            {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">{error}</div>}
            <button type="submit" disabled={loading || googleBusy} className="btn-primary w-full flex items-center justify-center gap-2">
              {loading ? <Spinner size="sm" /> : null}
              {loading ? 'Logging in...' : 'LOGIN'}
            </button>
          </form>

          {googleRole && (
            <>
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
            </>
          )}

          {registerLink && registerText && (
            <p className="text-center text-sm text-gray-500 mt-6">
              Don't have an account?{' '}
              <Link href={registerLink} className="text-primary font-bold hover:underline">{registerText}</Link>
            </p>
          )}
          <div className="text-center mt-4">
            <Link href="/" className="text-xs text-gray-400 hover:text-gray-600">← Back to home</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
