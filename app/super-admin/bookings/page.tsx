'use client';
import { useState, useEffect } from 'react';
import { supremeApi, formatDT } from '@/lib/api';
import { Spinner, EmptyState, StatusBadge } from '@/components/shared/ui';

// ─────────────────────────────────────────────────────────────
//  SUPER ADMIN — ALL BOOKINGS
//  /p/supreme/bookings via supremeApi. Supports filter + inline
//  status update via /p/supreme/bookings/update/:id.
// ─────────────────────────────────────────────────────────────

export default function SuperAdminBookingsPage() {
  const [bookings, setBookings]   = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState<'active' | 'past' | 'cancelled'>('active');
  const [search, setSearch]       = useState('');
  const [updating, setUpdating]   = useState<string | null>(null);
  const [statusSheet, setStatusSheet] = useState<any | null>(null);
  const [err, setErr]             = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setErr('');
    try {
      const res = await supremeApi.listBookings();
      if (res.ok && Array.isArray(res.data)) {
        setBookings(res.data);
      } else {
        setBookings([]);
        setErr(res.data?.error || 'Failed to load bookings.');
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

  async function updateStatus(bookingId: string, status: string) {
    setUpdating(bookingId);
    setErr('');
    try {
      const res = await supremeApi.updateBooking(bookingId, { status });
      if (res.ok) {
        setBookings(prev => prev.map(b => b._id === bookingId ? { ...b, status } : b));
        setStatusSheet(null);
      } else {
        setErr(res.data?.error || 'Status update failed.');
      }
    } catch {
      setErr('Network error while updating status.');
    } finally {
      setUpdating(null);
    }
  }

  function filterBookings(list: any[]) {
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter(b =>
      (b.hotel_id?.name || '').toLowerCase().includes(q) ||
      (b.user_id?.name || b.guest_name || '').toLowerCase().includes(q)
    );
  }

  const active    = filterBookings(bookings.filter(b => b.status === 'booked' || b.status === 'checked_in'));
  const past      = filterBookings(bookings.filter(b => b.status === 'checked_out'));
  const cancelled = filterBookings(bookings.filter(b => b.status === 'cancelled'));
  const displayed = tab === 'active' ? active : tab === 'past' ? past : cancelled;

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div>
      <h1 className="text-2xl font-black text-gray-900 mb-6">📋 All Bookings</h1>

      {err && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm mb-4">
          {err}
        </div>
      )}

      <input className="input-field mb-4" placeholder="🔍 Search hotel or guest..." value={search} onChange={e => setSearch(e.target.value)} />

      <div className="flex gap-2 mb-6 flex-wrap">
        {([['active', active.length], ['past', past.length], ['cancelled', cancelled.length]] as const).map(([t, count]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-xl font-bold text-sm capitalize ${tab === t ? 'bg-primary text-black' : 'bg-white border border-gray-200 text-gray-600'}`}>
            {t} ({count})
          </button>
        ))}
        <button onClick={load} className="ml-auto px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-xl">↻</button>
      </div>

      {displayed.length === 0 ? (
        <EmptyState icon="📭" title={`No ${tab} bookings`} />
      ) : (
        <div className="space-y-4">
          {displayed.map(b => {
            const hotel = b.hotel_id?.name || 'Hotel';
            const isWalkin = b.booking_type === 'walkin';
            const user = isWalkin ? (b.guest_name || 'Walk-in Guest') : (b.user_id?.name || 'Guest');
            const room = b.room_id ? `Room ${b.room_id.room_number}` : '';

            return (
              <div key={b._id} className="bg-white rounded-2xl border border-gray-100 p-5 cursor-pointer hover:border-primary/30 transition-colors" onClick={() => setStatusSheet(b)}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-bold text-gray-900">{hotel}</p>
                      {isWalkin && <span className="text-xs bg-primary/20 text-primary font-bold px-2 py-0.5 rounded-full">WALK-IN</span>}
                    </div>
                    <p className="text-gray-600 text-sm">{user}</p>
                    {room && <p className="text-gray-400 text-sm">{room}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-primary">₹{b.total_price}</p>
                    <StatusBadge status={b.status} />
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl px-4 py-2 text-xs text-gray-600 flex items-center gap-3">
                  <span>📅 {formatDT(b.check_in)}</span>
                  <span className="text-gray-300">→</span>
                  <span>{formatDT(b.check_out)}</span>
                </div>
                <p className="text-xs text-gray-400 mt-2">Tap to update status</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Status Sheet */}
      {statusSheet && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-t-3xl md:rounded-2xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black">Update Status</h3>
              <button onClick={() => setStatusSheet(null)} className="text-gray-400 text-2xl">×</button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Current: <StatusBadge status={statusSheet.status} /></p>
            <div className="space-y-2">
              {['booked', 'checked_in', 'checked_out', 'cancelled'].map(s => (
                <button key={s} onClick={() => updateStatus(statusSheet._id, s)} disabled={s === statusSheet.status || updating === statusSheet._id}
                  className={`w-full px-4 py-3 rounded-xl text-left font-semibold text-sm border transition-all capitalize ${s === statusSheet.status ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 hover:border-gray-300'} disabled:opacity-50`}>
                  {s === statusSheet.status ? '✓ ' : '→ '}{s.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
