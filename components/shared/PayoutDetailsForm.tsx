'use client';

/* ═══════════════════════════════════════════════════════════════════════
   SHARED PAYOUT DETAILS FORM
   ----------------------------------------------------------------------
   One component used by hotel-admin, sales, and developer portals to
   collect bank/UPI details for RazorpayX automated payouts. Caller passes
   `kind` and the backend handles role-specific persistence.

   Why one component?
   - Same fields, same validation, same UX across all 3 portals.
   - Lower maintenance: bug fix in one place propagates everywhere.

   Form behavior:
   - Toggle UPI vs Bank Account (default UPI — faster, cheaper)
   - UPI requires only `upi_id` (vpa format like rajat@okhdfc)
   - Bank requires holder name + account number + IFSC
   - PAN optional (becomes mandatory at backend once annual payouts > ₹15K
     for TDS compliance — backend enforces, this UI shows hint)
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react';
import { payoutApi } from '@/lib/api';
import { Spinner } from './ui';

type Kind = 'hotel' | 'sales' | 'developer';

interface DetailsResponse {
  method: 'upi' | 'bank';
  upi_id: string;
  account_holder_name: string;
  account_number_masked: string;
  ifsc: string;
  bank_name: string;
  pan_masked: string;
  verified: boolean;
  updated_at: string | null;
  wallet_balance: number;
  wallet_in_payout: number;
  min_payout: number;
}

export default function PayoutDetailsForm({ kind }: { kind: Kind }) {
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [details, setDetails]   = useState<DetailsResponse | null>(null);
  const [editing, setEditing]   = useState(false);
  const [msg, setMsg]           = useState<{ ok: boolean; text: string } | null>(null);

  // Form state — independent of "details" so we can show masked values
  // when not editing and clear sensitive fields when entering edit mode.
  const [form, setForm] = useState({
    method:              'upi' as 'upi' | 'bank',
    upi_id:              '',
    account_holder_name: '',
    account_number:      '',
    ifsc:                '',
    bank_name:           '',
    pan:                 '',
  });

  async function load() {
    setLoading(true);
    const { ok, data } = await payoutApi.getDetails(kind);
    if (ok) {
      setDetails(data);
      setForm({
        method:              data.method || 'upi',
        upi_id:              data.upi_id || '',
        account_holder_name: data.account_holder_name || '',
        account_number:      '',                     // never preload — user re-enters when changing
        ifsc:                data.ifsc || '',
        bank_name:           data.bank_name || '',
        pan:                 '',
      });
    }
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [kind]);

  function toast(text: string, ok: boolean) {
    setMsg({ ok, text });
    setTimeout(() => setMsg(null), 5000);
  }

  async function save() {
    setMsg(null);
    // Client-side validation mirrors backend so user gets fast feedback.
    if (form.method === 'upi') {
      if (!/^[\w.\-]+@[\w]+$/.test(form.upi_id)) {
        return toast('Sahi UPI ID daalo (e.g. rajat@okhdfc)', false);
      }
    } else {
      if (!form.account_holder_name) return toast('Account holder name chahiye', false);
      if (!form.account_number || !/^\d{9,18}$/.test(form.account_number))
        return toast('Sahi account number daalo', false);
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifsc.toUpperCase()))
        return toast('Sahi IFSC code daalo (e.g. HDFC0001234)', false);
    }
    if (form.pan && !/^[A-Z]{5}\d{4}[A-Z]$/.test(form.pan.toUpperCase())) {
      return toast('Sahi PAN format daalo (e.g. ABCDE1234F)', false);
    }

    setSaving(true);
    const body: Record<string, string> = {
      method: form.method,
      pan:    form.pan.toUpperCase(),
    };
    if (form.method === 'upi') {
      body.upi_id = form.upi_id.toLowerCase();
    } else {
      body.account_holder_name = form.account_holder_name;
      body.account_number      = form.account_number;
      body.ifsc                = form.ifsc.toUpperCase();
      body.bank_name           = form.bank_name;
    }
    const { ok, data } = await payoutApi.saveDetails(kind, body);
    setSaving(false);
    if (ok) {
      toast('Details saved', true);
      setEditing(false);
      await load();
    } else {
      toast(data?.error || 'Save failed', false);
    }
  }

  if (loading) return <div className="flex justify-center py-8"><Spinner /></div>;
  if (!details) return <div className="text-red-600 text-sm">Could not load payout details.</div>;

  // Read-only view (default state) — shows masked values + Edit button
  if (!editing) {
    const hasDetails = !!(details.upi_id || details.account_number_masked);
    return (
      <div className="space-y-4">
        {msg && (
          <div className={`rounded-xl px-4 py-3 text-sm font-semibold ${
            msg.ok ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                  : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {msg.ok ? '✅' : '⚠️'} {msg.text}
          </div>
        )}

        {hasDetails ? (
          <div className="space-y-2 text-sm">
            <Row label="Method">{details.method === 'upi' ? '💳 UPI' : '🏦 Bank Transfer'}</Row>
            {details.method === 'upi'
              ? <Row label="UPI ID">{details.upi_id}</Row>
              : <>
                  <Row label="Account Holder">{details.account_holder_name}</Row>
                  <Row label="Account Number">{details.account_number_masked}</Row>
                  <Row label="IFSC">{details.ifsc}</Row>
                  {details.bank_name && <Row label="Bank">{details.bank_name}</Row>}
                </>
            }
            {details.pan_masked && <Row label="PAN">{details.pan_masked}</Row>}
            <Row label="Verified">
              {details.verified
                ? <span className="text-emerald-600 font-bold">✓ Verified</span>
                : <span className="text-amber-600 font-bold">⏳ Will verify on next payout</span>}
            </Row>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No payout details set yet. Add karke payout request kar paaoge.</p>
        )}

        <button
          onClick={() => setEditing(true)}
          className="btn-primary px-5 py-2"
        >
          {hasDetails ? 'Edit Details' : 'Add Payout Details'}
        </button>

        <p className="text-xs text-gray-400">
          Min payout: ₹{details.min_payout.toLocaleString('en-IN')} · Wallet: ₹{details.wallet_balance.toLocaleString('en-IN')}
          {details.wallet_in_payout > 0 && (
            <> · In Payout: ₹{details.wallet_in_payout.toLocaleString('en-IN')}</>
          )}
        </p>
      </div>
    );
  }

  // Edit form
  return (
    <div className="space-y-4">
      {msg && (
        <div className={`rounded-xl px-4 py-3 text-sm font-semibold ${
          msg.ok ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {msg.ok ? '✅' : '⚠️'} {msg.text}
        </div>
      )}

      {/* Method toggle */}
      <div>
        <label className="block text-xs font-bold text-gray-600 mb-2 uppercase">Payout Method</label>
        <div className="flex gap-2">
          {(['upi', 'bank'] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setForm({ ...form, method: m })}
              className={`flex-1 px-4 py-2 rounded-xl font-bold text-sm border transition-all ${
                form.method === m ? 'bg-primary text-black border-primary' : 'bg-white text-gray-600 border-gray-200'
              }`}
            >
              {m === 'upi' ? '💳 UPI (faster, ~₹3 fee)' : '🏦 Bank (NEFT/IMPS, ~₹5 fee)'}
            </button>
          ))}
        </div>
      </div>

      {form.method === 'upi' ? (
        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">UPI ID</label>
          <input
            className="input-field"
            value={form.upi_id}
            onChange={e => setForm({ ...form, upi_id: e.target.value })}
            placeholder="rajat@okhdfc"
          />
          <p className="text-xs text-gray-400 mt-1">
            Format: username@bankhandle (e.g. rajat@okhdfcbank, 9876543210@ybl)
          </p>
        </div>
      ) : (
        <>
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Account Holder Name</label>
            <input
              className="input-field"
              value={form.account_holder_name}
              onChange={e => setForm({ ...form, account_holder_name: e.target.value })}
              placeholder="As per bank records"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Account Number</label>
              <input
                className="input-field"
                value={form.account_number}
                onChange={e => setForm({ ...form, account_number: e.target.value.replace(/\D/g, '') })}
                placeholder="9-18 digits"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">IFSC Code</label>
              <input
                className="input-field font-mono"
                value={form.ifsc}
                onChange={e => setForm({ ...form, ifsc: e.target.value.toUpperCase() })}
                placeholder="HDFC0001234"
                maxLength={11}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Bank Name (optional)</label>
            <input
              className="input-field"
              value={form.bank_name}
              onChange={e => setForm({ ...form, bank_name: e.target.value })}
              placeholder="e.g. HDFC Bank"
            />
          </div>
        </>
      )}

      <div>
        <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">PAN (optional)</label>
        <input
          className="input-field font-mono"
          value={form.pan}
          onChange={e => setForm({ ...form, pan: e.target.value.toUpperCase() })}
          placeholder="ABCDE1234F"
          maxLength={10}
        />
        <p className="text-xs text-gray-400 mt-1">
          Annual cumulative payouts ₹15,000 se zyada hone par PAN mandatory ho jaata hai (Income Tax TDS rules).
        </p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="btn-primary px-6 py-2.5 flex items-center gap-2 disabled:opacity-60"
        >
          {saving ? <Spinner size="sm" /> : '💾'}
          {saving ? 'Saving...' : 'Save Details'}
        </button>
        <button
          onClick={() => { setEditing(false); load(); }}
          disabled={saving}
          className="px-6 py-2.5 border border-gray-200 rounded-xl font-bold text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center px-3 py-2 rounded-lg bg-gray-50">
      <span className="text-xs font-bold uppercase text-gray-500 tracking-wide">{label}</span>
      <span className="text-sm font-semibold text-gray-800">{children}</span>
    </div>
  );
}
