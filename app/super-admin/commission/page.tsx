'use client';
import { useState, useEffect } from 'react';
import { supremeApi } from '@/lib/api';
import { Spinner } from '@/components/shared/ui';

// ─────────────────────────────────────────────────────────────
//  SUPER ADMIN — GLOBAL COMMISSION POLICY
//  /p/supreme/commission (GET) + /commission/set (POST)
//  Controls fallback commission used when no city/hotel override.
// ─────────────────────────────────────────────────────────────

type CommType = 'percentage' | 'fixed';

type Form = {
  type: CommType;
  percentage: number;
  fixed_amount: number;
  checkout_hotel_share_percent: number;
  cancel_full_refund_hours: number;
  cancel_partial_refund_hours: number;
  cancel_12_24_refund_percent: number;
  cancel_12_24_hotel_share_percent: number;
  cancel_under_12_hotel_share_percent: number;
  max_developer_markup_percent: number;
  notes: string;
};

const DEFAULT_FORM: Form = {
  type: 'percentage',
  percentage: 20,
  fixed_amount: 0,
  checkout_hotel_share_percent: 70,
  cancel_full_refund_hours: 24,
  cancel_partial_refund_hours: 12,
  cancel_12_24_refund_percent: 50,
  cancel_12_24_hotel_share_percent: 50,
  cancel_under_12_hotel_share_percent: 100,
  max_developer_markup_percent: 50,
  notes: '',
};

