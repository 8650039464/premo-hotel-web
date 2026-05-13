'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { devRegister } from '@/lib/api';
import { Spinner } from '@/components/shared/ui';

export default function DeveloperRegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '', email: '', phone: '', company: '', website: '',
    app_name: '', password: '', confirm: '', markup_percent: '0',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');

  function setField(k: keyof typeof form, v: string) {
    setForm(f => ({ ...f, [k]: v }));
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSuccess('');
    if (form.password !== form.confirm) {
      setError('Passwords do not match'); return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters'); return;
    }
    const markup = Number(form.markup_percent);
    if (isNaN(markup) || markup < 0 || markup > 100) {
      setError('Markup must be between 0 and 100'); return;
    }

    setLoading(true);
    try {
      const payload = { ...form, markup_percent: markup };
      delete (payload as Record<string, unknown>).confirm;
      const { ok, data } = await devRegister(payload);
      if (ok) {
        setSuccess(`Registration received! Your firm ID is ${data.firm_id}. Super admin approval ke baad login kar sakte ho.`);
        setTimeout(() => router.replace('/developer/login'), 4000);
      } else {
        setError(data.error || 'Registration failed');
      }
    } catch { setError('Connection error. Check your internet.'); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-white p-4 py-10">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-2xl mb-3 text-3xl shadow-md">🧪</div>
          <h1 className="text-2xl font-black text-gray-900">Developer Registration</h1>
          <p className="text-gray-500 mt-1 text-sm">Build your own white-label hotel booking app on Premo</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <form onSubmit={handleRegister} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name *</label>
              <input value={form.name} onChange={e => setField('name', e.target.value)} required className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Email *</label>
              <input type="email" value={form.email} onChange={e => setField('email', e.target.value)} required className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Phone</label>
              <input value={form.phone} onChange={e => setField('phone', e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Company</label>
              <input value={form.company} onChange={e => setField('company', e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Website</label>
              <input value={form.website} onChange={e => setField('website', e.target.value)} placeholder="https://…" className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">App Name</label>
              <input value={form.app_name} onChange={e => setField('app_name', e.target.value)} placeholder="MyBookings" className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Markup % (0–100)</label>
              <input type="number" min={0} max={100} step={0.1}
                value={form.markup_percent} onChange={e => setField('markup_percent', e.target.value)} className="input-field" />
              <p className="text-xs text-gray-400 mt-1">Extra % charge aap user se lenge (base price pe top-up).</p>
            </div>
            <div></div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Password * (min 8)</label>
              <input type="password" value={form.password} onChange={e => setField('password', e.target.value)} required className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Confirm Password *</label>
              <input type="password" value={form.confirm} onChange={e => setField('confirm', e.target.value)} required className="input-field" />
            </div>

            {error   && <div className="md:col-span-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">{error}</div>}
            {success && <div className="md:col-span-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-emerald-700 text-sm">{success}</div>}

            <div className="md:col-span-2 flex gap-3">
              <button type="submit" disabled={loading} className="btn-primary flex-1 flex items-center justify-center gap-2">
                {loading ? <Spinner size="sm" /> : null}
                {loading ? 'Submitting...' : 'REGISTER'}
              </button>
              <Link href="/developer/login" className="px-6 py-3 border-2 border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50 text-center">
                Already registered?
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
