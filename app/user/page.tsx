'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth, API_BASE, API_ROOT, API_TOKEN, formatDT } from '@/lib/api';
import { useBrand, withMarkup } from '@/lib/brand';
import { Spinner, EmptyState, StatusBadge } from '@/components/shared/ui';
import Link from 'next/link';

interface City { _id: string; name: string; }
interface Hotel {
  _id: string; name: string; address: string; city: any; desc?: string;
  photos?: { photo: string }[]; rooms?: any[]; distance_km?: number;
}

export default function UserHomePage() {
  const router = useRouter();
  const auth = getAuth();

  const [cities, setCities] = useState<City[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Filters
  const [selectedCity, setSelectedCity] = useState('');
  const [nameQuery, setNameQuery] = useState('');
  const [checkinDate, setCheckinDate] = useState('');
  const [checkinTime, setCheckinTime] = useState('');
  const [duration, setDuration] = useState<number | null>(null);
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(5000);

  // Brand-aware price display: applies Premo brokerage + dev markup (custom
  // domain only). On Premo's default domain, just brokerage. Backend
  // re-computes authoritatively at payment time.
  const brand = useBrand();

  const headers = { 'Content-Type': 'application/json', 'x-api-token': API_TOKEN, ...(auth?.token ? { Authorization: `Bearer ${auth.token}` } : {}) };

  // useEffect(() => {
  //   fetch(`${API_ROOT}/api/cities/all`, { headers })
  //     .then(r => r.json()).then(setCities).catch(() => {});
  // }, []);
  useEffect(() => {
    fetch(`${API_ROOT}/api/cities/all`, { headers })
      .then(r => r.json()).then(setCities).catch(() => {});
    // Page load pe seedha hotels fetch karo
    search();
  }, []);

  async function search() {
    setLoading(true); setSearched(true);
    try {
      const url = selectedCity ? `${API_ROOT}/api/hotels/all?city=${selectedCity}` : `${API_ROOT}/api/hotels/all`;
      const res = await fetch(url, { headers });
      const data = await res.json();
      let filtered = Array.isArray(data) ? data : [];
      if (nameQuery) filtered = filtered.filter((h: Hotel) => h.name.toLowerCase().includes(nameQuery.toLowerCase()));
      if (duration) filtered = filtered.filter((h: Hotel) => {
        const rooms = h.rooms || [];
        return rooms.some((r: any) => (r.pricing || []).some((p: any) => p.hours === duration));
      });
      setHotels(filtered);
    } catch { setHotels([]); }
    finally { setLoading(false); }
  }

  function photoUrl(h: Hotel) {
    const p = h.photos?.[0]?.photo;
    if (!p) return null;
    return p.startsWith('http') ? p : `${API_BASE}${p}`;
  }

  function cityName(h: Hotel) {
    if (!h.city) return '';
    if (typeof h.city === 'object') return h.city.name || '';
    return h.city;
  }

  function minRoomPrice(h: Hotel) {
    const rooms = h.rooms || [];
    let min: number | null = null;
    rooms.forEach((r: any) => (r.pricing || []).forEach((p: any) => {
      if (min === null || p.price < min) min = p.price;
    }));
    // Apply brokerage + markup so listings reflect the user-facing total
    // (matches what the hotel detail page will show).
    return min !== null ? withMarkup(min, brand) : null;
  }

  const durations = [3, 6, 12, 24];

  return (
    <div>
      {/* Search Panel */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">🔍 Find Your Hotel</h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {/* City */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">City</label>
            <select value={selectedCity} onChange={e => setSelectedCity(e.target.value)} className="input-field">
              <option value="">All Cities</option>
              {cities.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>

          {/* Check-in Date */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Check-in Date</label>
            <input type="date" value={checkinDate} onChange={e => setCheckinDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]} className="input-field" />
          </div>

          {/* Check-in Time */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Check-in Time</label>
            <input type="time" value={checkinTime} onChange={e => setCheckinTime(e.target.value)} className="input-field" />
          </div>

          {/* Hotel Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Hotel Name</label>
            <input type="text" placeholder="Search by name..." value={nameQuery}
              onChange={e => setNameQuery(e.target.value)} className="input-field" />
          </div>
        </div>

        {/* Duration chips */}
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide self-center mr-1">Duration:</span>
          <button onClick={() => setDuration(null)}
            className={`px-4 py-1.5 rounded-full text-sm font-bold border transition-all ${!duration ? 'bg-primary border-primary' : 'bg-white border-gray-200 text-gray-600'}`}>
            Any
          </button>
          {durations.map(d => (
            <button key={d} onClick={() => setDuration(duration === d ? null : d)}
              className={`px-4 py-1.5 rounded-full text-sm font-bold border transition-all ${duration === d ? 'bg-primary border-primary' : 'bg-white border-gray-200 text-gray-600'}`}>
              {d}hr
            </button>
          ))}
        </div>

        <button onClick={search} className="btn-primary px-8">
          🔍 Search Hotels
        </button>
      </div>

      {/* Checkout Preview */}
      {checkinDate && checkinTime && duration && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-4 flex items-center gap-3">
          <span>🕐</span>
          <div>
            <span className="text-sm font-semibold text-blue-700">Check-out: </span>
            <span className="text-sm text-blue-600">
              {new Date(new Date(`${checkinDate}T${checkinTime}`).getTime() + duration * 3600000).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}
            </span>
          </div>
        </div>
      )}

      {/* Results */}
      {loading && (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      )}

      {!loading && searched && hotels.length === 0 && (
        <EmptyState icon="🏨" title="No hotels found" desc="Try changing your filters or search in a different city" />
      )}

      

      {!loading && hotels.length > 0 && (
        <div>
          <p className="text-sm text-gray-500 mb-4 font-medium">{hotels.length} hotel{hotels.length !== 1 ? 's' : ''} found</p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {hotels.map(h => (
              <Link key={h._id} href={`/user/hotel/${h._id}?${new URLSearchParams({ date: checkinDate, time: checkinTime, ...(duration ? { duration: String(duration) } : {}) }).toString()}`}>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden cursor-pointer group">
                  {/* Photo */}
                  <div className="h-40 bg-gradient-to-br from-primary to-yellow-400 relative overflow-hidden">
                    {photoUrl(h) ? (
                      <img src={photoUrl(h)!} alt={h.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex items-center justify-center h-full text-5xl opacity-80">🏨</div>
                    )}
                    {h.distance_km && (
                      <div className="absolute top-2 right-2 bg-black/60 text-white text-xs font-bold px-2 py-1 rounded-full">
                        📍 {Number(h.distance_km).toFixed(1)} km
                      </div>
                    )}
                  </div>

                  <div className="p-4">
                    <h3 className="font-bold text-gray-900 text-lg mb-1 group-hover:text-primary transition-colors">{h.name}</h3>
                    {cityName(h) && (
                      <p className="text-gray-500 text-sm mb-2">📍 {cityName(h)}{h.address ? ` • ${h.address}` : ''}</p>
                    )}
                    <div className="flex items-center justify-between mt-3">
                      {minRoomPrice(h) !== null ? (
                        <div className="bg-green-50 text-green-700 text-sm font-bold px-3 py-1 rounded-lg">
                          From ₹{minRoomPrice(h)}/hr
                        </div>
                      ) : <div />}
                      <span className="text-gray-400 text-xs font-medium">View rooms →</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
