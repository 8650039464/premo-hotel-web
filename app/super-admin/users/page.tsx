'use client';
import { useState, useEffect } from 'react';
import { supremeApi } from '@/lib/api';
import { Spinner, EmptyState, StatusBadge } from '@/components/shared/ui';

// ─────────────────────────────────────────────────────────────
//  SUPER ADMIN — USERS
//  Customers (role=user) and Hotel partners (role=hotel) in tabs.
//  Uses /p/supreme/users?role=... via supremeApi.
// ─────────────────────────────────────────────────────────────

export default function SuperAdminUsersPage() {
  const [users, setUsers]                 = useState<any[]>([]);
  const [hotelPartners, setHotelPartners] = useState<any[]>([]);
  const [loading, setLoading]             = useState(true);
  const [tab, setTab]                     = useState<'users' | 'hotels'>('users');
  const [search, setSearch]               = useState('');
  const [updating, setUpdating]           = useState<string | null>(null);
  const [err, setErr]                     = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setErr('');
    try {
      const [uRes, hRes] = await Promise.all([
        supremeApi.listUsers({ role: 'user' }),
        supremeApi.listUsers({ role: 'hotel' }),
      ]);
      setUsers(Array.isArray(uRes.data) ? uRes.data : []);
      setHotelPartners(Array.isArray(hRes.data) ? hRes.data : []);
      if (!uRes.ok && !hRes.ok) {
        setErr('Failed to load users. Session expired ho sakti hai.');
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
      if (res.ok) {
        setUsers(prev => prev.map(u => u._id === userId ? { ...u, status } : u));
        setHotelPartners(prev => prev.map(h => h._id === userId ? { ...h, status } : h));
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
    return list.filter(u => (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q) || (u.phone || '').includes(q));
  }

  const filteredUsers  = filter(users);
  const filteredHotels = filter(hotelPartners);
  const displayed      = tab === 'users' ? filteredUsers : filteredHotels;

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div>
      <h1 className="text-2xl font-black text-gray-900 mb-6">👥 Users Management</h1>

      {err && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm mb-4">
          {err}
        </div>
      )}

      <input className="input-field mb-4" placeholder="🔍 Search by name, email, phone..." value={search} onChange={e => setSearch(e.target.value)} />

      <div className="flex gap-2 mb-6 items-center">
        {([['users', filteredUsers.length], ['hotels', filteredHotels.length]] as const).map(([t, count]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-xl font-bold text-sm capitalize ${tab === t ? 'bg-primary text-black' : 'bg-white border border-gray-200 text-gray-600'}`}>
            {t === 'users' ? 'Customers' : 'Hotel Partners'} ({count})
          </button>
        ))}
        <button onClick={load} className="ml-auto px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-xl">↻</button>
      </div>

      {displayed.length === 0 ? (
        <EmptyState icon="👥" title="No users found" />
      ) : (
        <div className="space-y-3">
          {displayed.map(u => {
            const isActive = u.status === 'active';
            return (
              <div key={u._id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-black text-primary">
                  {u.name?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-900">{u.name}</p>
                  <p className="text-gray-500 text-sm">{u.email}</p>
                  {u.phone && <p className="text-gray-400 text-xs">{u.phone}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={u.status || 'active'} />
                  <button
                    onClick={() => updateStatus(u._id, isActive ? 'rejected' : 'active')}
                    disabled={updating === u._id}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors disabled:opacity-50 ${isActive ? 'border-red-300 text-red-600 hover:bg-red-50' : 'border-green-400 text-green-700 hover:bg-green-50'}`}>
                    {updating === u._id ? '...' : isActive ? 'Block' : 'Unblock'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
