'use client';

/* ═══════════════════════════════════════════════════════════════════════
   HOTEL-ADMIN → EARNINGS & PAYOUTS
   ----------------------------------------------------------------------
   Two-section layout:
     1. Payout Details (UPI/Bank) — shared `PayoutDetailsForm`
     2. Wallet balance + Request Payout + History — shared `PayoutRequestPanel`

   Backed by unified /p/api/payouts/hotel/* endpoints which deduct atomically
   from Hotel.wallet_balance and trigger RazorpayX. Wallet credit lifecycle
   lives in the existing `checkoutBooking` flow — money only enters the
   wallet after a booking is settled, never on booking creation.
   ═══════════════════════════════════════════════════════════════════════ */

import PayoutDetailsForm  from '@/components/shared/PayoutDetailsForm';
import PayoutRequestPanel from '@/components/shared/PayoutRequestPanel';

export default function HotelAdminEarningsPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-black text-gray-900">💰 Earnings & Payouts</h1>
        <p className="text-sm text-gray-500 mt-1">
          Booking checkout hone ke baad earnings wallet me credit hote hain. RazorpayX
          se UPI ya bank pe payout request karo — humara markup aapke earnings se kabhi
          deduct nahi hota.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-bold text-lg mb-4">🏦 Payout Details</h2>
        <PayoutDetailsForm kind="hotel" />
      </div>

      <PayoutRequestPanel kind="hotel" />
    </div>
  );
}
