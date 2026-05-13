'use client';
import { useState, useEffect, useMemo } from 'react';
import { supremeApi } from '@/lib/api';
import { Spinner, EmptyState, StatusBadge } from '@/components/shared/ui';

// ─────────────────────────────────────────────────────────────
//  SUPER ADMIN — SALES AGENTS & TERRITORY
//  GET  /p/supreme/sales/agents            — list sales agents
//  GET  /p/supreme/sales/policy            — global sales policy
//  POST /p/supreme/sales/policy/set        — upsert global policy
//  PUT  /p/supreme/sales/:id/assign-cities — replace territory
//  PATCH /p/supreme/sales/:id/block-toggle — block/unblock
//  PUT  /p/supreme/users/status/:id        — approve/reject sales signup
// ─────────────────────────────────────────────────────────────

type CityDoc     = { _id: string; name: string; state?: string; is_active?: boolean };
type Profile     = {
  assigned_cities?: CityDoc[];
  is_blocked?: boolean;
  wallet_balance?: number;
  total_earned?: number;
};
type SalesAgent  = {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  status: 'active' | 'pending' | 'rejected';
  profile?: Profile | null;
};
type SalesPolicy = {
  earning_per_hotel: number;
  min_payout?: number;
  max_earning_per_month?: number;
  notes?: string;
};

