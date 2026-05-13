'use client';
import { useState, useEffect, useMemo } from 'react';
import { supremeApi } from '@/lib/api';
import { Spinner, EmptyState, StatusBadge } from '@/components/shared/ui';

// ─────────────────────────────────────────────────────────────
//  SUPER ADMIN — CITY-LEVEL COMMISSION OVERRIDES
//  GET  /p/supreme/city-commissions        — list
//  PUT  /p/supreme/city-commissions/:id    — upsert override
//  PATCH /p/supreme/city-commissions/:id/toggle — enable/disable
//  DELETE /p/supreme/city-commissions/:id  — remove (falls back to global)
//
//  Resolver chain: hotel_override → city_override → dev_markup → global
// ─────────────────────────────────────────────────────────────

type CityDoc        = { _id: string; name: string; state?: string; is_active?: boolean };
type OverrideDoc    = {
  _id: string;
  city: CityDoc | string;
  is_active: boolean;
  checkout_hotel_share_percent?: number | null;
  cancel_full_refund_hours?: number | null;
  cancel_partial_refund_hours?: number | null;
  cancel_12_24_refund_percent?: number | null;
  cancel_12_24_hotel_share_percent?: number | null;
  cancel_under_12_hotel_share_percent?: number | null;
  sales_earning_per_hotel?: number | null;
  sales_min_payout?: number | null;
  sales_max_earning_per_month?: number | null;
  notes?: string;
};

type FormState = {
  checkout_hotel_share_percent:        string;
  cancel_full_refund_hours:            string;
  cancel_partial_refund_hours:         string;
  cancel_12_24_refund_percent:         string;
  cancel_12_24_hotel_share_percent:    string;
  cancel_under_12_hotel_share_percent: string;
  sales_earning_per_hotel:             string;
  sales_min_payout:                    string;
  sales_max_earning_per_month:         string;
  notes:                               string;
};

const EMPTY_FORM: FormState = {
  checkout_hotel_share_percent:        '',
  cancel_full_refund_hours:            '',
  cancel_partial_refund_hours:         '',
  cancel_12_24_refund_percent:         '',
  cancel_12_24_hotel_share_percent:    '',
  cancel_under_12_hotel_share_percent: '',
  sales_earning_per_hotel:             '',
  sales_min_payout:                    '',
  sales_max_earning_per_month:         '',
  notes:                               '',
};

