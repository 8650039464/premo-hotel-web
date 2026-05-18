'use client';

/* ═══════════════════════════════════════════════════════════════════════
   SHARED PAYOUT REQUEST PANEL
   ----------------------------------------------------------------------
   Single component that powers the payout request + history view on
   hotel-admin/earnings, sales/payouts, and developer/payouts pages.

   Pieces:
   1. Wallet summary — Available / In-Payout / Total
   2. Amount input + "Request Payout" button (validates min threshold)
   3. History table — past requests with status badges + transaction refs

   Why split from PayoutDetailsForm?
   - Account page typically shows just the saved bank/UPI details.
   - Earnings/Payouts page shows balance + request action + history.
   - Separating concerns means each page can mix & match (some portals
     show both, others may want only history).
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react';
import { payoutApi } from '@/lib/api';
import { Spinner } from './ui';

type Kind = 'hotel' | 'sales' | 'developer';

type PayoutRow = {
  _id: string;
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  bank_snapshot: { method: 'upi' | 'bank'; upi_id?: string; account_number?: string };
  transaction_ref?: string;
  failure_reason?: string;
  requested_at: string;
  processed_at?: string | null;
};

type HistoryResponse = {
  wallet_balance:   number;
  wallet_in_payout: number;
  min_payout:       number;
  requests:         PayoutRow[];
};

export default function PayoutRequestPanel({ kind }: { kind: Kind }) {
  const [data, setData]         = useState<HistoryResponse | null>(null);
  const [loading, setLoading]   = useState(true);
  const [amount, setAmount]     = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg]           = useState<{ ok: boolean; text: string } | null>(null);

  async function load() {
    setLoading(true);
    const { ok, data } = await payoutApi.history(kind, 25);
    if (ok) setData(data);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [kind]);

  function toast(text: string, ok: boolean) {
    setMsg({ ok, text });
    setTimeout(() => setMsg(null), 6000);
  }

  async function request() {
    if (!data) return;
    const amt = Number(amount);
    if (!amt || amt <= 0)               return toast('Sahi amount daalo', false);
    if (amt < data.min_payout)          return toast(`Minimum payout ₹${data.min_payout}`, false);
    if (amt > data.wallet_balance)      return toast(`Insufficient — wallet balance ₹${data.wallet_balance}`, false);

    setSubmitting(true);
    // Idempotency key prevents double-submit on rapid clicks (Razorpay charge).
    const idempotency_key = `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const { ok, data: res } = await payoutApi.request(kind, amt, idempotency_key);
    setSubmitting(false);

    if (ok) {
      toast(res?.message || 'Payout requested — processing', true);
      setAmount('');
      load();
    } else {
      toast(res?.error || 'Request failed', false);
    }
  }

  if (loading) return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;
  if (!data) return <div className="text-red-600 text-sm">Couldn't load payout history.</div>;

  const available = data.wallet_balance;
  const inPayout  = data.wallet_in_payout;
  const total     = available + inPayout;

  return (
    <div className="space-y-6">
      {msg && (
        <div className={`rounded-xl px-4 py-3 text-sm font-semibold ${
          msg.ok ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {msg.ok ? '✅' : '⚠️'} {msg.text}
        </div>
      )}

      {/* Wallet summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Stat label="Available" value={available} accent="emerald" />
        <Stat label="In Payout" value={inPayout}  accent="amber"   sub="processing" />
        <Stat label="Total"     value={total}     accent="indigo"  sub="lifetime balance" />
      </div>

      {/* Request form */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-bold text-lg mb-1">💸 Request Payout</h2>
        <p className="text-sm text-gray-500 mb-4">
          Minimum ₹{data.min_payout.toLocaleString('en-IN')}. Razorpay automatically aapke saved
          UPI/bank pe transfer karega. 1-2 hr me reflect hoga (UPI me instant).
        </p>

        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Amount (₹)</label>
            <input
              type="number"
              min={data.min_payout}
              max={available}
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder={`Max ₹${available.toLocaleString('en-IN')}`}
              className="input-field"
            />
            <div className="flex gap-2 mt-2">
              {[500, 1000, 5000].filter(v => v <= available && v >= data.min_payout).map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAmount(String(v))}
                  className="px-3 py-1 text-xs font-bold rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
                >
                  ₹{v}
                </button>
              ))}
              {available >= data.min_payout && (
                <button
                  type="button"
                  onClick={() => setAmount(String(available))}
                  className="px-3 py-1 text-xs font-bold rounded-lg bg-primary/20 hover:bg-primary/30 text-gray-800"
                >
                  Max ₹{available}
                </button>
              )}
            </div>
          </div>
          <div className="md:self-end">
            <button
              onClick={request}
              disabled={submitting || available < data.min_payout}
              className="btn-primary px-6 py-2.5 flex items-center gap-2 disabled:opacity-50"
            >
              {submitting ? <Spinner size="sm" /> : '💸'}
              {submitting ? 'Requesting...' : 'Request Payout'}
            </button>
          </div>
        </div>
      </div>

      {/* History */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-bold text-lg mb-4">📜 Past Payouts</h2>
        {data.requests.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-6">No payouts yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-gray-500 border-b border-gray-100">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Amount</th>
                  <th className="py-2 pr-3">Method</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2">Reference</th>
                </tr>
              </thead>
              <tbody>
                {data.requests.map(r => (
                  <tr key={r._id} className="border-b border-gray-50 last:border-0">
                    <td className="py-3 pr-3 text-gray-700">
                      {new Date(r.requested_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      <div className="text-[10px] text-gray-400">
                        {new Date(r.requested_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="py-3 pr-3 font-bold text-gray-900">₹{r.amount.toLocaleString('en-IN')}</td>
                    <td className="py-3 pr-3 text-gray-700">
                      {r.bank_snapshot.method === 'upi'
                        ? <span title={r.bank_snapshot.upi_id}>UPI</span>
                        : <span title={r.bank_snapshot.account_number}>Bank ••{r.bank_snapshot.account_number?.slice(-4)}</span>}
                    </td>
                    <td className="py-3 pr-3">
                      <StatusBadge status={r.status} />
                      {r.status === 'failed' && r.failure_reason && (
                        <div className="text-[10px] text-red-600 mt-1 max-w-[200px] truncate" title={r.failure_reason}>
                          {r.failure_reason}
                        </div>
                      )}
                    </td>
                    <td className="py-3 text-xs text-gray-500 font-mono">
                      {r.transaction_ref || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, accent, sub }: {
  label: string; value: number; accent: 'emerald' | 'amber' | 'indigo'; sub?: string;
}) {
  const colors = {
    emerald: 'from-emerald-50 to-emerald-100 border-emerald-200 text-emerald-900',
    amber:   'from-amber-50   to-amber-100   border-amber-200   text-amber-900',
    indigo:  'from-indigo-50  to-indigo-100  border-indigo-200  text-indigo-900',
  }[accent];
  return (
    <div className={`bg-gradient-to-br ${colors} border rounded-2xl p-4`}>
      <p className="text-xs font-bold uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-3xl font-black mt-1">₹{value.toLocaleString('en-IN')}</p>
      {sub && <p className="text-[11px] mt-1 opacity-60">{sub}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: PayoutRow['status'] }) {
  const cfg: Record<PayoutRow['status'], { bg: string; text: string; label: string }> = {
    pending:    { bg: 'bg-gray-100',     text: 'text-gray-700',     label: 'Pending'    },
    processing: { bg: 'bg-amber-100',    text: 'text-amber-700',    label: 'Processing' },
    completed:  { bg: 'bg-emerald-100',  text: 'text-emerald-700',  label: '✓ Done'     },
    failed:     { bg: 'bg-red-100',      text: 'text-red-700',      label: 'Failed'     },
    cancelled:  { bg: 'bg-gray-100',     text: 'text-gray-500',     label: 'Cancelled'  },
  };
  const c = cfg[status];
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}
