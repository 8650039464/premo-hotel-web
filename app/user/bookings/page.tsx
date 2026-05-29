'use client';
import { useState, useEffect, useCallback } from 'react';
import { getAuth, API_ROOT, API_TOKEN, formatDT, getCancellationPolicy, cancelBooking } from '@/lib/api';
import { Spinner, EmptyState, StatusBadge } from '@/components/shared/ui';

export default function UserBookingsPage() {
  const auth = getAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState<'active' | 'past'>('active');
  const [cancelling, setCancelling] = useState<string | null>(null);

  // Cancellation policy modal
  const [policyModal, setPolicyModal]   = useState<any>(null);
  const [policyLoading, setPolicyLoading] = useState(false);

  const headers = {
    'Content-Type': 'application/json',
    'x-api-token': API_TOKEN,
    Authorization: `Bearer ${auth?.token}`,
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_ROOT}/api/bookings/my`, { headers });
      const data = await res.json();
      setBookings(Array.isArray(data) ? data : []);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Step 1: fetch policy, show modal
  async function showCancelModal(bookingId: string) {
    setPolicyLoading(true);
    const { ok, data } = await getCancellationPolicy(auth!.token, bookingId);
    setPolicyLoading(false);
    if (!ok) { alert(data.error || 'Cannot cancel this booking'); return; }
    setPolicyModal({ ...data, bookingId });
  }

  // Step 2: confirm cancel
  async function confirmCancel() {
    if (!policyModal) return;
    setCancelling(policyModal.bookingId);
    setPolicyModal(null);
    const { ok, data } = await cancelBooking(auth!.token, policyModal.bookingId);
    setCancelling(null);
    if (ok) {
      const msg = data.refund_amount > 0
        ? `Booking cancelled. ₹${data.refund_amount} added to your wallet!`
        : 'Booking cancelled. No refund as per policy.';
      alert(msg);
      load();
    } else {
      alert(data.error || 'Cancellation failed');
    }
  }

  const active    = bookings.filter(b => b.status === 'booked' || b.status === 'checked_in');
  const past      = bookings.filter(b => b.status === 'checked_out' || b.status === 'cancelled');
  const displayed = tab === 'active' ? active : past;

  // Policy color
  function policyColor(pct: number) {
    if (pct === 100) return { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700' };
    if (pct === 50)  return { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' };
    return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' };
  }

  // Live policy label based on check-in time
  function livePolicyLabel(checkIn?: string) {
    if (!checkIn) return null;
    const hrs = (new Date(checkIn).getTime() - Date.now()) / 3600000;
    if (hrs < 0)  return null;
    if (hrs >= 24) return { label: 'Full Refund if cancelled', color: 'text-green-600' };
    if (hrs >= 12) return { label: '50% Refund if cancelled',  color: 'text-orange-600' };
    return           { label: 'No Refund if cancelled',   color: 'text-red-600' };
  }

  return (
    <div>
      <h1 className="text-2xl font-black text-gray-900 mb-6">📋 My Bookings</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(['active', 'past'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-xl font-bold text-sm capitalize transition-all ${tab === t ? 'bg-primary text-black' : 'bg-white border border-gray-200 text-gray-600'}`}>
            {t} ({t === 'active' ? active.length : past.length})
          </button>
        ))}
        <button onClick={load} className="ml-auto px-4 py-2 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-xl">
          ↻ Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : displayed.length === 0 ? (
        <EmptyState icon="📭" title={`No ${tab} bookings`}
          desc={tab === 'active' ? 'Book a hotel to see it here!' : 'Your completed bookings appear here'} />
      ) : (
        <div className="space-y-4">
          {displayed.map(b => {
            const hotel    = b.hotel_id?.name || 'Hotel';
            const city     = b.hotel_id?.city?.name || b.hotel_id?.city || '';
            const room     = b.room_id ? `Room ${b.room_id.room_number}` : '';
            const roomType = b.room_id?.type || '';
            const policy   = livePolicyLabel(b.check_in);
            const walletUsed    = b.wallet_amount_used || 0;
            const cancelPolicy  = b.cancellation_policy;
            const refundAmt     = b.refund_amount;

            return (
              <div key={b._id} className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">{hotel}</h3>
                    {city && <p className="text-gray-500 text-sm">📍 {city}</p>}
                    {room && <p className="text-gray-600 text-sm mt-0.5">{room}{roomType ? ` · ${roomType.toUpperCase()}` : ''}</p>}
                    {walletUsed > 0 && (
                      <p className="text-xs text-primary font-semibold mt-0.5">
                        💳 ₹{walletUsed} paid via wallet
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-primary">₹{b.display_amount ?? b.charged_amount ?? b.total_price}</p>
                    <StatusBadge status={b.status} />
                  </div>
                </div>

                {/* Times */}
                <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center gap-4 text-sm mb-3">
                  <div>
                    <p className="text-xs text-gray-400 font-semibold">CHECK-IN</p>
                    <p className="font-bold">{formatDT(b.check_in)}</p>
                  </div>
                  <div className="text-gray-300 text-lg">→</div>
                  <div>
                    <p className="text-xs text-gray-400 font-semibold">CHECK-OUT</p>
                    <p className="font-bold">{formatDT(b.check_out)}</p>
                  </div>
                </div>

                {/* Check-in OTP */}
                {b.status === 'booked' && b.checkin_otp && (
                  <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 mb-3">
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">🔐 Check-in OTP</p>
                    <p className="text-4xl font-black tracking-[0.4em] text-gray-900">{b.checkin_otp}</p>
                    <p className="text-xs text-gray-500 mt-1">Show this to hotel staff at check-in</p>
                  </div>
                )}

                {/* Cancelled — refund info */}
                {b.status === 'cancelled' && cancelPolicy && (
                  <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-3 flex items-center gap-2 text-sm">
                    <span>🚫</span>
                    <span className="font-medium text-red-700">
                      {cancelPolicy}{refundAmt > 0 ? ` — ₹${refundAmt} refunded to wallet` : ' — No refund'}
                    </span>
                  </div>
                )}

                {/* Live policy badge */}
                {b.status === 'booked' && policy && (
                  <p className={`text-xs font-semibold ${policy.color} mb-2`}>
                    📋 {policy.label}
                  </p>
                )}

                {/* Cancel button */}
                {tab === 'active' && b.status === 'booked' && (
                  <button
                    onClick={() => showCancelModal(b._id)}
                    disabled={cancelling === b._id || policyLoading}
                    className="w-full border border-red-300 text-red-600 py-2.5 rounded-xl font-bold text-sm hover:bg-red-50 transition-colors flex items-center justify-center gap-2">
                    {cancelling === b._id || policyLoading
                      ? <Spinner size="sm" />
                      : '✕ Cancel Booking'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Cancellation Policy Modal */}
      {policyModal && (() => {
        const c = policyColor(policyModal.refund_percent);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Cancellation Policy</h3>

              {/* Policy badge */}
              <div className={`${c.bg} border ${c.border} rounded-xl p-4 text-center mb-4`}>
                <p className={`text-lg font-black ${c.text}`}>{policyModal.label}</p>
                <p className="text-sm text-gray-500 mt-1">{policyModal.description}</p>
              </div>

              {/* Amount breakdown */}
              <div className="space-y-2 mb-5">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total Paid</span>
                  <span className="font-bold">₹{policyModal.total_paid}</span>
                </div>
                <hr />
                {policyModal.deduction > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Cancellation Charge</span>
                    <span className="font-bold text-red-600">- ₹{policyModal.deduction}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="font-bold">You will get back</span>
                  <span className={`font-black text-lg ${policyModal.refund_amount > 0 ? 'text-green-600' : 'text-red-500'}`}>
                    ₹{policyModal.refund_amount}
                  </span>
                </div>
                {policyModal.refund_amount > 0 && (
                  <p className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
                    💳 Refund will be credited to your wallet instantly.
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <button onClick={() => setPolicyModal(null)}
                  className="flex-1 border border-gray-200 rounded-xl py-2.5 font-semibold text-gray-600 hover:bg-gray-50">
                  Keep Booking
                </button>
                <button onClick={confirmCancel}
                  className="flex-1 bg-red-500 text-white rounded-xl py-2.5 font-bold hover:bg-red-600">
                  Yes, Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
