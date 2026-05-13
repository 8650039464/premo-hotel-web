'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { API_ROOT, API_TOKEN } from '@/lib/api';
import { Spinner } from '@/components/shared/ui';

export default function UserRegisterPage() {
  const router = useRouter();
  const [form, setForm]           = useState({ name: '', email: '', phone: '', password: '' });
  const [phoneOtp, setPhoneOtp]   = useState('');
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [phoneOtpSent, setPhoneOtpSent]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');

  const headers = { 'Content-Type': 'application/json', 'x-api-token': API_TOKEN };

  function startCountdown() {
    setCountdown(30);
    const t = setInterval(() => {
      setCountdown(p => { if (p <= 1) { clearInterval(t); return 0; } return p - 1; });
    }, 1000);
  }

  async function sendOtp() {
    if (form.phone.length < 10) { setError('Enter a valid phone number'); return; }
    setOtpLoading(true); setError('');
    try {
      const res = await fetch(`${API_ROOT}/api/otp/send`, {
        method: 'POST', headers,
        body: JSON.stringify({ identifier: form.phone, type: 'phone', purpose: 'register' }),
      });
      if (res.ok) { setPhoneOtpSent(true); setSuccess('OTP sent to your phone!'); startCountdown(); }
      else { const d = await res.json(); setError(d.error || 'Failed to send OTP'); }
    } catch { setError('Connection error'); }
    finally { setOtpLoading(false); }
  }

  async function verifyOtp() {
    if (phoneOtp.length !== 6) { setError('Enter the 6-digit OTP'); return; }
    setOtpLoading(true); setError('');
    try {
      const res = await fetch(`${API_ROOT}/api/otp/verify`, {
        method: 'POST', headers,
        body: JSON.stringify({ identifier: form.phone, type: 'phone', purpose: 'register', otp: phoneOtp }),
      });
      if (res.ok) { setPhoneVerified(true); setSuccess('Phone verified! ✅'); }
      else { const d = await res.json(); setError(d.error || 'Incorrect OTP'); }
    } catch { setError('Connection error'); }
    finally { setOtpLoading(false); }
  }

  async function register(e: React.FormEvent) {
    e.preventDefault();
    if (!phoneVerified) { setError('Please verify your phone number first'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API_ROOT}/api/auth/register`, {
        method: 'POST', headers,
        body: JSON.stringify({ ...form, role: 'user' }),
      });
      if (res.status === 201) {
        setSuccess('Account created! Please login.');
        setTimeout(() => router.replace('/user/login'), 1500);
      } else {
        const d = await res.json(); setError(d.error || 'Registration failed');
      }
    } catch { setError('Connection error'); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-50 to-white p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary rounded-2xl mb-4 text-4xl shadow-md">🏨</div>
          <h1 className="text-3xl font-black text-gray-900">Create Account</h1>
          <p className="text-gray-500 mt-1">Join PREMO and start booking</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <form onSubmit={register} className="space-y-4">
            <input className="input-field" placeholder="Full Name *" required value={form.name}
              onChange={e => setForm({...form, name: e.target.value})} />
            <input className="input-field" type="email" placeholder="Email (optional)" value={form.email}
              onChange={e => setForm({...form, email: e.target.value})} />

            {/* Phone + OTP */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <input className="input-field flex-1" type="tel" placeholder="Phone Number *" required
                  value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
                  disabled={phoneVerified} />
                <button type="button" onClick={sendOtp}
                  disabled={otpLoading || phoneVerified || countdown > 0}
                  className="px-4 py-2 bg-primary text-black font-bold rounded-xl whitespace-nowrap disabled:opacity-50">
                  {otpLoading ? <Spinner size="sm" /> : phoneVerified ? '✅' : countdown > 0 ? `${countdown}s` : 'Send OTP'}
                </button>
              </div>
              {phoneOtpSent && !phoneVerified && (
                <div className="flex gap-2">
                  <input className="input-field flex-1" placeholder="6-digit OTP" maxLength={6}
                    value={phoneOtp} onChange={e => setPhoneOtp(e.target.value)} />
                  <button type="button" onClick={verifyOtp} disabled={otpLoading}
                    className="px-4 py-2 bg-green-600 text-white font-bold rounded-xl">
                    {otpLoading ? <Spinner size="sm" /> : 'Verify'}
                  </button>
                </div>
              )}
            </div>

            <input className="input-field" type="password" placeholder="Password (min 6 characters)" required minLength={6}
              value={form.password} onChange={e => setForm({...form, password: e.target.value})} />

            {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">{error}</div>}
            {success && <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-green-600 text-sm">{success}</div>}

            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
              {loading ? <Spinner size="sm" /> : null}
              {loading ? 'Creating account...' : 'REGISTER'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-4">
            Already have an account?{' '}
            <Link href="/user/login" className="text-primary font-bold hover:underline">Login</Link>
          </p>
          <div className="text-center mt-2">
            <Link href="/" className="text-xs text-gray-400 hover:text-gray-600">← Back to home</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