export default function SuperAdminCommissionPage() {
  const [form, setForm]         = useState<Form>(DEFAULT_FORM);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState('');
  const [ok, setOk]             = useState('');
  const [notSet, setNotSet]     = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setErr(''); setOk('');
    try {
      const res = await supremeApi.getCommission();
      if (res.ok && res.data) {
        setForm({
          type:                                res.data.type ?? 'percentage',
          percentage:                          res.data.percentage ?? 0,
          fixed_amount:                        res.data.fixed_amount ?? 0,
          checkout_hotel_share_percent:        res.data.checkout_hotel_share_percent ?? 70,
          cancel_full_refund_hours:            res.data.cancel_full_refund_hours ?? 24,
          cancel_partial_refund_hours:         res.data.cancel_partial_refund_hours ?? 12,
          cancel_12_24_refund_percent:         res.data.cancel_12_24_refund_percent ?? 50,
          cancel_12_24_hotel_share_percent:    res.data.cancel_12_24_hotel_share_percent ?? 50,
          cancel_under_12_hotel_share_percent: res.data.cancel_under_12_hotel_share_percent ?? 100,
          max_developer_markup_percent:        res.data.max_developer_markup_percent ?? 50,
          notes:                               res.data.notes ?? '',
        });
        setNotSet(false);
      } else if (res.status === 404) {
        setNotSet(true);
      } else {
        setErr(res.data?.error || 'Failed to load commission policy.');
      }
    } catch (e) {
      const msg = (e as Error)?.message?.toLowerCase() || '';
      setErr(msg.includes('failed to fetch') || msg.includes('networkerror')
        ? 'Server wake up ho raha hai (free tier). 30-60 sec ruk kar retry karo.'
        : 'Network error. Check your connection.');
    } finally {
      setLoading(false);
    }
  }

  function set<K extends keyof Form>(key: K, val: Form[K]) {
    setForm(prev => ({ ...prev, [key]: val }));
  }

  async function save() {
    setErr(''); setOk('');
    if (form.cancel_full_refund_hours <= form.cancel_partial_refund_hours) {
      setErr('Full refund hours must be greater than partial refund hours.');
      return;
    }
    setSaving(true);
    try {
      const res = await supremeApi.setCommission(form);
      if (res.ok) {
        setOk('✓ Commission policy saved successfully.');
        setNotSet(false);
      } else {
        setErr(res.data?.error || 'Save failed.');
      }
    } catch {
      setErr('Network error while saving.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-black text-gray-900 mb-2">💰 Global Commission Policy</h1>
      <p className="text-sm text-gray-500 mb-6">
        Platform-wide fallback. City-level or hotel-level overrides, agar set hain, toh inhe beat kar denge.
      </p>

      {notSet && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-amber-800 text-sm mb-4">
          ⚠️ Commission policy abhi set nahi hai. Form fill karke save karo — jab tak set nahi hoti, bookings 503 throw karenge.
        </div>
      )}
      {err && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm mb-4">
          {err}
        </div>
      )}
      {ok && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-green-700 text-sm mb-4">
          {ok}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
        {/* Type */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Commission Type</label>
          <div className="flex gap-2">
            {(['percentage', 'fixed'] as const).map(t => (
              <button key={t} onClick={() => set('type', t)}
                className={`flex-1 px-4 py-2 rounded-xl font-bold text-sm capitalize border transition-all ${form.type === t ? 'bg-primary text-black border-primary' : 'bg-white text-gray-600 border-gray-200'}`}>
                {t === 'percentage' ? '% of booking' : '₹ fixed fee'}
              </button>
            ))}
          </div>
        </div>

        {form.type === 'percentage' ? (
          <Field
            label="Premo Brokerage (% of hotel cost)"
            suffix="%"
            value={form.percentage}
            onChange={v => set('percentage', v)}
            hint="Premo's earning on top of what the hotel sets. Hotel always keeps 100% of their listed price; this brokerage is added to the user-facing price."
          />
        ) : (
          <Field label="Fixed Brokerage Amount (₹ per booking)" suffix="₹" value={form.fixed_amount} onChange={v => set('fixed_amount', v)} />
        )}

        <div className="border-t border-gray-100 pt-5">
          <h3 className="font-bold text-gray-800 mb-3">🏨 Hotel Earnings Reference</h3>
          <Field
            label="Hotel's effective share % (auto)"
            suffix="%"
            value={form.checkout_hotel_share_percent}
            onChange={v => set('checkout_hotel_share_percent', v)}
            hint="Legacy field. In the additive model hotel always keeps 100% of their listed cost. Set to 100 to disable any subtraction. Brokerage is added on top, not deducted."
          />
        </div>

        <div className="border-t border-gray-100 pt-5">
          <h3 className="font-bold text-gray-800 mb-3">❌ Cancellation Rules</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Full refund until (hours before check-in)" suffix="hrs" value={form.cancel_full_refund_hours} onChange={v => set('cancel_full_refund_hours', v)} />
            <Field label="Partial refund until (hours before check-in)" suffix="hrs" value={form.cancel_partial_refund_hours} onChange={v => set('cancel_partial_refund_hours', v)} />
            <Field label="Partial refund amount (%)"              suffix="%" value={form.cancel_12_24_refund_percent}         onChange={v => set('cancel_12_24_refund_percent', v)} />
            <Field label="Hotel share on partial cancel (%)"      suffix="%" value={form.cancel_12_24_hotel_share_percent}    onChange={v => set('cancel_12_24_hotel_share_percent', v)} />
            <Field label="Hotel share on no-refund cancel (%)"    suffix="%" value={form.cancel_under_12_hotel_share_percent} onChange={v => set('cancel_under_12_hotel_share_percent', v)} />
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Example with 24/12 windows: &gt;24hrs = full refund, 12–24hrs = {form.cancel_12_24_refund_percent}% refund, &lt;12hrs = no refund.
          </p>
        </div>

        <div className="border-t border-gray-100 pt-5">
          <h3 className="font-bold text-gray-800 mb-3">🔌 Developer Platform</h3>
          <Field
            label="Max developer markup cap (%)"
            suffix="%"
            value={form.max_developer_markup_percent}
            onChange={v => set('max_developer_markup_percent', v)}
            hint="White-label developers apna markup is cap se zyada set nahi kar sakte. Register/update pe backend enforce karta hai."
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Notes (internal)</label>
          <textarea
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            placeholder="Why this rate was set, approved by whom, valid till..."
            className="input-field min-h-[80px]"
          />
        </div>

        <button onClick={save} disabled={saving}
          className="btn-primary w-full flex items-center justify-center gap-2">
          {saving ? <Spinner size="sm" /> : null}
          {saving ? 'Saving...' : '💾 Save Global Policy'}
        </button>
      </div>
    </div>
  );
}

function Field({ label, suffix, value, onChange, hint }:
  { label: string; suffix: string; value: number; onChange: (v: number) => void; hint?: string }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
      <div className="relative">
        <input
          type="number"
          min={0}
          max={suffix === '%' ? 100 : undefined}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="input-field pr-10"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold">{suffix}</span>
      </div>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}
