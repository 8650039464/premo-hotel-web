'use client';
import { useEffect, useState } from 'react';
import { salesApi, formatDate } from '@/lib/api';
import { Spinner, EmptyState, StatusBadge, toast, ConfirmDialog } from '@/components/shared/ui';

interface Earning {
  _id:        string;
  hotel_name: string;
  amount:     number;
  status:     'pending' | 'credited' | 'cancelled';
  credited_at?: string;
  createdAt:  string;
  notes?:     string;
}

export default function EarningsPage() {
  const [list, setList] = useState<Earning[]>([]);
  const [summary, setSummary] = useState({ total_credited: 0, total_pending: 0 });
  const [walletBalance, setWalletBalance] = useState(0);
  const [minPayout, setMinPayout] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // payout
  const [payoutAmount, setPayoutAmount] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [payoutLoading, setPayoutLoading] = useState(false);

  async function loadAll() {
    setLoading(true);
    const [earnRes, profRes] = await Promise.all([salesApi.earnings(), salesApi.profile()]);
    if (earnRes.ok) {
      const d = earnRes.data || {};
      setList(Array.isArray(d.earnings) ? d.earnings : []);
      setSummary(d.summary || { total_credited: 0, total_pending: 0 });
    } else {
      setError(earnRes.data?.error || 'Failed to load earnings');
    }
    if (profRes.ok) {
      setWalletBalance(profRes.data?.profile?.wallet_amount || 0);
      setMinPayout(profRes.data?.policy?.min_payout || 0);
    }
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  async function handlePayout() {
    const amt = Number(payoutAmount);
    setShowConfirm(false);
    if (!amt || amt <= 0) { toast('Enter a valid amount', 'error'); return; }
    setPayoutLoading(true);
    const { ok, data } = await salesApi.requestPayout(amt);
    setPayoutLoading(false);
    if (ok) {
      toast(data?.message || 'Payout requested', 'success');
      setPayoutAmount('');
      loadAll();
    } else {
      toast(data?.error || 'Payout failed', 'error');
    }
  }

  if (loading) return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;

  const canRequestPayout = walletBalance >= minPayout && minPayout > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Earnings & Payouts</h1>
        <p className="text-gray-500 text-sm mt-1">Track your commission and request withdrawals.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">{error}</div>
      )}

      {/* Summary tiles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="inline-block px-2 py-0.5 text-xs font-bold rounded-md bg-green-50 text-green-700">Wallet (Available)</div>
          <div className="text-3xl font-black text-gray-900 mt-2">₹{walletBalance.toLocaleString('en-IN')}</div>
        </div>
        <div className="card">
          <div className="inline-block px-2 py-0.5 text-xs font-bold rounded-md bg-orange-50 text-orange-700">Pending Approval</div>
          <div className="text-3xl font-black text-gray-900 mt-2">₹{summary.total_pending.toLocaleString('en-IN')}</div>
        </div>
        <div className="card">
          <div className="inline-block px-2 py-0.5 text-xs font-bold rounded-md bg-blue-50 text-blue-700">Lifetime Credited</div>
          <div className="text-3xl font-black text-gray-900 mt-2">₹{summary.total_credited.toLocaleString('en-IN')}</div>
        </div>
      </div>

      {/* Payout request */}
      <div className="card">
        <h2 className="font-bold text-gray-900 mb-2">💸 Request Payout</h2>
        <p className="text-sm text-gray-500 mb-4">
          Minimum payout: <strong>₹{minPayout.toLocaleString('en-IN')}</strong>. Processing takes 2–3 business days.
        </p>
        <div className="flex gap-3 flex-wrap">
          <input
            type="number"
            placeholder={`Amount (max ₹${walletBalance.toLocaleString('en-IN')})`}
            className="input-field flex-1 min-w-[200px]"
            value={payoutAmount}
            onChange={e => setPayoutAmount(e.target.value)}
            min={minPayout}
            max={walletBalance}
          />
          <button
            onClick={() => setShowConfirm(true)}
            disabled={!canRequestPayout || payoutLoading || !payoutAmount}
            className="btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            {payoutLoading ? <Spinner size="sm" /> : null}
            Request Payout
          </button>
        </div>
        {!canRequestPayout && walletBalance < minPayout && (
          <p className="text-xs text-orange-600 mt-2">
            ⚠️ You need at least ₹{minPayout.toLocaleString('en-IN')} in your wallet to request a payout.
          </p>
        )}
      </div>

      {/* Earnings list */}
      <div>
        <h2 className="font-bold text-gray-900 mb-3">Earning History</h2>
        {list.length === 0 ? (
          <EmptyState icon="💰" title="No earnings yet" desc="Register hotels to start earning commission" />
        ) : (
          <div className="grid gap-2">
            {list.map(e => (
              <div key={e._id} className="card flex items-center justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900 truncate">{e.hotel_name}</h3>
                    <StatusBadge status={e.status} />
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Registered: {formatDate(e.createdAt)}
                    {e.credited_at && ` · Credited: ${formatDate(e.credited_at)}`}
                  </div>
                  {e.notes && <div className="text-xs text-gray-400 mt-0.5">{e.notes}</div>}
                </div>
                <div className={`text-xl font-black ${
                  e.status === 'credited'  ? 'text-green-600'  :
                  e.status === 'pending'   ? 'text-orange-600' :
                                             'text-gray-400 line-through'
                }`}>
                  ₹{e.amount.toLocaleString('en-IN')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showConfirm && (
        <ConfirmDialog
          title="Confirm Payout Request"
          message={`Request ₹${Number(payoutAmount).toLocaleString('en-IN')} to be transferred to your registered bank account?`}
          onConfirm={handlePayout}
          onCancel={() => setShowConfirm(false)}
          confirmText="Request"
          confirmClass="btn-primary"
        />
      )}
    </div>
  );
}
