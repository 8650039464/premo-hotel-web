'use client';
import { useEffect, useState } from 'react';
import { getDevAuth, devApi, formatDT } from '@/lib/api';
import { Spinner } from '@/components/shared/ui';

interface BookingRow {
  _id: string;
  hotel_id?: { name?: string };
  room_id?:  { room_number?: string; type?: string };
  check_in?: string; check_out?: string;
  total_price?: number;
  dev_markup_amount?: number;
  dev_markup_settled?: boolean;
  createdAt?: string;
}
interface Pagination { total: number; page: number; limit: number; pages: number; }
interface Summary     { total_markup_earned: number; settled: number; pending: number; wallet_balance: number; }

export default function DeveloperEarningsPage() {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [summary, setSummary]   = useState<Summary | null>(null);
  const [page, setPage]         = useState(1);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  async function load(p: number) {
    const auth = getDevAuth();
    if (!auth) return;
    setLoading(true); setError('');
    try {
      const { ok, data } = await devApi.earnings(auth.token, p);
      if (ok) {
        setBookings(data.bookings || []);
        setPagination(data.pagination || null);
        setSummary(data.summary || null);
      } else setError(data.error || 'Failed to load');
    } catch { setError('Connection error'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(page); }, [page]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-gray-900">💰 Earnings</h1>

      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <SummaryCell label="Total Earned" value={`₹${(summary.total_markup_earned ?? 0).toLocaleString('en-IN')}`} />
          <SummaryCell label="Settled"      value={`₹${(summary.settled            ?? 0).toLocaleString('en-IN')}`} />
          <SummaryCell label="Pending"      value={`₹${(summary.pending            ?? 0).toLocaleString('en-IN')}`} />
          <SummaryCell label="Wallet"       value={`₹${(summary.wallet_balance     ?? 0).toLocaleString('en-IN')}`} />
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold">Recent Bookings</h2>
          {pagination && <span className="text-xs text-gray-500">{pagination.total} total</span>}
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : error ? (
          <div className="px-6 py-8 text-red-600 text-sm">{error}</div>
        ) : bookings.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400 text-sm">
            Abhi koi booking nahi hai. Jab aapke app se booking hogi, yahan dikhegi.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
                <tr>
                  <th className="text-left px-6 py-3 font-semibold">Date</th>
                  <th className="text-left px-6 py-3 font-semibold">Hotel / Room</th>
                  <th className="text-right px-6 py-3 font-semibold">Base Price</th>
                  <th className="text-right px-6 py-3 font-semibold">Markup</th>
                  <th className="text-center px-6 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map(b => (
                  <tr key={b._id} className="border-t border-gray-100">
                    <td className="px-6 py-3 text-gray-600">{formatDT(b.createdAt)}</td>
                    <td className="px-6 py-3">
                      <div className="font-semibold">{b.hotel_id?.name || 'Hotel'}</div>
                      <div className="text-xs text-gray-400">
                        {b.room_id?.room_number ? `Room ${b.room_id.room_number}` : 'Room'} · {b.room_id?.type || ''}
                      </div>
                    </td>
                    <td className="px-6 py-3 text-right">₹{(b.total_price ?? 0).toLocaleString('en-IN')}</td>
                    <td className="px-6 py-3 text-right font-semibold text-emerald-700">
                      ₹{(b.dev_markup_amount ?? 0).toLocaleString('en-IN')}
                    </td>
                    <td className="px-6 py-3 text-center">
                      {b.dev_markup_settled
                        ? <span className="px-2 py-0.5 text-xs font-bold bg-emerald-100 text-emerald-700 rounded-full">Settled</span>
                        : <span className="px-2 py-0.5 text-xs font-bold bg-amber-100 text-amber-700 rounded-full">Pending</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination && pagination.pages > 1 && (
          <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between text-sm">
            <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40">← Prev</button>
            <span className="text-gray-500">Page {pagination.page} / {pagination.pages}</span>
            <button disabled={page >= pagination.pages} onClick={() => setPage(p => p + 1)}
              className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40">Next →</button>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <div className="text-xs font-semibold text-gray-500 mb-1">{label}</div>
      <div className="text-xl font-black">{value}</div>
    </div>
  );
}
