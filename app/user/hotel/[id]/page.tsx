'use client';
import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { getAuth, API_BASE, API_ROOT, API_TOKEN, createPaymentOrder, verifyPayment, loadRazorpay, APP_NAME, getWalletBalance } from '@/lib/api';
import { useBrand, withMarkup, brandFirmHeader } from '@/lib/brand';
import { Spinner } from '@/components/shared/ui';

export default function HotelDetailPage() {
  const { id }         = useParams();
  const searchParams   = useSearchParams();
  const router         = useRouter();
  const auth           = getAuth();

  const initDate     = searchParams.get('date') || '';
  const initTime     = searchParams.get('time') || '';
  const initDuration = searchParams.get('duration') ? Number(searchParams.get('duration')) : null;

  const [hotel, setHotel]     = useState<any>(null);
  const [rooms, setRooms]     = useState<any[]>([]);
  const [photos, setPhotos]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingRoom, setBookingRoom] = useState<any>(null);

  // Booking state
  const [selDuration, setSelDuration] = useState<number | null>(initDuration);
  const [extraDays, setExtraDays]     = useState(0);
  const [selDate, setSelDate]         = useState(initDate);
  const [selTime, setSelTime]         = useState(initTime);
  const [guests, setGuests]           = useState(1);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState<any>(null);

  // Wallet
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletToUse, setWalletToUse]     = useState(0);

  // brandFirmHeader() includes X-Premo-Firm only on custom domains — backend
  // uses it to credit the developer's wallet for the markup on this booking.
  const brand   = useBrand();
  const headers = {
    'Content-Type': 'application/json',
    'x-api-token':  API_TOKEN,
    Authorization:  `Bearer ${auth?.token}`,
    ...brandFirmHeader(),
  };

  useEffect(() => {
    async function load() {
      try {
        const [hotelRes, roomsRes, photosRes] = await Promise.all([
          fetch(`${API_ROOT}/api/hotels/all`, { headers }).then(r => r.json()),
          fetch(`${API_ROOT}/api/rooms/hotel/${id}`, { headers }).then(r => r.json()),
          fetch(`${API_ROOT}/api/photos/hotel/${id}`, { headers }).then(r => r.json()),
        ]);
        const hotelData = Array.isArray(hotelRes) ? hotelRes.find((h: any) => h._id === id) : null;
        setHotel(hotelData);
        setRooms(Array.isArray(roomsRes) ? roomsRes : []);
        setPhotos(Array.isArray(photosRes) ? photosRes : []);
      } catch {}
      finally { setLoading(false); }
    }
    load();

    // Load wallet if logged in
    if (auth?.token) {
      getWalletBalance(auth.token).then(d => setWalletBalance(d.wallet_amount || 0));
    }
  }, [id]);

  function photoUrl(p: string) { return p.startsWith('http') ? p : `${API_BASE}${p}`; }

  // Returns the display price for a given duration — applies the additive
  // markup (Premo brokerage + developer markup) so the user always sees
  // the actual amount they'll pay. Backend re-computes at payment time
  // as the authoritative source; this is purely for display.
  function getPriceForDuration(room: any, dur: number) {
    const pricing = room.pricing || [];
    const match = pricing.find((p: any) => p.hours === dur);
    return match ? withMarkup(match.price, brand) : null;
  }
  function getRawPriceForDuration(room: any, dur: number) {
    const pricing = room.pricing || [];
    const match = pricing.find((p: any) => p.hours === dur);
    return match ? match.price : null;
  }

  function getAllDurations() {
    const s = new Set<number>();
    rooms.forEach(r => (r.pricing || []).forEach((p: any) => s.add(p.hours)));
    return Array.from(s).sort((a, b) => a - b);
  }

  const totalHours = selDuration === 24 ? 24 * (1 + extraDays) : (selDuration || 0);

  function checkoutTime() {
    if (!selDate || !selTime || !selDuration) return null;
    return new Date(new Date(`${selDate}T${selTime}`).getTime() + totalHours * 3600000);
  }

  function getPrice(room: any) {
    if (!selDuration) return null;
    const base = getPriceForDuration(room, selDuration);
    if (!base) return null;
    return selDuration === 24 ? base * (1 + extraDays) : base;
  }

  async function book() {
    if (!bookingRoom || !selDuration || !selDate || !selTime) return;
    if (!auth?.token) { router.push('/user/login'); return; }

    setBookingLoading(true);
    try {
      const checkIn  = new Date(`${selDate}T${selTime}`).toISOString();
      const checkOut = new Date(new Date(`${selDate}T${selTime}`).getTime() + totalHours * 3600000).toISOString();

      const { ok, status, data } = await createPaymentOrder(auth.token, {
        hotel_id:            id,
        room_id:             bookingRoom._id,
        check_in:            checkIn,
        check_out:           checkOut,
        duration_hours:      totalHours,
        guests,
        payment_method:      walletToUse > 0 ? 'mixed' : 'online',
        wallet_amount_to_use: walletToUse,
      });

      if (!ok) { alert(data.error || 'Failed to create order'); setBookingLoading(false); return; }

      // Full wallet payment — no Razorpay
      if (data.requires_payment === false) {
        setBookingSuccess({ otp: data.checkin_otp, walletPaid: data.paid_via_wallet });
        setBookingRoom(null);
        setWalletBalance(prev => prev - (data.paid_via_wallet || 0));
        setBookingLoading(false);
        return;
      }

      // Load Razorpay and open
      const loaded = await loadRazorpay();
      if (!loaded) { alert('Razorpay failed to load. Check internet.'); setBookingLoading(false); return; }

      const options = {
        key:         data.key_id,
        amount:      data.amount * 100,
        currency:    'INR',
        order_id:    data.order_id,
        name:        APP_NAME,
        description: `Room booking — ${totalHours}hr`,
        theme:       { color: '#FDC507' },
        handler: async (response: any) => {
          setBookingLoading(true);
          const { ok: vOk, data: vData } = await verifyPayment(auth!.token, {
            booking_id:           data.booking_id,
            razorpay_order_id:    response.razorpay_order_id,
            razorpay_payment_id:  response.razorpay_payment_id,
            razorpay_signature:   response.razorpay_signature,
          });
          setBookingLoading(false);
          if (vOk) {
            setBookingSuccess({ otp: vData.checkin_otp, walletPaid: walletToUse });
            setBookingRoom(null);
            setWalletBalance(prev => prev - walletToUse);
          } else {
            alert(vData.error || 'Payment verification failed');
          }
        },
        modal: { ondismiss: () => setBookingLoading(false) },
      };

      new (window as any).Razorpay(options).open();
    } catch (e) {
      alert('Error: ' + (e as Error).message);
      setBookingLoading(false);
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  if (!hotel) return <div className="text-center py-20 text-gray-500">Hotel not found</div>;

  const allDurations = getAllDurations();
  const checkout     = checkoutTime();

  return (
    <div>
      {/* Back */}
      <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-800 text-sm font-medium mb-4 flex items-center gap-1">
        ← Back to hotels
      </button>

      {/* Hero */}
      <div className="relative h-56 md:h-72 rounded-2xl overflow-hidden mb-6 bg-gradient-to-br from-primary to-yellow-400">
        {photos[0] ? (
          <img src={photoUrl(photos[0].photo)} alt={hotel.name} className="w-full h-full object-cover" />
        ) : (
          <div className="flex items-center justify-center h-full text-7xl">🏨</div>
        )}
        {photos.length > 1 && (
          <div className="absolute bottom-3 right-3 flex gap-2">
            {photos.slice(1, 5).map((p, i) => (
              <img key={i} src={photoUrl(p.photo)} alt="" className="w-12 h-12 rounded-lg object-cover border-2 border-white/60" />
            ))}
          </div>
        )}
      </div>

      {/* Hotel Info */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6">
        <h1 className="text-2xl font-black text-gray-900 mb-1">{hotel.name}</h1>
        {hotel.city && <p className="text-gray-500 text-sm mb-2">📍 {typeof hotel.city === 'object' ? hotel.city.name : hotel.city}{hotel.address ? `, ${hotel.address}` : ''}</p>}
        {hotel.desc && <p className="text-gray-600 text-sm">{hotel.desc}</p>}
      </div>

      {/* Search Criteria */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">📅 Select Your Stay</h2>

        {/* Duration */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Duration</label>
          <div className="flex flex-wrap gap-2">
            {allDurations.map(d => (
              <button key={d} onClick={() => { setSelDuration(d); setExtraDays(0); }}
                className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${selDuration === d ? 'bg-primary border-primary' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                {d}hr
              </button>
            ))}
          </div>
        </div>

        {/* Multi-day counter for 24hr */}
        {selDuration === 24 && (
          <div className="flex items-center gap-4 bg-primary/10 border border-primary/30 rounded-xl px-4 py-3 mb-4">
            <span className="text-sm font-semibold text-gray-700">Days:</span>
            <button onClick={() => setExtraDays(Math.max(0, extraDays - 1))}
              className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center font-bold hover:bg-gray-50 disabled:opacity-30"
              disabled={extraDays === 0}>−</button>
            <span className="font-black text-lg w-6 text-center">{1 + extraDays}</span>
            <button onClick={() => setExtraDays(extraDays + 1)}
              className="w-8 h-8 rounded-full bg-primary flex items-center justify-center font-bold hover:bg-primary-dark">+</button>
            <span className="text-sm text-gray-500">= {totalHours} hrs total</span>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Check-in Date</label>
            <input type="date" value={selDate} onChange={e => setSelDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]} className="input-field" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Check-in Time</label>
            <input type="time" value={selTime} onChange={e => setSelTime(e.target.value)} className="input-field" />
          </div>
        </div>

        {checkout && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 text-sm text-blue-700 font-semibold">
            🕐 Check-out: {checkout.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}
          </div>
        )}
      </div>

      {/* Rooms */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">🛏️ Available Rooms</h2>
        {rooms.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No rooms available</div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {rooms.map(room => {
              const available = room.is_available !== false;
              const price     = getPrice(room);
              const typeColors: Record<string, string> = {
                single: 'bg-blue-50 text-blue-700', double: 'bg-green-50 text-green-700',
                suite: 'bg-purple-50 text-purple-700', deluxe: 'bg-orange-50 text-orange-700'
              };
              const tc = typeColors[room.type] || 'bg-gray-50 text-gray-700';

              return (
                <div key={room._id} className={`bg-white rounded-2xl border p-5 ${available ? 'border-gray-100 hover:border-primary/30' : 'border-gray-100 opacity-60'} transition-all`}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded-lg text-xs font-bold uppercase ${tc}`}>{room.type}</span>
                        {room.has_ac && <span className="text-xs text-blue-600 font-semibold">❄️ AC</span>}
                      </div>
                      <p className="text-xl font-black text-gray-900">Room {room.room_number}</p>
                      <p className="text-gray-500 text-sm">{room.capacity || 1} guest(s)</p>
                    </div>
                    <div className="text-right">
                      {price ? (
                        <>
                          <p className="text-2xl font-black text-primary">₹{price}</p>
                          <p className="text-xs text-gray-400">for {totalHours}hr</p>
                        </>
                      ) : <div className="text-sm text-gray-400">Select duration</div>}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {(room.pricing || []).map((p: any) => (
                      <span key={p.hours} className={`px-2.5 py-1 rounded-lg text-xs font-bold ${selDuration === p.hours ? 'bg-primary' : 'bg-gray-100 text-gray-600'}`}>
                        {/* withMarkup applies brokerage + dev markup (compound)
                            so chip price matches the modal + Razorpay charge */}
                        {p.hours}hr · ₹{withMarkup(p.price, brand)}
                      </span>
                    ))}
                  </div>

                  {available ? (
                    // <button onClick={() => { setBookingRoom(room); setWalletToUse(0); }}
                    //   disabled={!selDuration || !selDate || !selTime}
                    //   className="w-full btn-primary py-2.5 disabled:opacity-40">
                    //   {!selDuration ? 'Select duration first' : !selDate || !selTime ? 'Select date & time' : 'Book This Room'}
                    // </button>
                    <button onClick={() => {
                        if (!auth?.token) {
                            router.push('/user/login?redirect=' + encodeURIComponent(window.location.pathname + window.location.search));
                            return;
                        }
                        setBookingRoom(room);
                        setWalletToUse(0);
                      }}
                      disabled={!selDuration || !selDate || !selTime}
                      className="w-full btn-primary py-2.5 disabled:opacity-40">
                      {!selDuration ? 'Select duration first' : !selDate || !selTime ? 'Select date & time' : 'Book This Room'}
                    </button>
                  ) : (
                    <div className="w-full text-center py-2.5 bg-red-50 text-red-500 font-bold rounded-xl text-sm">Currently Booked</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Booking Modal */}
      {bookingRoom && (() => {
        const price = getPrice(bookingRoom) || 0;
        const walletMax = Math.min(walletBalance, price);
        const onlineAmt = Math.max(0, price - walletToUse);

        return (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 px-4">
            <div className="bg-white rounded-t-3xl md:rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-lg font-black">Confirm Booking</h3>
                  <p className="text-gray-500 text-sm">Room {bookingRoom.room_number} · {bookingRoom.type?.toUpperCase()}</p>
                </div>
                <button onClick={() => setBookingRoom(null)} className="text-gray-400 text-2xl hover:text-gray-600">×</button>
              </div>

              <div className="space-y-3 mb-5">
                <div className="flex justify-between text-sm"><span className="text-gray-500">Duration</span><span className="font-bold">{totalHours}hr</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">Check-in</span><span className="font-bold">{selDate} {selTime}</span></div>
                {checkout && <div className="flex justify-between text-sm"><span className="text-gray-500">Check-out</span><span className="font-bold">{checkout.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}</span></div>}

                {/* Guests */}
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 text-sm">Guests</span>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setGuests(Math.max(1, guests - 1))} className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center font-bold text-lg hover:bg-gray-50">-</button>
                    <span className="font-bold text-lg w-6 text-center">{guests}</span>
                    <button onClick={() => setGuests(guests + 1)} className="w-8 h-8 rounded-full bg-primary flex items-center justify-center font-bold text-lg hover:bg-primary-dark">+</button>
                  </div>
                </div>

                {/* Wallet slider */}
                {auth?.token && walletBalance > 0 && (
                  <div className="bg-primary/10 border border-primary/30 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold">💳 Wallet Balance: ₹{walletBalance}</span>
                      {walletToUse > 0 && <span className="text-xs font-bold text-green-700">- ₹{walletToUse}</span>}
                    </div>
                    <input type="range" min={0} max={walletMax} step={10}
                      value={walletToUse} onChange={e => setWalletToUse(Number(e.target.value))}
                      className="w-full accent-primary" />
                    <p className="text-xs text-gray-500 mt-1">
                      {walletToUse >= price
                        ? 'Full payment from wallet (₹0 online)'
                        : walletToUse > 0
                        ? `₹${walletToUse} from wallet + ₹${onlineAmt} online`
                        : 'Slide to use wallet balance'}
                    </p>
                  </div>
                )}

                <div className="border-t pt-3">
                  {walletToUse > 0 && (
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-500">Wallet</span>
                      <span className="font-bold text-green-600">- ₹{walletToUse}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="font-bold">{walletToUse >= price ? 'Wallet Payment' : 'To Pay Online'}</span>
                    <span className="text-xl font-black text-primary">₹{onlineAmt}</span>
                  </div>
                </div>
              </div>

              <button onClick={book} disabled={bookingLoading}
                className="btn-primary w-full flex items-center justify-center gap-2">
                {bookingLoading ? <Spinner size="sm" /> : null}
                {bookingLoading ? 'Processing...' : walletToUse >= price ? `Pay ₹${price} via Wallet` : `Pay ₹${onlineAmt}${walletToUse > 0 ? ' + Wallet' : ''}`}
              </button>
            </div>
          </div>
        );
      })()}

      {/* Success Modal */}
      {bookingSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">✅</span>
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-2">Booking Confirmed!</h3>
            {bookingSuccess.walletPaid > 0 && (
              <p className="text-sm text-gray-500 mb-3">₹{bookingSuccess.walletPaid} paid from wallet</p>
            )}
            {bookingSuccess.otp && (
              <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 mb-4">
                <p className="text-xs font-bold text-gray-600 uppercase mb-1">🔐 Check-in OTP</p>
                <p className="text-4xl font-black tracking-[0.4em] text-gray-900">{bookingSuccess.otp}</p>
                <p className="text-xs text-gray-500 mt-1">Show to hotel staff at check-in</p>
              </div>
            )}
            <button onClick={() => { setBookingSuccess(null); router.push('/user/bookings'); }}
              className="btn-primary w-full">View My Bookings</button>
          </div>
        </div>
      )}
    </div>
  );
}
