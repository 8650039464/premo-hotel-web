'use client';
import { useState, useEffect } from 'react';
import { getAuth, API_ROOT, API_TOKEN } from '@/lib/api';
import { Spinner } from '@/components/shared/ui';

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string | number; color: string }) {
  return (
    <div className={`bg-white rounded-2xl border p-5 ${color}`}>
      <div className="text-3xl mb-2">{icon}</div>
      <div className="text-2xl font-black">{value}</div>
      <div className="text-sm text-gray-600 font-medium mt-0.5">{label}</div>
    </div>
  );
}

export default function HotelAdminDashboard() {
  const auth = getAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hotelId, setHotelId] = useState<string | null>(null);

  const headers = { 'Content-Type': 'application/json', 'x-api-token': API_TOKEN, Authorization: `Bearer ${auth?.token}` };

  useEffect(() => {
    async function load() {
      try {
        const hotelRes = await fetch(`${API_ROOT}/api/hotels/my`, { headers });
        if (!hotelRes.ok) { setLoading(false); return; }
        const hotelData = await hotelRes.json();
        const hid = hotelData?.hotel?._id;
        setHotelId(hid);
        if (!hid) { setLoading(false); return; }

        const [roomsRes, bookingsRes] = await Promise.all([
          fetch(`${API_ROOT}/api/rooms/hotel/${hid}`, { headers }).then(r => r.json()),
          fetch(`${API_ROOT}/api/bookings/hotel/${hid}`, { headers }).then(r => r.json()),
        ]);

        const rooms = Array.isArray(roomsRes) ? roomsRes : [];
        const bookings = Array.isArray(bookingsRes) ? bookingsRes : [];
        const available = rooms.filter((r: any) => r.is_available !== false).length;
        const revenue = bookings.reduce((s: number, b: any) => s + (b.total_price || 0), 0);
        const active = bookings.filter((b: any) => b.status === 'booked' || b.status === 'checked_in');

        setStats({ totalRooms: rooms.length, available, booked: rooms.length - available, revenue, totalBookings: bookings.length, active: active.length, activeBookings: active.slice(0, 5) });
      } catch {}
      finally { setLoading(false); }
    }
    load();
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  if (!hotelId) return (
    <div className="text-center py-20">
      <div className="text-6xl mb-4">🏨</div>
      <h2 className="text-2xl font-bold text-gray-800 mb-2">Setup Your Property</h2>
      <p className="text-gray-500 mb-6">Add your hotel details to start accepting bookings</p>
      <a href="/hotel-admin/property" className="btn-primary px-8 py-3 inline-block">Create Hotel Profile →</a>
    </div>
  );

  return (
    <div>
      <h1 className="text-2xl font-black text-gray-900 mb-6">📊 Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon="🛏️" label="Total Rooms" value={stats?.totalRooms || 0} color="border-blue-100" />
        <StatCard icon="✅" label="Available" value={stats?.available || 0} color="border-green-100" />
        <StatCard icon="🚫" label="Booked" value={stats?.booked || 0} color="border-red-100" />
        <StatCard icon="💰" label="Total Revenue" value={`₹${stats?.revenue || 0}`} color="border-purple-100" />
      </div>

      {/* Active Bookings Highlight */}
      <div className="bg-gradient-to-r from-primary to-yellow-400 rounded-2xl p-6 mb-8">
        <div className="flex items-center gap-4">
          <div className="text-4xl">🔥</div>
          <div>
            <p className="text-black/60 font-semibold">Active Right Now</p>
            <p className="text-4xl font-black text-black">{stats?.active || 0} bookings</p>
          </div>
        </div>
      </div>

      {/* Active Bookings List */}
      {stats?.activeBookings?.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-gray-800 mb-4">🔴 Live Bookings</h2>
          <div className="space-y-3">
            {stats.activeBookings.map((b: any) => (
              <div key={b._id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center text-lg">
                  {b.status === 'checked_in' ? '🟢' : '🟡'}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-900">
                    {b.booking_type === 'walkin' ? b.guest_name || 'Walk-in Guest' : (b.user_id?.name || 'Guest')}
                  </p>
                  <p className="text-sm text-gray-500">
                    {b.room_id ? `Room ${b.room_id.room_number}` : ''} · {b.duration_hours}hr
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-black text-primary">₹{b.total_price}</p>
                  <span className={`text-xs font-bold ${b.status === 'checked_in' ? 'text-green-600' : 'text-orange-600'}`}>
                    {b.status.toUpperCase().replace('_', ' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <a href="/hotel-admin/bookings" className="block text-center text-primary font-bold mt-4 hover:underline">View All Bookings →</a>
        </div>
      )}
    </div>
  );
}
