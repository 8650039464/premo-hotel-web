'use client';
import { useState, useEffect } from 'react';
import { supremeApi, formatDate } from '@/lib/api';
import { Spinner, EmptyState, StatusBadge } from '@/components/shared/ui';

// ─────────────────────────────────────────────────────────────
//  SUPER ADMIN — DEVELOPERS / WHITE-LABEL PARTNERS
//  /p/supreme/developers — approve/suspend + view wallet/markup.
//  Platform-owner record (is_platform_owner: true) is protected —
//  status toggle disabled for that row.
// ─────────────────────────────────────────────────────────────

type DevTab = 'pending' | 'active' | 'suspended';

export default function SuperAdminDevelopersPage() {
  const [devs, setDevs]         = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState<DevTab>('pending');
  const [search, setSearch]     = useState('');
  const [updating, setUpdating] = useState<string | null>(null);
  const [err, setErr]           = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setErr('');
    try {
      const res = await supremeApi.listDevelopers();
      if (res.ok && Array.isArray(res.data)) {
        setDevs(res.data);
      } else {
        setDevs([]);
        setErr(res.data?.error || 'Failed to load developers.');
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

  async function updateStatus(id: string, status: 'active' | 'suspended' | 'pending') {
    setUpdating(id);
    setErr('');
    try {
      const res = await supremeApi.setDeveloperStatus(id, status);
      if (res.ok) {
        setDevs(prev => prev.map(d => d._id === id ? { ...d, status, is_active: status === 'active' } : d));
      } else {
        setErr(res.data?.error || 'Status update failed.');
      }
    } catch {
      setErr('Network error while updating status.');
    } finally {
      setUpdating(null);
    }
  }

  function filter(list: any[]) {
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter(d =>
      (d.name || '').toLowerCase().includes(q) ||
      (d.email || '').toLowerCase().includes(q) ||
      (d.company || '').toLowerCase().includes(q) ||
      (d.app_name || '').toLowerCase().includes(q)
    );
  }

  const pending   = filter(devs.filter(d => d.status === 'pending'));
  const active    = filter(devs.filter(d => d.status === 'active'));
  const suspended = filter(devs.filter(d => d.status === 'suspended'));
  const displayed = tab === 'pending' ? pending : tab === 'active' ? active : suspended;

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div>
      <h1 className="text-2xl font-black text-gray-900 mb-6">🔌 Developers / White-label Partners</h1>

      {err && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm mb-4">
          {err}
        </div>
      )}

      <input className="input-field mb-4" placeholder="🔍 Search name, email, company, app..." value={search} onChange={e => setSearch(e.target.value)} />

      <div className="flex gap-2 mb-6 flex-wrap items-center">
        {([['pending', pending.length], ['active', active.length], ['suspended', suspended.length]] as const).map(([t, count]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-xl font-bold text-sm capitalize transition-all ${tab === t ? 'bg-primary text-black' : 'bg-white border border-gray-200 text-gray-600'}`}>
            {t} ({count})
          </button>
        ))}
        <button onClick={load} className="ml-auto px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-xl">↻</button>
      </div>

      {displayed.length === 0 ? (
        <EmptyState icon="🔌" title={`No ${tab} developers`} />
      ) : (
        <div className="space-y-4">
          {displayed.map(d => {
            const isOwner = d.is_platform_owner;
            return (
              <div key={d._id} className={`bg-white rounded-2xl border p-5 ${isOwner ? 'border-indigo-300 bg-indigo-50/30' : 'border-gray-100'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-2xl">
                      {isOwner ? '⚡' : '🔌'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-gray-900 text-lg">{d.name}</p>
                        {isOwner && (
                          <span className="text-[10px] font-black uppercase tracking-wide bg-indigo-600 text-white px-2 py-0.5 rounded-full">
                            Platform Owner
                          </span>
                        )}
                      </div>
                      <p className="text-gray-500 text-sm">{d.email}</p>
                      {d.company   && <p className="text-gray-400 text-xs">🏢 {d.company}</p>}
                      {d.app_name  && <p className="text-gray-400 text-xs">📱 {d.app_name}</p>}
                      {d.website   && <p className="text-gray-400 text-xs">🌐 {d.website}</p>}
                    </div>
                  </div>
                  <StatusBadge status={d.status} />
                </div>

                <div className="grid grid-cols-3 gap-2 bg-gray-50 rounded-xl p-3 text-xs mb-3">
                  <div>
                    <p className="text-gray-400">Markup</p>
                    <p className="font-black text-gray-900">{d.markup_percent || 0}%</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Wallet</p>
                    <p className="font-black text-gray-900">₹{(d.wallet_balance || 0).toLocaleString('en-IN')}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Total Earned</p>
                    <p className="font-black text-gray-900">₹{(d.total_earned || 0).toLocaleString('en-IN')}</p>
                  </div>
                </div>

                <div className="text-xs text-gray-400 mb-3">
                  <span className="font-mono">{d.firm_id}</span>
                  {d.createdAt && <span> · Joined {formatDate(d.createdAt)}</span>}
                </div>

                {isOwner ? (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2 text-xs text-indigo-700">
                    🔒 Platform-owner record is protected. Status cannot be changed.
                  </div>
                ) : (
                  <div className="flex gap-2 flex-wrap">
                    {tab === 'pending' && (
                      <>
                        <button onClick={() => updateStatus(d._id, 'suspended')} disabled={updating === d._id}
                          className="flex-1 border border-red-300 text-red-600 py-2 rounded-xl font-bold text-sm hover:bg-red-50 disabled:opacity-50">
                          ✕ Reject
                        </button>
                        <button onClick={() => updateStatus(d._id, 'active')} disabled={updating === d._id}
                          className="flex-1 bg-green-600 text-white py-2 rounded-xl font-bold text-sm hover:bg-green-700 flex items-center justify-center gap-2 disabled:opacity-50">
                          {updating === d._id ? <Spinner size="sm" /> : null} ✓ Approve
                        </button>
                      </>
                    )}
                    {tab === 'active' && (
                      <button onClick={() => updateStatus(d._id, 'suspended')} disabled={updating === d._id}
                        className="border border-red-300 text-red-600 px-4 py-2 rounded-xl font-bold text-sm hover:bg-red-50 disabled:opacity-50">
                        🚫 Suspend
                      </button>
                    )}
                    {tab === 'suspended' && (
                      <button onClick={() => updateStatus(d._id, 'active')} disabled={updating === d._id}
                        className="border border-green-400 text-green-700 px-4 py-2 rounded-xl font-bold text-sm hover:bg-green-50 disabled:opacity-50">
                        ↩ Reactivate
                      </button>
                    )}
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
