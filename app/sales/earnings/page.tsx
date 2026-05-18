'use client';

/* ═══════════════════════════════════════════════════════════════════════
   SALES → EARNINGS & PAYOUTS
   ----------------------------------------------------------------------
   Sales agent's view has TWO distinct concerns:

   1. Per-hotel earnings list (existing) — what they've earned by
      onboarding hotels. Includes pending/credited/cancelled states. This
      is unique to sales (hotel + dev see booking-level earnings, sales
      sees per-hotel registration earnings).

   2. Payout details + request + history — handled by shared components
      identical across all three portals.

   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react';
import { salesApi, formatDate } from '@/lib/api';
import { Spinner, EmptyState, StatusBadge } from '@/components/shared/ui';
import PayoutDetailsForm  from '@/components/shared/PayoutDetailsForm';
import PayoutRequestPanel from '@/components/shared/PayoutRequestPanel';

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { ok, data } = await salesApi.earnings();
      if (ok) {
        const d = data || {};
        setList(Array.isArray(d.earnings) ? d.earnings : []);
        setSummary(d.summary || { total_credited: 0, total_pending: 0 });
      }
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900">💰 Earnings & Payouts</h1>
        <p className="text-gray-500 text-sm mt-1">
          Hotel onboarding pe earnings credit hote hain super-admin approval ke baad.
          UPI/Bank pe payout RazorpayX se automatic transfer hota hai.
        </p>
      </div>

      {/* Per-hotel earnings summary tiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <div className="inline-block px-2 py-0.5 text-xs font-bold rounded-md bg-orange-50 text-orange-700">Pending Approval</div>
          <div className="text-3xl font-black text-gray-900 mt-2">₹{summary.total_pending.toLocaleString('en-IN')}</div>
        </div>
        <div className="card">
          <div className="inline-block px-2 py-0.5 text-xs font-bold rounded-md bg-blue-50 text-blue-700">Lifetime Credited</div>
          <div className="text-3xl font-black text-gray-900 mt-2">₹{summary.total_credited.toLocaleString('en-IN')}</div>
        </div>
      </div>

      {/* Payout details (shared) */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-bold text-lg mb-4">🏦 Payout Details</h2>
        <PayoutDetailsForm kind="sales" />
      </div>

      {/* Payout request + history (shared) */}
      <PayoutRequestPanel kind="sales" />

      {/* Per-hotel earnings list */}
      <div>
        <h2 className="font-bold text-gray-900 mb-3">Per-Hotel Earnings</h2>
        {loading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : list.length === 0 ? (
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
    </div>
  );
}
