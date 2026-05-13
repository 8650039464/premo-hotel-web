'use client';
import { useState, useEffect } from 'react';
import { getAuth, API_ROOT, API_TOKEN } from '@/lib/api';
import { Spinner, EmptyState } from '@/components/shared/ui';

export default function HotelPropertyPage() {
  const auth = getAuth();
  const [hotel, setHotel] = useState<any>(null);
  const [rooms, setRooms] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHotelForm, setShowHotelForm] = useState(false);
  const [showRoomForm, setShowRoomForm] = useState(false);
  const [editRoom, setEditRoom] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const headers = { 'Content-Type': 'application/json', 'x-api-token': API_TOKEN, Authorization: `Bearer ${auth?.token}` };

  useEffect(() => {
    Promise.all([
      fetch(`${API_ROOT}/api/cities/all`, { headers }).then(r => r.json()),
    ]).then(([c]) => setCities(Array.isArray(c) ? c : [])).catch(() => {});
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`${API_ROOT}/api/hotels/my`, { headers });
      if (res.ok) {
        const data = await res.json();
        const h = data?.hotel;
        setHotel(h || null);
        if (h?._id) {
          const rRes = await fetch(`${API_ROOT}/api/rooms/hotel/${h._id}`, { headers });
          setRooms(rRes.ok ? await rRes.json() : []);
        }
      } else { setHotel(null); setRooms([]); }
    } catch {}
    finally { setLoading(false); }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div>
      <h1 className="text-2xl font-black text-gray-900 mb-6">🏩 My Property</h1>

      {/* Hotel Card */}
      {!hotel ? (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">🏨</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Setup Your Hotel</h2>
          <p className="text-gray-500 mb-6">Create your hotel profile to start accepting bookings</p>
          <button onClick={() => setShowHotelForm(true)} className="btn-primary px-8">Create Hotel Profile</button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-6">
          <div className="h-28 bg-gradient-to-r from-primary to-yellow-400 flex items-center justify-center text-5xl">🏨</div>
          <div className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-black text-gray-900">{hotel.name}</h2>
                {hotel.city && (
                  <p className="text-gray-500 text-sm mt-1">📍 {typeof hotel.city === 'object' ? hotel.city.name : hotel.city}{hotel.address ? `, ${hotel.address}` : ''}</p>
                )}
                {hotel.desc && <p className="text-gray-600 text-sm mt-2">{hotel.desc}</p>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowHotelForm(true)} className="px-3 py-2 border border-primary text-primary rounded-xl text-sm font-bold hover:bg-primary hover:text-black transition-colors">
                  ✏️ Edit
                </button>
                <button onClick={() => window.location.href = `/hotel-admin/photos`} className="px-3 py-2 border border-blue-300 text-blue-600 rounded-xl text-sm font-bold hover:bg-blue-50 transition-colors">
                  📸 Photos
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rooms */}
      {hotel && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800">🛏️ Rooms ({rooms.length})</h2>
            <button onClick={() => { setEditRoom(null); setShowRoomForm(true); }} className="btn-primary text-sm px-4 py-2">+ Add Room</button>
          </div>

          {rooms.length === 0 ? (
            <EmptyState icon="🛏️" title="No rooms yet" desc="Add rooms to start accepting bookings" />
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {rooms.map(r => (
                <RoomCard key={r._id} room={r} token={auth?.token || ''} onEdit={() => { setEditRoom(r); setShowRoomForm(true); }} onRefresh={load} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Hotel Form Modal */}
      {showHotelForm && (
        <HotelFormModal hotel={hotel} cities={cities} token={auth?.token || ''} onClose={() => setShowHotelForm(false)} onSuccess={load} />
      )}

      {/* Room Form Modal */}
      {showRoomForm && hotel && (
        <RoomFormModal room={editRoom} hotelId={hotel._id} token={auth?.token || ''} onClose={() => setShowRoomForm(false)} onSuccess={load} />
      )}
    </div>
  );
}

function RoomCard({ room, token, onEdit, onRefresh }: { room: any; token: string; onEdit: () => void; onRefresh: () => void }) {
  const headers = { 'Content-Type': 'application/json', 'x-api-token': API_TOKEN, Authorization: `Bearer ${token}` };
  const [avail, setAvail] = useState(room.is_available !== false);
  const [toggling, setToggling] = useState(false);

  const typeColors: Record<string, string> = { single: 'text-blue-600 bg-blue-50', double: 'text-green-600 bg-green-50', suite: 'text-purple-600 bg-purple-50', deluxe: 'text-orange-600 bg-orange-50' };
  const tc = typeColors[room.type] || 'text-gray-600 bg-gray-50';

  async function toggleAvailability() {
    setToggling(true);
    try {
      await fetch(`${API_ROOT}/api/rooms/update/${room._id}`, { method: 'PUT', headers, body: JSON.stringify({ is_available: !avail }) });
      setAvail(!avail);
    } catch {} finally { setToggling(false); }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-lg ${tc}`}>{room.type}</span>
            {room.has_ac && <span className="text-xs text-blue-500 font-semibold">❄️ AC</span>}
          </div>
          <p className="text-xl font-black text-gray-900">Room {room.room_number}</p>
          <p className="text-gray-500 text-sm">{room.capacity || 1} guest(s)</p>
        </div>
        <button onClick={onEdit} className="text-gray-400 hover:text-gray-600 text-sm border border-gray-200 rounded-lg px-3 py-1.5">✏️ Edit</button>
      </div>

      {/* Pricing */}
      {(room.pricing || []).length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {room.pricing.map((p: any) => (
            <span key={p.hours} className="px-2.5 py-1 bg-primary/15 text-xs font-bold rounded-lg">{p.hours}hr · ₹{p.price}</span>
          ))}
        </div>
      )}

      {/* Toggle availability */}
      <button onClick={toggleAvailability} disabled={toggling}
        className={`w-full py-2 rounded-xl font-bold text-sm border transition-all ${avail ? 'border-green-300 bg-green-50 text-green-700' : 'border-red-300 bg-red-50 text-red-600'}`}>
        {toggling ? '...' : avail ? '✅ Available — tap to mark unavailable' : '❌ Unavailable — tap to mark available'}
      </button>
    </div>
  );
}

function HotelFormModal({ hotel, cities, token, onClose, onSuccess }: { hotel: any; cities: any[]; token: string; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ name: hotel?.name || '', city: (hotel?.city?._id || hotel?.city || ''), address: hotel?.address || '', desc: hotel?.desc || '' });
  const [saving, setSaving] = useState(false);
  const headers = { 'Content-Type': 'application/json', 'x-api-token': API_TOKEN, Authorization: `Bearer ${token}` };

  async function save() {
    setSaving(true);
    try {
      const isEdit = !!hotel;
      const url = isEdit ? `${API_ROOT}/api/hotels/update/${hotel._id}` : `${API_ROOT}/api/hotels/add`;
      const res = await fetch(url, { method: isEdit ? 'PUT' : 'POST', headers, body: JSON.stringify(form) });
      if (res.ok) { onSuccess(); onClose(); }
      else { const d = await res.json(); alert(d.error || 'Failed'); }
    } catch { alert('Error'); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-t-3xl md:rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-black text-lg">{hotel ? 'Edit Hotel' : 'Create Hotel'}</h3>
          <button onClick={onClose} className="text-gray-400 text-2xl">×</button>
        </div>
        <div className="space-y-4">
          <input className="input-field" placeholder="Hotel Name *" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
          <select className="input-field" value={form.city} onChange={e => setForm({...form, city: e.target.value})}>
            <option value="">Select City</option>
            {cities.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
          <input className="input-field" placeholder="Address" value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
          <textarea className="input-field" rows={3} placeholder="Description" value={form.desc} onChange={e => setForm({...form, desc: e.target.value})} />
          <button onClick={save} disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
            {saving ? <Spinner size="sm" /> : null}
            {saving ? 'Saving...' : hotel ? 'Save Changes' : 'Create Hotel'}
          </button>
        </div>
      </div>
    </div>
  );
}

function RoomFormModal({ room, hotelId, token, onClose, onSuccess }: { room: any; hotelId: string; token: string; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    room_number: room?.room_number || '', type: room?.type || 'single',
    capacity: room?.capacity || 1, has_ac: room?.has_ac || false, description: room?.description || '',
    checkin_start: room?.checkin_start || '08:00', checkin_end: room?.checkin_end || '22:00',
  });
  const [pricing, setPricing] = useState<Record<number, string>>({
    3: '', 6: '', 12: '', 24: '',
    ...(room?.pricing || []).reduce((acc: any, p: any) => ({ ...acc, [p.hours]: String(p.price) }), {}),
  });
  const [saving, setSaving] = useState(false);
  const headers = { 'Content-Type': 'application/json', 'x-api-token': API_TOKEN, Authorization: `Bearer ${token}` };

  async function save() {
    setSaving(true);
    try {
      const pricingArr = [3, 6, 12, 24].filter(h => pricing[h]).map(h => ({ hours: h, price: Number(pricing[h]) }));
      const body = { ...form, pricing: pricingArr, ...(room ? {} : { hotel_id: hotelId }) };
      const url = room ? `${API_ROOT}/api/rooms/update/${room._id}` : `${API_ROOT}/api/rooms/add`;
      const res = await fetch(url, { method: room ? 'PUT' : 'POST', headers, body: JSON.stringify(body) });
      if (res.ok) { onSuccess(); onClose(); }
      else { const d = await res.json(); alert(d.error || 'Failed'); }
    } catch { alert('Error'); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-t-3xl md:rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <h3 className="font-black text-lg">{room ? 'Edit Room' : 'Add Room'}</h3>
          <button onClick={onClose} className="text-gray-400 text-2xl">×</button>
        </div>
        <div className="p-6 space-y-4">
          <input className="input-field" placeholder="Room Number (e.g. 101) *" value={form.room_number} onChange={e => setForm({...form, room_number: e.target.value})} />
          <select className="input-field" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
            {['single', 'double', 'suite', 'deluxe'].map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
          </select>
          <input className="input-field" type="number" placeholder="Capacity" min={1} value={form.capacity} onChange={e => setForm({...form, capacity: Number(e.target.value)})} />

          <label className="flex items-center gap-3 cursor-pointer p-3 border border-gray-200 rounded-xl">
            <input type="checkbox" checked={form.has_ac} onChange={e => setForm({...form, has_ac: e.target.checked})} className="w-5 h-5 accent-primary" />
            <span className="font-semibold text-gray-700">❄️ AC Room</span>
          </label>

          <div className="grid grid-cols-2 gap-3">
            {[3, 6, 12, 24].map(h => (
              <div key={h}>
                <label className="block text-xs font-semibold text-gray-500 mb-1">{h}hr Price (₹)</label>
                <input className="input-field" type="number" placeholder="Leave empty to disable" value={pricing[h]}
                  onChange={e => setPricing({...pricing, [h]: e.target.value})} />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Check-in Start</label>
              <input type="time" className="input-field" value={form.checkin_start} onChange={e => setForm({...form, checkin_start: e.target.value})} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Check-in End</label>
              <input type="time" className="input-field" value={form.checkin_end} onChange={e => setForm({...form, checkin_end: e.target.value})} />
            </div>
          </div>

          <button onClick={save} disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
            {saving ? <Spinner size="sm" /> : null}
            {saving ? 'Saving...' : room ? 'Save Changes' : 'Add Room'}
          </button>
        </div>
      </div>
    </div>
  );
}
