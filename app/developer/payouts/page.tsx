'use client';
import { useEffect, useState } from 'react';
import { getDevAuth, devApi } from '@/lib/api';
import { Spinner } from '@/components/shared/ui';

export default function DeveloperPayoutsPage() {
  const [wallet, setWallet] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState('');

  async function loadBalance() {
    const auth = getDevAuth();
    if (!auth) return;
    try {
      const { ok, data } = await devApi.me(auth.token);
      if (ok) setWallet(data.wallet_balance ?? 0);
      else setError(data.error || 'Failed to load');
    } catch { setError('Connection error'); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadBalance(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSuccess('');
    const amt = Number(amount);
    if (!amt || amt <= 0 || isNaN(amt)) { setError('Enter a valid amount'); return; }
    if (wallet !== null && amt > wallet) { setError('Insufficient wallet balance'); return; }

    const auth = getDevAuth();
    if (!auth) return;
    setSubmitting(true);
    try {
      const { ok, data } = await devApi.requestPayout(auth.token, amt);
      if (ok) {
        setSuccess(data.message || 'Payout request submitted');
        setWallet(data.remaining_wallet ?? 0);
        setAmount('');
      } else setError(data.error || 'Request failed');
    } catch { setError('Connection error'); }
    finally { setSubmitting(false); }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>;

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-black text-gray-900">💸 Request Payout</h1>
        <p className="text-gray-500 text-sm mt-1">
          Apne wallet se bank payout request karo. Processing time 2-3 business days.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="mb-6">
          <div className="text-sm text-gray-500 mb-1">Current Wallet Balance</div>
          <div className="text-3xl font-black text-emerald-700">₹{(wallet ?? 0).toLocaleString('en-IN')}</div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Amount (₹)</label>
            <input type="number" min={1} max={wallet ?? undefined} step={1}
              value={amount} onChange={e => setAmount(e.target.value)} required
              placeholder="Enter amount" className="input-field" />
          </div>

          {error   && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">{error}</div>}
          {success && <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-emerald-700 text-sm">{success}</div>}

          <button type="submit" disabled={submitting || !wallet} className="btn-primary w-full flex items-center justify-center gap-2">
            {submitting ? <Spinner size="sm" /> : null}
            {submitting ? 'Submitting...' : 'REQUEST PAYOUT'}
          </button>
        </form>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
        <b>Note:</b> Sirf aapka markup amount (hotel price pe aapne jo extra lagaya hai) withdraw hota hai.
        Premo ka platform commission aur hotel ka share alag track hote hain aur woh hotel ke checkout flow se settle hote hain.
      </div>
    </div>
  );
}
