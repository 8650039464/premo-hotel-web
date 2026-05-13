'use client';
import { useState, useEffect } from 'react';
import { supremeApi } from '@/lib/api';
import { Spinner, StatusBadge } from '@/components/shared/ui';

// ─────────────────────────────────────────────────────────────
//  SUPER ADMIN DASHBOARD
//  Uses /p/supreme/* endpoints via supremeApi wrappers.
//  Stats come from a single aggregate endpoint; pending hotel
//  list + active-bookings count are computed with focused calls.
// ─────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string | number; color: string }) {
  return (
    <div className={`bg-white rounded-2xl border p-5 ${color}`}>
      <div className="text-3xl mb-2">{icon}</div>
      <div className="text-2xl font-black">{value}</div>
      <div className="text-sm text-gray-600 font-medium mt-0.5">{label}</div>
    </div>
  );
}

type SupremeStats = {
  totalHotels: number;
  totalBookings: number;
  totalRevenue: number;
  totalCommission: number;
  totalDevMarkup: number;
};

export default function SuperAdminDashboard() {
  const [stats, setStats]       = useState<SupremeStats | null>(null);
  const [pending, setPending]   = useState<any[]>([]);
  const [active, setActive]     = useState(0);
  const [loading, setLoading]   = useState(true);
  const [approving, setApproving] = useState<string | null>(null);
  const [err, setErr]           = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setErr('');
    try {
      const [statsRes, pendingRes, bookedRes, checkedInRes] = await Promise.all([
        supremeApi.stats(),
        supremeApi.listUsers({ role: 'hotel', status: 'pending' }),
        supremeApi.listBookings({ status: 'booked' }),
        supremeApi.listBookings({ status: 'checked_in' }),
      ]);

      if (statsRes.ok && statsRes.data)
        setStats(statsRes.data as SupremeStats);

      const pendingArr = Array.isArray(pendingRes.data) ? pendingRes.data : [];
      setPending(pendingArr);

      const bookedCount    = Array.isArray(bookedRes.data)    ? bookedRes.data.length    : 0;
      const checkedInCount = Array.isArray(checkedInRes.data) ? checkedInRes.data.length : 0;
      setActive(bookedCount + checkedInCount);

      if (!statsRes.ok && !pendingRes.ok) {
        setErr('Failed to load dashboard. Session expired ho sakti hai — re-login kar ke try karo.');
      }
    } catch (e) {
      const msg = (e as Error)?.message?.toLowerCase() || '';
      if (msg.includes('failed to fetch') || msg.includes('networkerror')) {
        setErr('Server wake up ho raha hai (free tier). 30-60 sec ruk kar retry karo.');
      } else {
        setErr('Dashboard load nahi hua. Connection check karo.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(userId: string, status: 'active' | 'rejected') {
    setApproving(userId);
    try {
      const res = await supremeApi.setUserStatus(userId, status);
      if (!res.ok) {
        setErr(res.data?.error || 'Update failed.');
      }
      await load();
    } catch {
      setErr('Network error while updating status.');
    } finally {
      setApproving(null);
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div>
      <h1 className="text-2xl font-black text-gray-900 mb-6">📊 Admin Dashboard</h1>

      {err && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm mb-6">
          {err}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon="🏨" label="Total Hotels"       value={stats?.totalHotels   ?? 0} color="border-blue-100" />
        <StatCard icon="📋" label="Total Bookings"     value={stats?.totalBookings ?? 0} color="border-orange-100" />
        <StatCard icon="⏳" label="Pending Approval"   value={pending.length}            color="border-red-100" />
        <StatCard icon="💰" label="Total Revenue"      value={`₹${(stats?.totalRevenue ?? 0).toLocaleString('en-IN')}`} color="border-green-100" />
      </div>

      {/* Commission earnings row (Premo-specific) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <StatCard icon="🏷️" label="Premo Commission"    value={`₹${(stats?.totalCommission ?? 0).toLocaleString('en-IN')}`} color="border-purple-100" />
        <StatCard icon="🔌" label="Developer Markups"   value={`₹${(stats?.totalDevMarkup  ?? 0).toLocaleString('en-IN')}`} color="border-indigo-100" />
      </div>

      {/* Active Now */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-6 mb-8">
        <div className="flex items-center gap-4">
          <div className="text-4xl">🔴</div>
          <div>
            <p className="text-gray-400 font-semibold">Active Right Now</p>
            <p className="text-4xl font-black text-primary">{active} bookings live</p>
          </div>
        </div>
      </div>

      {/* Pending Approvals */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-lg font-bold text-gray-800">⏳ Pending Approvals</h2>
          {pending.length > 0 && (
            <span className="bg-red-500 text-white text-xs font-black px-2 py-0.5 rounded-full">{pending.length}</span>
          )}
        </div>

        {pending.length === 0 ? (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5 flex items-center gap-3">
            <span className="text-2xl">✅</span>
            <p className="text-green-700 font-semibold">No pending approvals!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map(h => (
              <div key={h._id} className="bg-white rounded-2xl border border-orange-200 p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center text-2xl">🏨</div>
                    <div>
                      <p className="font-bold text-gray-900 text-lg">{h.name}</p>
                      <p className="text-gray-500 text-sm">{h.email}</p>
                      {h.phone && <p className="text-gray-400 text-sm">{h.phone}</p>}
                    </div>
                  </div>
                  <StatusBadge status="pending" />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => updateStatus(h._id, 'rejected')} disabled={approving === h._id}
                    className="flex-1 border border-red-300 text-red-600 py-2.5 rounded-xl font-bold text-sm hover:bg-red-50 transition-colors disabled:opacity-50">
                    ✕ Reject
                  </button>
                  <button onClick={() => updateStatus(h._id, 'active')} disabled={approving === h._id}
                    className="flex-1 bg-green-600 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                    {approving === h._id ? <Spinner size="sm" /> : null}
                    ✓ Approve
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
