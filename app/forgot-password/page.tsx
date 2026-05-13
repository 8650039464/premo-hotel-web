'use client';

/* ═══════════════════════════════════════════════════════════════════════
   FORGOT PASSWORD — shared OTP-based reset flow
   ----------------------------------------------------------------------
   Works for user / hotel-admin / sales accounts (they all live in the
   same Auth collection on the backend, identified by role).

   Two-step flow:
     1. POST /p/api/otp/send  { identifier, type:'email', purpose:'forgot_password' }
     2. POST /p/api/auth/forgot-password { identifier, type, otp, new_password }

   After step 2 succeeds we redirect them to the login route they came
   from (read ?role= query if present, default /user/login).
   ═══════════════════════════════════════════════════════════════════════ */

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { API_ROOT, API_TOKEN } from '@/lib/api';

function ForgotPasswordInner() {
  const router = useRouter();
  const params = useSearchParams();
  const role = (params.get('role') || 'user').toLowerCase();

  const [step, setStep] = useState<1 | 2>(1);
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp]               = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');

  // OTP cooldown so they can't spam send button
  const [cooldown, setCooldown] = useState(0);

  function loginPathForRole(r: string): string {
    switch (r) {
      case 'hotel': return '/hotel-admin/login';
      case 'sales': return '/sales/login';
      case 'developer': return '/developer/login';
      default: return '/user/login';
    }
  }

  function startCooldown() {
    setCooldown(45);
    const id = setInterval(() => {
      setCooldown(c => {
        if (c <= 1) { clearInterval(id); return 0; }
        return c - 1;
      });
    }, 1000);
  }

  async function sendOtp() {
    setError(''); setSuccess('');
    const clean = identifier.trim().toLowerCase();
    if (!clean) { setError('Email zaroori hai'); return; }
    // Basic email check — we lock to email for now (phone reset can be added later if backend supports SMS to that identifier)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      setError('Sahi email daalo (e.g. you@example.com)');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_ROOT}/api/otp/send`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-token': API_TOKEN },
        body:    JSON.stringify({ identifier: clean, type: 'email', purpose: 'forgot_password' }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSuccess('OTP aapke email pe bhej diya. Check inbox (and spam folder).');
        setStep(2);
        startCooldown();
      } else {
        setError(data?.error || 'OTP send failed');
      }
    } catch {
      setError('Network error — internet check karo');
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword() {
    setError(''); setSuccess('');
    if (!otp || otp.length < 4) { setError('OTP daalo'); return; }
    if (newPassword.length < 6) { setError('Naya password kam-se-kam 6 character ka hona chahiye'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords match nahi kar rahe'); return; }

    setLoading(true);
    try {
      const res = await fetch(`${API_ROOT}/api/auth/forgot-password`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-token': API_TOKEN },
        body:    JSON.stringify({
          identifier:   identifier.trim().toLowerCase(),
          type:         'email',
          otp:          otp.trim(),
          new_password: newPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSuccess('Password reset ho gaya! 2 second mein login page khulega...');
        setTimeout(() => router.replace(loginPathForRole(role)), 2000);
      } else {
        setError(data?.error || 'Reset failed');
      }
    } catch {
      setError('Network error — internet check karo');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-10">
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 w-full max-w-md p-7">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🔐</div>
          <h1 className="text-2xl font-black text-gray-900">Password Reset</h1>
          <p className="text-sm text-gray-500 mt-1">
            {step === 1
              ? 'Apna registered email daalo — OTP bhej denge'
              : `OTP aaya hai ${identifier} pe. 6-digit code aur naya password daalo.`}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-red-600 text-sm mb-4">
            ⚠️ {error}
          </div>
        )}
        {success && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2 text-emerald-700 text-sm mb-4">
            ✅ {success}
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={e => { e.preventDefault(); sendOtp(); }} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                placeholder="you@example.com"
                className="input-field"
                autoFocus
                required
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Sending OTP...' : 'Send OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={e => { e.preventDefault(); resetPassword(); }} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">OTP</label>
              <input
                inputMode="numeric"
                pattern="\d*"
                maxLength={6}
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-digit code"
                className="input-field tracking-widest text-center font-mono text-lg"
                autoFocus
                required
              />
              <div className="flex items-center justify-between mt-2">
                <button
                  type="button"
                  onClick={() => { if (cooldown === 0) sendOtp(); }}
                  disabled={cooldown > 0 || loading}
                  className="text-sm text-blue-600 hover:underline disabled:text-gray-400 disabled:no-underline"
                >
                  {cooldown > 0 ? `Resend OTP in ${cooldown}s` : 'Resend OTP'}
                </button>
                <button
                  type="button"
                  onClick={() => { setStep(1); setOtp(''); setError(''); setSuccess(''); }}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Change email
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">New Password</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="input-field pr-12"
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700"
                >
                  {showPwd ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Confirm Password</label>
              <input
                type={showPwd ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Re-enter new password"
                className="input-field"
                required
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        )}

        <div className="text-center mt-5 text-sm text-gray-500">
          Login yaad aa gaya? {' '}
          <Link href={loginPathForRole(role)} className="text-blue-600 font-semibold hover:underline">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>}>
      <ForgotPasswordInner />
    </Suspense>
  );
}
