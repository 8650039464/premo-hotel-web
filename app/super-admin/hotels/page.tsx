'use client';
import { useState, useEffect } from 'react';
import { supremeApi } from '@/lib/api';
import { Spinner, EmptyState, StatusBadge } from '@/components/shared/ui';

// ─────────────────────────────────────────────────────────────
//  SUPER ADMIN — HOTELS MANAGEMENT
//  Lists hotel-role Auth users with tabs for pending/active/rejected.
//  Uses /p/supreme/users?role=hotel via supremeApi.
// ─────────────────────────────────────────────────────────────

export default function SuperAdminHotelsPage() {
  const [hotels, setHotels]       = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState<'pending' | 'active' | 'rejected'>('pending');
  const [search, setSearch]       = useState('');
  const [updating, setUpdating]   = useState<string | null>(null);
  const [err, setErr]             = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setErr('');
    try {
      const res = await supremeApi.listUsers({ role: 'hotel' });
      if (res.ok && Array.isArray(res.data)) {
        setHotels(res.data);
      } else {
        setHotels([]);
        setErr(res.data?.error || 'Failed to load hotels.');
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

  async function updateStatus(userId: string, status: 'active' | 'rejected' | 'pending') {
    setUpdating(userId);
    setErr('');
    try {
      const res = await supremeApi.setUserStatus(userId, status);
      if (!res.ok) setErr(res.data?.error || 'Status update failed.');
      await load();
    } catch {
      setErr('Network error while updating status.');
    } finally {
      setUpdating(null);
    }
  }

  function filter(list: any[]) {
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter(h => h.name?.toLowerCase().includes(q) || h.email?.toLowerCase().includes(q));
  }

  const pending  = filter(hotels.filter(h => h.status === 'pending'));
  const active   = filter(hotels.filter(h => h.status === 'active'));
  const rejected = filter(hotels.filter(h => h.status === 'rejected'));
  const displayed = tab === 'pending' ? pending : tab === 'active' ? active : rejected;

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div>
      <h1 className="text-2xl font-black text-gray-900 mb-6">🏨 Hotels Management</h1>

      {err && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm mb-4">
          {err}
        </div>
      )}

      <input className="input-field mb-4" placeholder="🔍 Search hotels..." value={search} onChange={e => setSearch(e.target.value)} />

      <div className="flex gap-2 mb-6 flex-wrap">
        {([['pending', pending.length], ['active', active.length], ['rejected', rejected.length]] as const).map(([t, count]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-xl font-bold text-sm capitalize transition-all ${tab === t ? 'bg-primary text-black' : 'bg-white border border-gray-200 text-gray-600'}`}>
            {t} ({count})
          </button>
        ))}
        <button onClick={load} className="ml-auto px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-xl">↻</button>
      </div>

      {displayed.length === 0 ? (
        <EmptyState icon="🏨" title={`No ${tab} hotels`} />
      ) : (
        <div className="space-y-4">
          {displayed.map(h => (
            <div key={h._id} className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-2xl">🏨</div>
                  <div>
                    <p className="font-bold text-gray-900 text-lg">{h.name}</p>
                    <p className="text-gray-500 text-sm">{h.email}</p>
                    {h.phone && <p className="text-gray-400 text-sm">{h.phone}</p>}
                  </div>
                </div>
                <StatusBadge status={h.status} />
              </div>

              <div className="flex gap-2">
                {tab === 'pending' && (
                  <>
                    <button onClick={() => updateStatus(h._id, 'rejected')} disabled={updating === h._id}
                      className="flex-1 border border-red-300 text-red-600 py-2 rounded-xl font-bold text-sm hover:bg-red-50 transition-colors disabled:opacity-50">
                      ✕ Reject
                    </button>
                    <button onClick={() => updateStatus(h._id, 'active')} disabled={updating === h._id}
                      className="flex-1 bg-green-600 text-white py-2 rounded-xl font-bold text-sm hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                      {updating === h._id ? <Spinner size="sm" /> : null} ✓ Approve
                    </button>
                  </>
                )}
                {tab === 'active' && (
                  <button onClick={() => updateStatus(h._id, 'rejected')} disabled={updating === h._id}
                    className="border border-red-300 text-red-600 px-4 py-2 rounded-xl font-bold text-sm hover:bg-red-50 transition-colors disabled:opacity-50">
                    🚫 Suspend
                  </button>
                )}
                {tab === 'rejected' && (
                  <button onClick={() => updateStatus(h._id, 'active')} disabled={updating === h._id}
                    className="border border-green-400 text-green-700 px-4 py-2 rounded-xl font-bold text-sm hover:bg-green-50 transition-colors disabled:opacity-50">
                    ↩ Reactivate
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
