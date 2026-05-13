'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getDevAuth, devApi } from '@/lib/api';
import { Spinner } from '@/components/shared/ui';

interface DevProfile {
  id: string; name: string; email: string; app_name: string;
  firm_id: string; api_key: string;
  markup_percent: number; wallet_balance: number; total_earned: number;
  status: string;
}

interface EarningsSummary {
  total_markup_earned: number; settled: number; pending: number; wallet_balance: number;
}

export default function DeveloperDashboard() {
  const [profile, setProfile] = useState<DevProfile | null>(null);
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [copied, setCopied]   = useState(false);

  useEffect(() => {
    const auth = getDevAuth();
    if (!auth) return;

    (async () => {
      try {
        const [me, ern] = await Promise.all([
          devApi.me(auth.token),
          devApi.earnings(auth.token, 1),
        ]);
        if (me.ok)  setProfile(me.data);
        if (ern.ok) setSummary(ern.data.summary);
        if (!me.ok) setError(me.data.error || 'Failed to load profile');
      } catch { setError('Connection error'); }
      finally { setLoading(false); }
    })();
  }, []);

  async function copyKey() {
    if (!profile) return;
    try {
      await navigator.clipboard.writeText(profile.api_key);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard not available */ }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>;
  if (error)   return <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600">{error}</div>;
  if (!profile) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Welcome, {profile.name} 👋</h1>
        <p className="text-gray-500 text-sm mt-1">
          {profile.app_name || 'Your App'} · Firm ID <span className="font-mono">{profile.firm_id}</span>
        </p>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Wallet Balance"  value={`₹${(profile.wallet_balance ?? 0).toLocaleString('en-IN')}`} accent="bg-emerald-50 border-emerald-200 text-emerald-700" />
        <StatCard label="Total Earned"    value={`₹${(profile.total_earned   ?? 0).toLocaleString('en-IN')}`} accent="bg-indigo-50 border-indigo-200 text-indigo-700" />
        <StatCard label="Pending Markup"  value={`₹${(summary?.pending       ?? 0).toLocaleString('en-IN')}`} accent="bg-amber-50 border-amber-200 text-amber-700" />
        <StatCard label="Your Markup %"   value={`${profile.markup_percent}%`}                              accent="bg-rose-50 border-rose-200 text-rose-700" />
      </div>

      {/* API key card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-bold text-lg mb-3">🔑 Your API Key</h2>
        <p className="text-sm text-gray-500 mb-3">
          Is key ko apne app ke <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">X-Dev-Key</code> header mein bhejo.
          Aapki markup is booking pe calculate hogi. Key leak ho jaaye to Settings se regenerate karo.
        </p>
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          <code className="flex-1 text-sm font-mono truncate">{profile.api_key}</code>
          <button onClick={copyKey} className="px-3 py-1.5 text-xs font-bold bg-primary text-black rounded-lg hover:brightness-95">
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/developer/earnings" className="bg-white border border-gray-100 rounded-2xl p-5 hover:shadow-md transition">
          <div className="text-2xl mb-1">💰</div>
          <div className="font-bold">View Earnings</div>
          <div className="text-sm text-gray-500">Booking-wise markup revenue</div>
        </Link>
        <Link href="/developer/payouts" className="bg-white border border-gray-100 rounded-2xl p-5 hover:shadow-md transition">
          <div className="text-2xl mb-1">💸</div>
          <div className="font-bold">Request Payout</div>
          <div className="text-sm text-gray-500">Withdraw from wallet</div>
        </Link>
        <Link href="/developer/settings" className="bg-white border border-gray-100 rounded-2xl p-5 hover:shadow-md transition">
          <div className="text-2xl mb-1">⚙️</div>
          <div className="font-bold">Settings</div>
          <div className="text-sm text-gray-500">Markup %, profile, API key</div>
        </Link>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
        💡 <b>Status:</b> {profile.status}. Har booking jo aapke app se hogi (X-Dev-Key header ke saath),
        uska markup aapke wallet mein credit hoga hotel checkout ke time par.
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className={`rounded-2xl border p-5 ${accent}`}>
      <div className="text-xs font-semibold opacity-70 mb-1">{label}</div>
      <div className="text-2xl font-black">{value}</div>
    </div>
  );
}
