'use client';
import { useState, useEffect } from 'react';
import { getAuth, API_ROOT, API_TOKEN, formatDate } from '@/lib/api';
import { Spinner, EmptyState, StatusBadge } from '@/components/shared/ui';

const STATUSES = ['open', 'in_progress', 'resolved', 'closed'];

export default function HotelComplaintsPage() {
  const auth = getAuth();
  const [complaints, setComplaints] = useState<any[]>([]);
  const [hotelId, setHotelId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'open' | 'resolved'>('open');
  const [updating, setUpdating] = useState<string | null>(null);

  const headers = { 'Content-Type': 'application/json', 'x-api-token': API_TOKEN, Authorization: `Bearer ${auth?.token}` };

  useEffect(() => {
    async function init() {
      try {
        const hotelRes = await fetch(`${API_ROOT}/api/hotels/my`, { headers });
        if (!hotelRes.ok) { setLoading(false); return; }
        const hotelData = await hotelRes.json();
        const hid = hotelData?.hotel?._id;
        setHotelId(hid);
        if (hid) await loadComplaints(hid);
      } catch {}
      finally { setLoading(false); }
    }
    init();
  }, []);

  async function loadComplaints(hid: string) {
    const res = await fetch(`${API_ROOT}/api/complaints/hotel/${hid}`, { headers });
    setComplaints(res.ok ? await res.json() : []);
  }

  async function updateStatus(id: string, status: string) {
    setUpdating(id);
    try {
      await fetch(`${API_ROOT}/api/complaints/status/${id}`, { method: 'PUT', headers, body: JSON.stringify({ status }) });
      if (hotelId) await loadComplaints(hotelId);
    } catch {}
    finally { setUpdating(null); }
  }

  const open = complaints.filter(c => c.status === 'open' || c.status === 'in_progress');
  const resolved = complaints.filter(c => c.status === 'resolved' || c.status === 'closed');
  const displayed = tab === 'open' ? open : resolved;

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div>
      <h1 className="text-2xl font-black text-gray-900 mb-6">💬 Complaints</h1>

      <div className="flex gap-2 mb-6">
        {(['open', 'resolved'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-xl font-bold text-sm capitalize ${tab === t ? 'bg-primary text-black' : 'bg-white border border-gray-200 text-gray-600'}`}>
            {t} ({t === 'open' ? open.length : resolved.length})
          </button>
        ))}
        <button onClick={() => hotelId && loadComplaints(hotelId)} className="ml-auto px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-xl">↻</button>
      </div>

      {displayed.length === 0 ? (
        <EmptyState icon={tab === 'open' ? '🎉' : '📭'} title={tab === 'open' ? 'No open complaints!' : 'No resolved complaints'} />
      ) : (
        <div className="space-y-4">
          {displayed.map(c => {
            const user = c.user_id?.name || 'User';
            const phone = c.user_id?.phone || '';
            return (
              <div key={c._id} className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-bold text-gray-900">{user}</p>
                    {phone && <p className="text-gray-500 text-sm">{phone}</p>}
                    <p className="text-gray-400 text-xs mt-0.5">{formatDate(c.createdAt)}</p>
                  </div>
                  <StatusBadge status={c.status} />
                </div>

                <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-700 mb-4">{c.description}</div>

                {/* Status Buttons */}
                {tab === 'open' && (
                  <div className="flex flex-wrap gap-2">
                    {STATUSES.filter(s => s !== c.status).map(s => (
                      <button key={s} onClick={() => updateStatus(c._id, s)} disabled={updating === c._id}
                        className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-bold text-gray-600 hover:border-primary hover:text-primary transition-colors capitalize">
                        → {s.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
