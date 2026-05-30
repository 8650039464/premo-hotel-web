'use client';
import { useState, useEffect } from 'react';
import { getAuth, API_ROOT, API_TOKEN, formatDT } from '@/lib/api';
import { Spinner, EmptyState, StatusBadge } from '@/components/shared/ui';

export default function HotelBookingsPage() {
  const auth = getAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [hotelId, setHotelId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'active' | 'past'>('active');
  const [showWalkin, setShowWalkin] = useState(false);
  const [otpDialog, setOtpDialog] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);

  // Date filter
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  const headers = { 'Content-Type': 'application/json', 'x-api-token': API_TOKEN, Authorization: `Bearer ${auth?.token}` };

  useEffect(() => {
    async function init() {
      try {
        const hotelRes = await fetch(`${API_ROOT}/api/hotels/my`, { headers });
        if (!hotelRes.ok) { setLoading(false); return; }
        const hotelData = await hotelRes.json();
        const hid = hotelData?.hotel?._id;
        setHotelId(hid);
        if (hid) await loadData(hid);
      } catch {}
      finally { setLoading(false); }
    }
    init();
  }, []);

  async function loadData(hid: string) {
    const [bRes, rRes] = await Promise.all([
      fetch(`${API_ROOT}/api/bookings/hotel/${hid}`, { headers }).then(r => r.json()),
      fetch(`${API_ROOT}/api/rooms/hotel/${hid}`, { headers }).then(r => r.json()),
    ]);
    setBookings(Array.isArray(bRes) ? bRes : []);
    setRooms(Array.isArray(rRes) ? rRes : []);
  }

  async function reload() { if (hotelId) await loadData(hotelId); }

  // async function updateStatus(bookingId: string, status: string) {
  //   await fetch(`${API_ROOT}/api/bookings/update/${bookingId}`, { method: 'PUT', headers, body: JSON.stringify({ status }) });
  //   reload();
  // }

  async function updateStatus(bookingId: string, status: string) {
    if (status === 'checked_out') {
        const res = await fetch(`${API_ROOT}/api/payment/checkout/${bookingId}`, {
            method: 'POST', headers,
        });
        if (!res.ok) {
            const d = await res.json();
            alert(d.error || 'Checkout failed');
            return;
        }
    } else {
        await fetch(`${API_ROOT}/api/bookings/update/${bookingId}`, {
            method: 'PUT', headers,
            body: JSON.stringify({ status }),
        });
    }
    reload();
}

  async function verifyCheckin(bookingId: string) {
    if (otp.length !== 6) { alert('Enter 6-digit OTP'); return; }
    setOtpLoading(true);
    try {
      const res = await fetch(`${API_ROOT}/api/bookings/verify-checkin/${bookingId}`, { method: 'POST', headers, body: JSON.stringify({ otp }) });
      if (res.ok) { alert('✅ Check-in verified!'); setOtpDialog(null); setOtp(''); reload(); }
      else { const d = await res.json(); alert(d.error || 'Invalid OTP'); }
    } catch { alert('Error'); }
    finally { setOtpLoading(false); }
  }

  function applyFilter(list: any[]) {
    if (!filterFrom && !filterTo) return list;
    return list.filter(b => {
      const d = new Date(b.check_in);
      if (filterFrom && d < new Date(filterFrom)) return false;
      if (filterTo && d > new Date(filterTo + 'T23:59:59')) return false;
      return true;
    });
  }

  const active = applyFilter(bookings.filter(b => b.status === 'booked' || b.status === 'checked_in'));
  const past = applyFilter(bookings.filter(b => b.status === 'checked_out' || b.status === 'cancelled'));
  const displayed = tab === 'active' ? active : past;

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black text-gray-900">📋 Bookings</h1>
        <button onClick={() => setShowWalkin(true)} className="btn-primary flex items-center gap-2">
          ➕ Walk-in
        </button>
      </div>

      {/* Date Filter */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4 flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold text-gray-500">Filter by date:</span>
        <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
        <span className="text-gray-400">→</span>
        <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
        {(filterFrom || filterTo) && (
          <button onClick={() => { setFilterFrom(''); setFilterTo(''); }} className="text-red-500 text-sm font-bold">✕ Clear</button>
        )}
        <button onClick={reload} className="ml-auto text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5">↻ Refresh</button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(['active', 'past'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-xl font-bold text-sm capitalize transition-all ${tab === t ? 'bg-primary text-black' : 'bg-white border border-gray-200 text-gray-600'}`}>
            {t} ({t === 'active' ? active.length : past.length})
          </button>
        ))}
      </div>

      {displayed.length === 0 ? (
        <EmptyState icon="📭" title={`No ${tab} bookings`} />
      ) : (
        <div className="space-y-4">
          {displayed.map(b => {
            const isWalkin = b.booking_type === 'walkin';
            const name = isWalkin ? (b.guest_name || 'Walk-in Guest') : (b.user_id?.name || 'Guest');
            const phone = isWalkin ? b.guest_phone : b.user_id?.phone;
            const room = b.room_id ? `Room ${b.room_id.room_number}` : '';

            return (
              <div key={b._id} className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-lg">
                      {isWalkin ? '🚶' : '📱'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-gray-900">{name}</p>
                        {isWalkin && <span className="text-xs bg-primary/20 text-primary font-bold px-2 py-0.5 rounded-full">WALK-IN</span>}
                      </div>
                      {phone && <p className="text-gray-500 text-sm">{phone}</p>}
                      {room && <p className="text-gray-600 text-sm">{room}</p>}
                      {b.booking_source && (
                        <p className="text-xs text-gray-400 mt-0.5">🌐 via {b.booking_source}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-primary">₹{b.display_amount ?? b.charged_amount ?? b.total_price}</p>
                    <StatusBadge status={b.status} />
                    <p className="text-xs text-gray-400 mt-1 capitalize">{b.payment_method || 'cash'}</p>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl px-4 py-2.5 text-sm flex items-center gap-3 mb-3">
                  <span className="text-green-500">↳</span>
                  <span className="font-semibold">{formatDT(b.check_in)}</span>
                  <span className="text-gray-300">→</span>
                  <span className="text-red-400">↲</span>
                  <span className="font-semibold">{formatDT(b.check_out)}</span>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  {b.status === 'booked' && (
                    <button onClick={() => { setOtpDialog(b._id); setOtp(''); }}
                      className="flex-1 bg-green-600 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-green-700 transition-colors">
                      ✅ Check In (OTP)
                    </button>
                  )}
                  {b.status === 'checked_in' && (
                    <button onClick={() => updateStatus(b._id, 'checked_out')}
                      className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors">
                      🔚 Check Out
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* OTP Dialog */}
      {otpDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-black mb-1">🔐 Check-in OTP</h3>
            <p className="text-gray-500 text-sm mb-5">Ask the guest for their 6-digit OTP</p>
            <input type="text" maxLength={6} value={otp} onChange={e => setOtp(e.target.value)}
              placeholder="000000"
              className="w-full text-center text-4xl font-black tracking-widest border-2 border-gray-200 focus:border-primary rounded-xl py-4 mb-5 outline-none" />
            <div className="flex gap-3">
              <button onClick={() => { setOtpDialog(null); setOtp(''); }} className="flex-1 border border-gray-200 rounded-xl py-2.5 font-semibold text-gray-600">Cancel</button>
              <button onClick={() => verifyCheckin(otpDialog)} disabled={otpLoading}
                className="flex-1 bg-green-600 text-white rounded-xl py-2.5 font-bold flex items-center justify-center gap-2">
                {otpLoading ? <Spinner size="sm" /> : null}
                {otpLoading ? 'Verifying...' : 'Verify & Check In'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Walk-in Modal */}
      {showWalkin && hotelId && (
        <WalkinModal hotelId={hotelId} rooms={rooms} token={auth?.token || ''} onClose={() => setShowWalkin(false)} onSuccess={reload} />
      )}
    </div>
  );
}

function WalkinModal({ hotelId, rooms, token, onClose, onSuccess }: { hotelId: string; rooms: any[]; token: string; onClose: () => void; onSuccess: () => void }) {
  const [step, setStep] = useState(1);
  const [duration, setDuration] = useState<number | null>(null);
  const [acFilter, setAcFilter] = useState<boolean | null>(null);
  const [selDate, setSelDate] = useState('');
  const [selTime, setSelTime] = useState('');
  const [availableRooms, setAvailableRooms] = useState<any[]>([]);
  const [selRoom, setSelRoom] = useState<any>(null);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guests, setGuests] = useState(1);
  const [payment, setPayment] = useState<'cash' | 'online'>('cash');
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const headers = { 'Content-Type': 'application/json', 'x-api-token': API_TOKEN, Authorization: `Bearer ${token}` };

  const allDurations = Array.from(new Set<number>(rooms.flatMap((r: any) => (r.pricing || []).map((p: any) => p.hours)))).sort((a, b) => a - b);

  async function fetchRooms() {
    if (!duration || !selDate) return;
    setRoomsLoading(true);
    try {
      const checkIn = selTime ? new Date(`${selDate}T${selTime}`).toISOString() : new Date(`${selDate}T00:00`).toISOString();
      const params = new URLSearchParams({ hotelId, checkIn, duration: String(duration), ...(acFilter !== null ? { ac: String(acFilter) } : {}) });
      const res = await fetch(`${API_ROOT}/api/rooms/available?${params}`, { headers });
      const data = await res.json();
      setAvailableRooms(Array.isArray(data) ? data : []);
    } catch {}
    finally { setRoomsLoading(false); }
  }

  useEffect(() => { if (selDate && duration) fetchRooms(); }, [selDate, selTime, duration, acFilter]);

  function getRoomPrice(room: any) {
    return (room.pricing || []).find((p: any) => p.hours === duration)?.price || 0;
  }

  async function submit() {
    if (!selRoom || !selDate || !selTime || !duration || !guestName) { alert('Fill all required fields'); return; }
    setSubmitting(true);
    try {
      const checkIn = new Date(`${selDate}T${selTime}`).toISOString();
      const res = await fetch(`${API_ROOT}/api/bookings/walkin`, {
        method: 'POST', headers,
        body: JSON.stringify({ hotel_id: hotelId, room_id: selRoom._id, check_in: checkIn, duration_hours: duration, guest_name: guestName, guest_phone: guestPhone, guests, payment_method: payment }),
      });
      const data = await res.json();
      if (res.status === 201) { alert(`✅ Walk-in booking confirmed! Room ${data.summary?.room}`); onSuccess(); onClose(); }
      else alert(data.error || 'Failed');
    } catch { alert('Error'); }
    finally { setSubmitting(false); }
  }

  const checkout = selDate && selTime && duration ? new Date(new Date(`${selDate}T${selTime}`).getTime() + duration * 3600000) : null;
  const price = selRoom ? getRoomPrice(selRoom) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-t-3xl md:rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="font-black text-lg">🚶 Walk-in Booking</h3>
            <p className="text-xs text-gray-400">Direct guest booking</p>
          </div>
          <button onClick={onClose} className="text-gray-400 text-2xl hover:text-gray-600">×</button>
        </div>

        <div className="p-6 space-y-5">
          {/* Step 1: Duration */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">1. Duration</p>
            <div className="flex flex-wrap gap-2">
              {allDurations.map(d => (
                <button key={d} onClick={() => { setDuration(d); setSelRoom(null); }}
                  className={`px-4 py-2 rounded-xl font-bold text-sm border transition-all ${duration === d ? 'bg-primary border-primary' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                  {d}hr
                </button>
              ))}
            </div>
          </div>

          {/* Step 2: AC filter */}
          {duration && (
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">2. Room Type</p>
              <div className="flex gap-2">
                {[['All', null], ['AC', true], ['Non-AC', false]].map(([label, val]) => (
                  <button key={String(label)} onClick={() => { setAcFilter(val as boolean | null); setSelRoom(null); }}
                    className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-all ${acFilter === val ? 'bg-primary border-primary' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                    {String(label)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Date */}
          {duration && (
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">3. Date & Time</p>
              <div className="grid grid-cols-2 gap-3">
                <input type="date" value={selDate} onChange={e => { setSelDate(e.target.value); setSelRoom(null); }} className="input-field" />
                <input type="time" value={selTime} onChange={e => { setSelTime(e.target.value); setSelRoom(null); }} className="input-field" />
              </div>
              {checkout && (
                <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-700 font-semibold">
                  Check-out: {checkout.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}
                </div>
              )}
            </div>
          )}

          {/* Step 4: Rooms */}
          {selDate && duration && (
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">4. Select Room</p>
              {roomsLoading ? <div className="flex justify-center py-4"><Spinner /></div> : (
                <div className="space-y-2">
                  {availableRooms.map(r => {
                    const avail = r.is_available !== false;
                    return (
                      <button key={r._id} onClick={() => avail && setSelRoom(selRoom?._id === r._id ? null : r)} disabled={!avail}
                        className={`w-full text-left p-3 rounded-xl border transition-all ${selRoom?._id === r._id ? 'border-primary bg-primary/10' : avail ? 'border-gray-200 hover:border-gray-300' : 'border-gray-100 opacity-50'}`}>
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="font-bold">Room {r.room_number}</span>
                            <span className="text-gray-500 text-sm ml-2">{r.type?.toUpperCase()}</span>
                            {r.has_ac && <span className="text-xs text-blue-500 ml-2">❄️ AC</span>}
                          </div>
                          <div className="text-right">
                            <p className="font-black text-primary">₹{getRoomPrice(r)}</p>
                            <p className="text-xs text-gray-400">{avail ? '✅ Available' : '❌ Booked'}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Step 5: Guest Details */}
          {selRoom && (
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">5. Guest Details</p>
              <div className="space-y-3">
                <input className="input-field" placeholder="Guest Name *" value={guestName} onChange={e => setGuestName(e.target.value)} />
                <input className="input-field" type="tel" placeholder="Phone Number" value={guestPhone} onChange={e => setGuestPhone(e.target.value)} />
                <div className="flex items-center justify-between border border-gray-200 rounded-xl px-4 py-3">
                  <span className="font-medium text-gray-700">Guests</span>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setGuests(Math.max(1, guests - 1))} className="w-8 h-8 rounded-full border border-gray-200 font-bold">-</button>
                    <span className="font-black text-lg w-6 text-center">{guests}</span>
                    <button onClick={() => setGuests(guests + 1)} className="w-8 h-8 rounded-full bg-primary font-bold">+</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(['cash', 'online'] as const).map(p => (
                    <button key={p} onClick={() => setPayment(p)}
                      className={`py-3 rounded-xl font-bold text-sm border capitalize transition-all ${payment === p ? 'bg-primary border-primary' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                      {p === 'cash' ? '💵' : '💳'} {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Summary & Confirm */}
          {selRoom && guestName && (
            <>
              <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="font-bold">Room {selRoom.room_number} · {duration}hr · {guests} guest(s)</p>
                  <p className="text-sm text-gray-500 capitalize">{payment} payment</p>
                </div>
                <p className="text-2xl font-black text-primary">₹{price}</p>
              </div>
              <button onClick={submit} disabled={submitting}
                className="w-full btn-primary py-3.5 flex items-center justify-center gap-2">
                {submitting ? <Spinner size="sm" /> : null}
                {submitting ? 'Booking...' : `Confirm Walk-in · ₹${price}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
