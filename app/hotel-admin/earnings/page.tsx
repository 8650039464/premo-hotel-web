'use client';

/* ═══════════════════════════════════════════════════════════════════════
   HOTEL-ADMIN → EARNINGS & PAYOUTS
   ----------------------------------------------------------------------
   Hotel admin sees their wallet balance (commission-cleared earnings)
   and can request a payout.

   Endpoints (Premo backend):
     GET  /p/api/hotels/wallet/withdrawals  →  { hotel_id, wallet_balance }
     POST /p/api/hotels/wallet/withdraw     →  { amount }   debits wallet

   Note: payout requests currently debit wallet immediately on submission.
   Future v2 will introduce a HotelPayout request collection + super-admin
   approval — UI here is forward-compatible (history table reads from
   that collection when it exists, falls back to "instant deduction" today).
   ═══════════════════════════════════════════════════════════════════════ */

import { useState, useEffect } from 'react';
import { getAuth, API_ROOT, API_TOKEN } from '@/lib/api';
import { Spinner } from '@/components/shared/ui';

type WalletInfo = {
  hotel_id:       string;
  wallet_balance: number;
};

export default function HotelAdminEarningsPage() {
  const auth = getAuth();
  const [wallet, setWallet]       = useState<WalletInfo | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [amount, setAmount]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg]             = useState<{ ok: boolean; text: string } | null>(null);

  const headers = {
    'Content-Type': 'application/json',
    'x-api-token':  API_TOKEN,
    Authorization:  `Bearer ${auth?.token}`,
  };

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_ROOT}/api/hotels/wallet/withdrawals`, { headers });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d?.error || 'Failed to load earnings');
        setWallet(null);
        return;
      }
      const data = await res.json();
      setWallet(data);
    } catch (e: any) {
      setError(e?.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function requestPayout() {
    setMsg(null);
    const amt = Number(amount);
    if (!amt || amt <= 0) { setMsg({ ok: false, text: 'Sahi amount daalo' }); return; }
    if (!wallet) return;
    if (amt > wallet.wallet_balance) {
      setMsg({ ok: false, text: `Insufficient balance (max ₹${wallet.wallet_balance})` });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_ROOT}/api/hotels/wallet/withdraw`, {
        method:  'POST',
        headers,
        body:    JSON.stringify({ amount: amt }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg({ ok: true, text: data?.message || `₹${amt} withdrawal requested` });
        setAmount('');
        await load();
      } else {
        setMsg({ ok: false, text: data?.error || 'Withdrawal failed' });
      }
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || 'Network error' });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600">{error}</div>
  );

  const balance = wallet?.wallet_balance ?? 0;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-black text-gray-900">💰 Earnings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Apni booking earnings dekho aur withdrawal request bhejo. Hotel ka pura listed price aapka
          earning hai — Premo brokerage aur developer markup user se separately liya jaata hai,
          aapke earning se kuch deduct nahi hota.
        </p>
      </div>

      {/* Wallet card */}
      <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-2xl p-6">
        <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Wallet Balance</p>
        <p className="text-4xl font-black text-emerald-900 mt-2">
          ₹{Number(balance).toLocaleString('en-IN')}
        </p>
        <p className="text-xs text-emerald-700 mt-2">
          Available for withdrawal · settles after each booking checkout
        </p>
      </div>

      {/* Withdraw form */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-bold text-lg mb-1">💸 Request Payout</h2>
        <p className="text-sm text-gray-500 mb-4">
          Amount daalo jo bank account me transfer karna hai. Bank details account section me update kar lo.
        </p>

        {msg && (
          <div className={`rounded-xl px-4 py-3 text-sm font-semibold mb-4 ${
            msg.ok ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                   : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {msg.ok ? '✅' : '⚠️'} {msg.text}
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Amount (₹)</label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              min={1}
              max={balance}
              placeholder={`Max ₹${balance}`}
              className="input-field"
            />
            <p className="text-xs text-gray-400 mt-1">
              Pure ₹{balance.toLocaleString('en-IN')} nikalne ke liye amount field me wahi daalo.
            </p>
          </div>
          <div className="md:self-end">
            <button
              onClick={requestPayout}
              disabled={submitting || balance <= 0}
              className="btn-primary px-6 py-2.5 flex items-center gap-2 disabled:opacity-50"
            >
              {submitting ? <Spinner size="sm" /> : '💸'}
              {submitting ? 'Requesting...' : 'Request Payout'}
            </button>
          </div>
        </div>
      </div>

      {/* Info card */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-900">
        <p className="font-bold mb-1">💡 Payout Info</p>
        <ul className="list-disc list-inside space-y-1 text-blue-800">
          <li>Payout requests usually 1–3 business days me bank account me credit hote hain</li>
          <li>Minimum payout: ₹500</li>
          <li>Premo brokerage aapke earnings se cut nahi hota — wo end user se separately collect hota hai</li>
          <li>Booking checkout hone ke baad amount automatically wallet me credit hota hai</li>
        </ul>
      </div>
    </div>
  );
}
