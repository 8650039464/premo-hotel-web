'use client';
import { useState, useEffect } from 'react';
import { supremeApi, formatDate } from '@/lib/api';
import { Spinner, EmptyState, StatusBadge } from '@/components/shared/ui';

// ─────────────────────────────────────────────────────────────
//  SUPER ADMIN — COMPLAINTS
//  /p/supreme/complaints — list + inline status update.
// ─────────────────────────────────────────────────────────────

const STATUSES = ['open', 'in_progress', 'resolved', 'closed'];

export default function SuperAdminComplaintsPage() {
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState<'open' | 'resolved'>('open');
  const [updating, setUpdating]     = useState<string | null>(null);
  const [err, setErr]               = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setErr('');
    try {
      const res = await supremeApi.listComplaints();
      if (res.ok && Array.isArray(res.data)) {
        setComplaints(res.data);
      } else {
        setComplaints([]);
        setErr(res.data?.error || 'Failed to load complaints.');
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

  async function updateStatus(id: string, status: string) {
    setUpdating(id);
    setErr('');
    try {
      const res = await supremeApi.setComplaintStatus(id, status);
      if (res.ok) {
        setComplaints(prev => prev.map(c => c._id === id ? { ...c, status } : c));
      } else {
        setErr(res.data?.error || 'Status update failed.');
      }
    } catch {
      setErr('Network error while updating status.');
    } finally {
      setUpdating(null);
    }
  }

  const open     = complaints.filter(c => c.status === 'open' || c.status === 'in_progress');
  const resolved = complaints.filter(c => c.status === 'resolved' || c.status === 'closed');
  const displayed = tab === 'open' ? open : resolved;

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div>
      <h1 className="text-2xl font-black text-gray-900 mb-6">💬 All Complaints</h1>

      {err && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm mb-4">
          {err}
        </div>
      )}

      <div className="flex gap-2 mb-6 items-center">
        {(['open', 'resolved'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-xl font-bold text-sm capitalize ${tab === t ? 'bg-primary text-black' : 'bg-white border border-gray-200 text-gray-600'}`}>
            {t} ({t === 'open' ? open.length : resolved.length})
          </button>
        ))}
        <button onClick={load} className="ml-auto px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-xl">↻</button>
      </div>

      {displayed.length === 0 ? (
        <EmptyState icon={tab === 'open' ? '🎉' : '📭'} title={tab === 'open' ? 'No open complaints!' : 'No resolved complaints'} />
      ) : (
        <div className="space-y-4">
          {displayed.map(c => {
            const hotel = c.hotel_id?.name || 'Hotel';
            const user  = c.user_id?.name  || 'User';
            const email = c.user_id?.email || '';

            return (
              <div key={c._id} className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-bold text-gray-900">{hotel}</p>
                    <p className="text-gray-600 text-sm">{user} · {email}</p>
                    <p className="text-gray-400 text-xs">{formatDate(c.createdAt)}</p>
                  </div>
                  <StatusBadge status={c.status} />
                </div>

                <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-700 mb-4">{c.description}</div>

                <div className="flex flex-wrap gap-2">
                  {STATUSES.filter(s => s !== c.status).map(s => (
                    <button key={s} onClick={() => updateStatus(c._id, s)} disabled={updating === c._id}
                      className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-bold text-gray-600 hover:border-primary hover:text-primary transition-colors capitalize disabled:opacity-50">
                      → {s.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
