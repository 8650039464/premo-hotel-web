'use client';

/* ═══════════════════════════════════════════════════════════════════════
   DEVELOPER → PAYOUTS
   ----------------------------------------------------------------------
   Replaces the legacy "request payout" form with the unified RazorpayX
   flow used across hotel + sales + developer. Wallet credit happens on
   booking settlement in p_PaymentController.checkoutBooking; this page
   only handles withdrawal-side concerns.
   ═══════════════════════════════════════════════════════════════════════ */

import PayoutDetailsForm  from '@/components/shared/PayoutDetailsForm';
import PayoutRequestPanel from '@/components/shared/PayoutRequestPanel';

export default function DeveloperPayoutsPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-black text-gray-900">💸 Payouts</h1>
        <p className="text-sm text-gray-500 mt-1">
          Booking checkout hone par aapki markup earnings wallet me credit hoti hai.
          Yahan se RazorpayX ke through automatic UPI/bank pe withdraw kar sakte ho.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-bold text-lg mb-4">🏦 Payout Details</h2>
        <PayoutDetailsForm kind="developer" />
      </div>

      <PayoutRequestPanel kind="developer" />
    </div>
  );
}