export default function SuperAdminSalesPage() {
  const [agents, setAgents]       = useState<SalesAgent[]>([]);
  const [cities, setCities]       = useState<CityDoc[]>([]);
  const [policy, setPolicy]       = useState<SalesPolicy | null>(null);
  const [policyNotSet, setPolicyNotSet] = useState(false);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState<'active' | 'pending' | 'rejected'>('active');
  const [search, setSearch]       = useState('');
  const [err, setErr]             = useState('');
  const [ok, setOk]               = useState('');

  // Policy editor
  const [polForm, setPolForm] = useState({
    earning_per_hotel: '',
    min_payout: '',
    max_earning_per_month: '',
    notes: '',
  });
  const [savingPolicy, setSavingPolicy] = useState(false);

  // Territory editor state
  const [editId, setEditId]                 = useState<string | null>(null);
  const [selectedCities, setSelectedCities] = useState<Set<string>>(new Set());
  const [savingTerritory, setSavingTerritory] = useState(false);

  // Action loaders
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setErr(''); setOk('');
    try {
      const [aRes, cRes, pRes] = await Promise.all([
        supremeApi.listSalesAgents(),
        supremeApi.listCities(),
        supremeApi.getSalesPolicy(),
      ]);
      setAgents(Array.isArray(aRes.data) ? aRes.data : []);
      setCities(Array.isArray(cRes.data) ? cRes.data : []);

      if (pRes.ok && pRes.data) {
        setPolicy(pRes.data as SalesPolicy);
        setPolicyNotSet(false);
        setPolForm({
          earning_per_hotel:     String(pRes.data.earning_per_hotel ?? ''),
          min_payout:            pRes.data.min_payout != null ? String(pRes.data.min_payout) : '',
          max_earning_per_month: pRes.data.max_earning_per_month != null ? String(pRes.data.max_earning_per_month) : '',
          notes:                 pRes.data.notes || '',
        });
      } else if (pRes.status === 404) {
        setPolicyNotSet(true);
        setPolicy(null);
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

  async function savePolicy() {
    setErr(''); setOk('');
    const n = Number(polForm.earning_per_hotel);
    if (isNaN(n) || n < 0) {
      setErr('earning_per_hotel must be >= 0.');
      return;
    }
    setSavingPolicy(true);
    try {
      const body: any = { earning_per_hotel: n, notes: polForm.notes };
      if (polForm.min_payout            !== '') body.min_payout            = Number(polForm.min_payout);
      if (polForm.max_earning_per_month !== '') body.max_earning_per_month = Number(polForm.max_earning_per_month);

      const res = await supremeApi.setSalesPolicy(body);
      if (res.ok) {
        setOk('✓ Sales policy saved.');
        setPolicyNotSet(false);
        setPolicy(res.data?.policy || { earning_per_hotel: n });
      } else {
        setErr(res.data?.error || 'Save failed.');
      }
    } catch {
      setErr('Network error while saving policy.');
    } finally {
      setSavingPolicy(false);
    }
  }

  async function updateStatus(id: string, status: 'active' | 'rejected' | 'pending') {
    setUpdatingStatus(id);
    setErr(''); setOk('');
    try {
      const res = await supremeApi.setUserStatus(id, status);
      if (res.ok) await load();
      else setErr(res.data?.error || 'Status update failed.');
    } catch {
      setErr('Network error while updating status.');
    } finally {
      setUpdatingStatus(null);
    }
  }

  async function toggleBlock(id: string) {
    setErr(''); setOk('');
    try {
      const res = await supremeApi.toggleSalesBlock(id);
      if (res.ok) await load();
      else setErr(res.data?.error || 'Block toggle failed.');
    } catch {
      setErr('Network error.');
    }
  }

  function startEditTerritory(a: SalesAgent) {
    setEditId(a._id);
    const ids = new Set<string>((a.profile?.assigned_cities || []).map(c => c._id));
    setSelectedCities(ids);
    setErr(''); setOk('');
  }

  function cancelEditTerritory() {
    setEditId(null);
    setSelectedCities(new Set());
  }

  function toggleCity(cityId: string) {
    setSelectedCities(prev => {
      const next = new Set(prev);
      if (next.has(cityId)) next.delete(cityId);
      else next.add(cityId);
      return next;
    });
  }

  async function saveTerritory() {
    if (!editId) return;
    setSavingTerritory(true);
    setErr(''); setOk('');
    try {
      const res = await supremeApi.assignCitiesToSales(editId, Array.from(selectedCities));
      if (res.ok) {
        setOk('✓ Territory updated.');
        await load();
        setEditId(null);
      } else {
        setErr(res.data?.error || 'Territory update failed.');
      }
    } catch {
      setErr('Network error.');
    } finally {
      setSavingTerritory(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return agents.filter(a => {
      if (a.status !== tab) return false;
      if (!q) return true;
      return (a.name || '').toLowerCase().includes(q) ||
             (a.email || '').toLowerCase().includes(q) ||
             (a.phone || '').includes(q);
    });
  }, [agents, tab, search]);

  const activeCount   = agents.filter(a => a.status === 'active').length;
  const pendingCount  = agents.filter(a => a.status === 'pending').length;
  const rejectedCount = agents.filter(a => a.status === 'rejected').length;

  const activeCities = cities.filter(c => c.is_active !== false);

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div>
      <h1 className="text-2xl font-black text-gray-900 mb-2">👔 Sales Agents & Territory</h1>
      <p className="text-sm text-gray-500 mb-6">
        Agents ko cities assign karo. Sales policy yaha se set hoti hai. App-only login, no website portal.
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

      {/* Policy block */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-black text-gray-900">💸 Global Sales Earning Policy</h2>
          {policyNotSet && (
            <span className="text-[10px] font-black uppercase bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Not configured</span>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <InputBox label="Earning per approved hotel (₹)" suffix="₹" value={polForm.earning_per_hotel}
            onChange={v => setPolForm(p => ({ ...p, earning_per_hotel: v }))} />
          <InputBox label="Min payout threshold (₹)" suffix="₹" value={polForm.min_payout}
            onChange={v => setPolForm(p => ({ ...p, min_payout: v }))} />
          <InputBox label="Max earning per month (₹)" suffix="₹" value={polForm.max_earning_per_month}
            onChange={v => setPolForm(p => ({ ...p, max_earning_per_month: v }))} />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Notes (internal)</label>
          <textarea
            value={polForm.notes}
            onChange={e => setPolForm(p => ({ ...p, notes: e.target.value }))}
            placeholder="Applied from when, approved by whom..."
            className="input-field min-h-[60px]"
          />
        </div>
        <button onClick={savePolicy} disabled={savingPolicy}
          className="btn-primary flex items-center justify-center gap-2 disabled:opacity-50">
          {savingPolicy ? <Spinner size="sm" /> : null}
          {savingPolicy ? 'Saving...' : '💾 Save policy'}
        </button>
      </div>

      {/* Agents list */}
      <input className="input-field mb-4" placeholder="🔍 Search sales agents..." value={search} onChange={e => setSearch(e.target.value)} />

      <div className="flex gap-2 mb-6 flex-wrap items-center">
        {([['active', activeCount], ['pending', pendingCount], ['rejected', rejectedCount]] as const).map(([t, count]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-xl font-bold text-sm capitalize ${tab === t ? 'bg-primary text-black' : 'bg-white border border-gray-200 text-gray-600'}`}>
            {t} ({count})
          </button>
        ))}
        <button onClick={load} className="ml-auto px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-xl">↻</button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="👔" title={`No ${tab} sales agents`} />
      ) : (
        <div className="space-y-4">
          {filtered.map(a => {
            const isEdit   = editId === a._id;
            const assigned = a.profile?.assigned_cities || [];
            const blocked  = a.profile?.is_blocked;

            return (
              <div key={a._id} className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center font-black text-primary">
                      {a.name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-gray-900">{a.name}</p>
                        {blocked && (
                          <span className="text-[10px] font-black uppercase bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                            🚫 Blocked
                          </span>
                        )}
                      </div>
                      <p className="text-gray-500 text-sm">{a.email}</p>
                      {a.phone && <p className="text-gray-400 text-xs">{a.phone}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={a.status} />
                  </div>
                </div>

                {a.status === 'active' && (
                  <div className="grid grid-cols-2 gap-2 bg-gray-50 rounded-xl p-3 text-xs mb-3">
                    <div>
                      <p className="text-gray-400">Wallet</p>
                      <p className="font-black text-gray-900">₹{(a.profile?.wallet_balance || 0).toLocaleString('en-IN')}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Total earned</p>
                      <p className="font-black text-gray-900">₹{(a.profile?.total_earned || 0).toLocaleString('en-IN')}</p>
                    </div>
                  </div>
                )}

                {a.status === 'active' && !isEdit && (
                  <div className="mb-3">
                    <p className="text-xs font-black uppercase tracking-wide text-gray-500 mb-2">
                      Territory ({assigned.length} {assigned.length === 1 ? 'city' : 'cities'})
                    </p>
                    {assigned.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">No cities assigned yet.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {assigned.map(c => (
                          <span key={c._id} className="text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-full">
                            📍 {c.name}{c.state ? `, ${c.state}` : ''}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {a.status === 'active' && isEdit && (
                  <div className="border-t border-gray-100 pt-3 mb-3">
                    <p className="text-xs font-black uppercase tracking-wide text-gray-500 mb-2">
                      Select cities ({selectedCities.size} selected)
                    </p>
                    {activeCities.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">No active cities. Add some in Cities.</p>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-64 overflow-y-auto p-2 border border-gray-100 rounded-xl">
                        {activeCities.map(c => {
                          const checked = selectedCities.has(c._id);
                          return (
                            <label key={c._id}
                              className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer border text-sm ${checked ? 'bg-primary/10 border-primary' : 'bg-white border-gray-200'}`}>
                              <input type="checkbox" checked={checked} onChange={() => toggleCity(c._id)} className="accent-primary" />
                              <span className="font-semibold">{c.name}{c.state ? `, ${c.state}` : ''}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                    <div className="flex gap-2 mt-3">
                      <button onClick={cancelEditTerritory} className="flex-1 border border-gray-200 py-2 rounded-xl font-bold text-sm text-gray-600">
                        Cancel
                      </button>
                      <button onClick={saveTerritory} disabled={savingTerritory}
                        className="flex-1 bg-primary text-black py-2 rounded-xl font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                        {savingTerritory ? <Spinner size="sm" /> : null}
                        {savingTerritory ? 'Saving...' : '💾 Save territory'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Action row */}
                <div className="flex flex-wrap gap-2">
                  {a.status === 'pending' && (
                    <>
                      <button onClick={() => updateStatus(a._id, 'rejected')} disabled={updatingStatus === a._id}
                        className="flex-1 border border-red-300 text-red-600 py-2 rounded-xl font-bold text-sm hover:bg-red-50 disabled:opacity-50">
                        ✕ Reject
                      </button>
                      <button onClick={() => updateStatus(a._id, 'active')} disabled={updatingStatus === a._id}
                        className="flex-1 bg-green-600 text-white py-2 rounded-xl font-bold text-sm hover:bg-green-700 flex items-center justify-center gap-2 disabled:opacity-50">
                        {updatingStatus === a._id ? <Spinner size="sm" /> : null} ✓ Approve
                      </button>
                    </>
                  )}
                  {a.status === 'active' && !isEdit && (
                    <>
                      <button onClick={() => startEditTerritory(a)}
                        className="px-4 py-2 bg-primary text-black rounded-xl font-black text-sm">
                        🗺️ Edit territory
                      </button>
                      <button onClick={() => toggleBlock(a._id)}
                        className="px-4 py-2 border border-gray-200 rounded-xl font-bold text-sm text-gray-600 hover:border-red-300 hover:text-red-600">
                        {blocked ? '🔓 Unblock' : '🚫 Block'}
                      </button>
                      <button onClick={() => updateStatus(a._id, 'rejected')} disabled={updatingStatus === a._id}
                        className="px-4 py-2 border border-red-300 text-red-600 rounded-xl font-bold text-sm hover:bg-red-50 disabled:opacity-50">
                        Suspend
                      </button>
                    </>
                  )}
                  {a.status === 'rejected' && (
                    <button onClick={() => updateStatus(a._id, 'active')} disabled={updatingStatus === a._id}
                      className="border border-green-400 text-green-700 px-4 py-2 rounded-xl font-bold text-sm hover:bg-green-50 disabled:opacity-50">
                      ↩ Reactivate
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function InputBox({ label, suffix, value, onChange }:
  { label: string; suffix: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1.5">{label}</label>
      <div className="relative">
        <input
          type="number"
          min={0}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="input-field pr-8 text-sm"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-semibold">{suffix}</span>
      </div>
    </div>
  );
}
