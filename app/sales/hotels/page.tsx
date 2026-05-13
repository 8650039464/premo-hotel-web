'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { salesApi, formatDate } from '@/lib/api';
import { Spinner, EmptyState, StatusBadge } from '@/components/shared/ui';

interface MyHotel {
  earning_id:    string;
  hotel_name:    string;
  hotel_auth?:   { name?: string; email?: string; phone?: string; status?: string };
  hotel?:        { name?: string; status?: boolean; address?: string };
  amount:        number;
  status:        'pending' | 'credited' | 'cancelled';
  credited_at?:  string;
  registered_at: string;
}

export default function MyHotelsPage() {
  const [list, setList] = useState<MyHotel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'credited' | 'cancelled'>('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { ok, data } = await salesApi.myHotels();
      if (cancelled) return;
      if (ok) setList(Array.isArray(data) ? data : []);
      else    setError(data?.error || 'Failed to load hotels');
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = filter === 'all' ? list : list.filter(h => h.status === filter);

  if (loading) return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900">My Hotels</h1>
          <p className="text-gray-500 text-sm mt-1">Hotels you have onboarded ({list.length} total)</p>
        </div>
        <Link href="/sales/register-hotel" className="btn-primary">+ Register New</Link>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'pending', 'credited', 'cancelled'] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors capitalize ${
              filter === s ? 'bg-primary text-black' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">{error}</div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon="🏩"
          title={filter === 'all' ? 'No hotels yet' : `No ${filter} hotels`}
          desc={filter === 'all' ? 'Onboard your first hotel to start earning' : ''}
        />
      ) : (
        <div className="grid gap-3">
          {filtered.map(h => (
            <div key={h.earning_id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-gray-900 text-lg">{h.hotel_name}</h3>
                    <StatusBadge status={h.status} />
                  </div>
                  <div className="text-sm text-gray-500 mt-1 space-y-0.5">
                    {h.hotel_auth?.email && <div>📧 {h.hotel_auth.email}</div>}
                    {h.hotel_auth?.phone && <div>📞 {h.hotel_auth.phone}</div>}
                    {h.hotel?.address && <div>📍 {h.hotel.address}</div>}
                    <div className="text-xs text-gray-400 mt-1">
                      Registered: {formatDate(h.registered_at)}
                      {h.credited_at && ` · Credited: ${formatDate(h.credited_at)}`}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-2xl font-black ${
                    h.status === 'credited'  ? 'text-green-600'  :
                    h.status === 'pending'   ? 'text-orange-600' :
                                               'text-gray-400 line-through'
                  }`}>
                    ₹{h.amount.toLocaleString('en-IN')}
                  </div>
                  <div className="text-xs text-gray-500">commission</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