export default function SuperAdminCityCommissionsPage() {
  const [cities, setCities]               = useState<CityDoc[]>([]);
  const [overrides, setOverrides]         = useState<OverrideDoc[]>([]);
  const [loading, setLoading]             = useState(true);
  const [editCityId, setEditCityId]       = useState<string | null>(null);
  const [form, setForm]                   = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving]               = useState(false);
  const [err, setErr]                     = useState('');
  const [ok, setOk]                       = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setErr(''); setOk('');
    try {
      const [cRes, oRes] = await Promise.all([
        supremeApi.listCities(),
        supremeApi.listCityCommissions(),
      ]);
      setCities(Array.isArray(cRes.data) ? cRes.data : []);
      setOverrides(Array.isArray(oRes.data) ? oRes.data : []);
    } catch (e) {
      const msg = (e as Error)?.message?.toLowerCase() || '';
      setErr(msg.includes('failed to fetch') || msg.includes('networkerror')
        ? 'Server wake up ho raha hai (free tier). 30-60 sec ruk kar retry karo.'
        : 'Network error. Check your connection.');
    } finally {
      setLoading(false);
    }
  }

  // Map of cityId -> override for quick lookup
  const overrideByCity = useMemo(() => {
    const map: Record<string, OverrideDoc> = {};
    for (const o of overrides) {
      const id = typeof o.city === 'string' ? o.city : o.city?._id;
      if (id) map[id] = o;
    }
    return map;
  }, [overrides]);

  function startEdit(cityId: string) {
    const existing = overrideByCity[cityId];
    setEditCityId(cityId);
    setErr(''); setOk('');
    if (existing) {
      setForm({
        checkout_hotel_share_percent:        existing.checkout_hotel_share_percent         != null ? String(existing.checkout_hotel_share_percent)         : '',
        cancel_full_refund_hours:            existing.cancel_full_refund_hours             != null ? String(existing.cancel_full_refund_hours)             : '',
        cancel_partial_refund_hours:         existing.cancel_partial_refund_hours          != null ? String(existing.cancel_partial_refund_hours)          : '',
        cancel_12_24_refund_percent:         existing.cancel_12_24_refund_percent          != null ? String(existing.cancel_12_24_refund_percent)          : '',
        cancel_12_24_hotel_share_percent:    existing.cancel_12_24_hotel_share_percent     != null ? String(existing.cancel_12_24_hotel_share_percent)     : '',
        cancel_under_12_hotel_share_percent: existing.cancel_under_12_hotel_share_percent  != null ? String(existing.cancel_under_12_hotel_share_percent)  : '',
        sales_earning_per_hotel:             existing.sales_earning_per_hotel              != null ? String(existing.sales_earning_per_hotel)              : '',
        sales_min_payout:                    existing.sales_min_payout                     != null ? String(existing.sales_min_payout)                     : '',
        sales_max_earning_per_month:         existing.sales_max_earning_per_month          != null ? String(existing.sales_max_earning_per_month)          : '',
        notes:                               existing.notes || '',
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }

  function cancelEdit() {
    setEditCityId(null);
    setForm(EMPTY_FORM);
  }

  function set<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: val }));
  }

  async function save() {
    if (!editCityId) return;
    setErr(''); setOk('');

    // Convert "" → undefined so backend leaves field as null (= fallback to global)
    const body: Record<string, any> = {};
    (Object.keys(form) as (keyof FormState)[]).forEach(k => {
      const v = form[k];
      if (v !== '' && v !== undefined) {
        body[k] = k === 'notes' ? v : Number(v);
      }
    });

    // Client-side sanity
    const full    = body.cancel_full_refund_hours;
    const partial = body.cancel_partial_refund_hours;
    if (full != null && partial != null && full <= partial) {
      setErr('Full refund hours must be greater than partial refund hours.');
      return;
    }

    setSaving(true);
    try {
      const res = await supremeApi.upsertCityCommission(editCityId, body);
      if (res.ok) {
        setOk('✓ Override saved.');
        await load();
        setEditCityId(null);
      } else {
        setErr(res.data?.error || 'Save failed.');
      }
    } catch {
      setErr('Network error while saving.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleOverride(cityId: string) {
    setErr(''); setOk('');
    try {
      const res = await supremeApi.toggleCityCommission(cityId);
      if (res.ok) await load();
      else setErr(res.data?.error || 'Toggle failed.');
    } catch {
      setErr('Network error.');
    }
  }

  async function removeOverride(cityId: string) {
    if (!confirm('Remove this city override? Booking price iske baad global policy follow karegi.')) return;
    setErr(''); setOk('');
    try {
      const res = await supremeApi.deleteCityCommission(cityId);
      if (res.ok) await load();
      else setErr(res.data?.error || 'Delete failed.');
    } catch {
      setErr('Network error.');
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div>
      <h1 className="text-2xl font-black text-gray-900 mb-2">🗺️ City Commission Overrides</h1>
      <p className="text-sm text-gray-500 mb-6">
        Per-city tweaks on top of the global policy. Field khaali = fallback to global.
      </p>

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

      {cities.length === 0 ? (
        <EmptyState icon="🗺️" title="No cities yet" />
      ) : (
        <div className="space-y-3">
          {cities.map(c => {
            const o        = overrideByCity[c._id];
            const isEdit   = editCityId === c._id;
            const hasOver  = Boolean(o);

            return (
              <div key={c._id} className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
                  <div>
                    <p className="font-bold text-gray-900">
                      {c.name} {c.state && <span className="text-gray-400 font-normal">· {c.state}</span>}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {hasOver ? (
                        <span className={`text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full ${o!.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {o!.is_active ? '● Override active' : '○ Override disabled'}
                        </span>
                      ) : (
                        <span className="text-[10px] font-black uppercase tracking-wide bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                          Uses global policy
                        </span>
                      )}
                      {c.is_active === false && <StatusBadge status="inactive" />}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {hasOver && !isEdit && (
                      <>
                        <button onClick={() => toggleOverride(c._id)}
                          className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-bold text-gray-600 hover:border-primary hover:text-primary">
                          {o!.is_active ? 'Disable' : 'Enable'}
                        </button>
                        <button onClick={() => removeOverride(c._id)}
                          className="px-3 py-1.5 border border-red-300 text-red-600 rounded-lg text-xs font-bold hover:bg-red-50">
                          Remove
                        </button>
                      </>
                    )}
                    {!isEdit && (
                      <button onClick={() => startEdit(c._id)}
                        className="px-3 py-1.5 bg-primary text-black rounded-lg text-xs font-black">
                        {hasOver ? 'Edit' : '+ Add override'}
                      </button>
                    )}
                    {isEdit && (
                      <button onClick={cancelEdit} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-bold text-gray-600">
                        Cancel
                      </button>
                    )}
                  </div>
                </div>

                {/* Summary of current override fields when not editing */}
                {hasOver && !isEdit && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs bg-gray-50 rounded-xl p-3">
                    <Stat label="Hotel share @ checkout" value={o!.checkout_hotel_share_percent} suffix="%" />
                    <Stat label="Full refund window"     value={o!.cancel_full_refund_hours}     suffix="hrs" />
                    <Stat label="Partial refund window"  value={o!.cancel_partial_refund_hours}  suffix="hrs" />
                    <Stat label="Partial refund %"       value={o!.cancel_12_24_refund_percent}  suffix="%" />
                    <Stat label="Sales / hotel"          value={o!.sales_earning_per_hotel}      suffix="₹"  prefix />
                    <Stat label="Sales min payout"       value={o!.sales_min_payout}             suffix="₹"  prefix />
                    <Stat label="Sales max / month"      value={o!.sales_max_earning_per_month}  suffix="₹"  prefix />
                  </div>
                )}

                {/* Edit form */}
                {isEdit && (
                  <div className="border-t border-gray-100 pt-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <FormField label="Hotel share @ checkout (%)"  suffix="%"   value={form.checkout_hotel_share_percent}        onChange={v => set('checkout_hotel_share_percent', v)} />
                      <FormField label="Full refund window (hrs)"    suffix="hrs" value={form.cancel_full_refund_hours}            onChange={v => set('cancel_full_refund_hours', v)} />
                      <FormField label="Partial refund window (hrs)" suffix="hrs" value={form.cancel_partial_refund_hours}         onChange={v => set('cancel_partial_refund_hours', v)} />
                      <FormField label="Partial refund amount (%)"   suffix="%"   value={form.cancel_12_24_refund_percent}         onChange={v => set('cancel_12_24_refund_percent', v)} />
                      <FormField label="Hotel share on partial (%)"  suffix="%"   value={form.cancel_12_24_hotel_share_percent}    onChange={v => set('cancel_12_24_hotel_share_percent', v)} />
                      <FormField label="Hotel share no-refund (%)"   suffix="%"   value={form.cancel_under_12_hotel_share_percent} onChange={v => set('cancel_under_12_hotel_share_percent', v)} />
                    </div>

                    <div className="border-t border-gray-100 pt-3">
                      <h4 className="text-xs font-black uppercase tracking-wide text-gray-500 mb-2">Sales overrides (this city)</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <FormField label="Earning per hotel (₹)"   suffix="₹"   value={form.sales_earning_per_hotel}     onChange={v => set('sales_earning_per_hotel', v)} />
                        <FormField label="Min payout (₹)"          suffix="₹"   value={form.sales_min_payout}            onChange={v => set('sales_min_payout', v)} />
                        <FormField label="Max earning / month (₹)" suffix="₹"   value={form.sales_max_earning_per_month} onChange={v => set('sales_max_earning_per_month', v)} />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">Notes (internal)</label>
                      <textarea
                        value={form.notes}
                        onChange={e => set('notes', e.target.value)}
                        placeholder="Why this override was set..."
                        className="input-field min-h-[60px]"
                      />
                    </div>

                    <div className="flex gap-2">
                      <button onClick={cancelEdit} className="flex-1 border border-gray-200 py-2 rounded-xl font-bold text-sm text-gray-600">
                        Cancel
                      </button>
                      <button onClick={save} disabled={saving}
                        className="flex-1 bg-primary text-black py-2 rounded-xl font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                        {saving ? <Spinner size="sm" /> : null}
                        {saving ? 'Saving...' : '💾 Save override'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, suffix, prefix }:
  { label: string; value: any; suffix: string; prefix?: boolean }) {
  const display = value == null || value === '' ? '—' :
    prefix ? `${suffix}${Number(value).toLocaleString('en-IN')}` : `${value}${suffix}`;
  return (
    <div>
      <p className="text-gray-400">{label}</p>
      <p className="font-black text-gray-900">{display}</p>
    </div>
  );
}

function FormField({ label, suffix, value, onChange }:
  { label: string; suffix: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1.5">{label}</label>
      <div className="relative">
        <input
          type="number"
          min={0}
          max={suffix === '%' ? 100 : undefined}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="(global)"
          className="input-field pr-10 text-sm"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-semibold">{suffix}</span>
      </div>
    </div>
  );
}
