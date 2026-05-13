'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { salesApi, clearAuth } from '@/lib/api';
import { Spinner, EmptyState, ConfirmDialog } from '@/components/shared/ui';

interface City { _id: string; name: string; state?: string; }
interface Profile {
  user:    { name?: string; email?: string; phone?: string; status?: string };
  profile: {
    wallet_amount:    number;
    pending_amount:   number;
    total_registered: number;
    total_earned:     number;
    is_blocked:       boolean;
    assigned_cities:  City[];
  };
  policy: {
    earning_per_hotel:    number;
    max_earning_per_month: number;
    min_payout:           number;
  };
}

export default function SalesAccountPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showLogout, setShowLogout] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { ok, data } = await salesApi.profile();
      if (cancelled) return;
      if (ok) setProfile(data as Profile);
      else    setError(data?.error || 'Failed to load profile');
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  function logout() {
    clearAuth();
    router.replace('/sales/login');
  }

  if (loading) return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;
  if (error || !profile) return <EmptyState icon="⚠️" title="Could not load account" desc={error} />;

  const u = profile.user;
  const p = profile.profile;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900">My Account</h1>
        <p className="text-gray-500 text-sm mt-1">Profile & territory details.</p>
      </div>

      {/* Profile */}
      <div className="card">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center text-2xl font-black text-gray-900">
            {(u.name?.[0] || 'S').toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{u.name || 'Sales Agent'}</h2>
            <span className="inline-block mt-1 px-2.5 py-0.5 bg-primary/15 text-gray-700 text-xs font-bold rounded-full uppercase">
              Sales Partner
            </span>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-3 text-sm">
          <Row label="Email" value={u.email || '—'} />
          <Row label="Phone" value={u.phone || '—'} />
          <Row label="Account Status" value={u.status || 'active'} valueClass={u.status === 'active' ? 'text-green-600 capitalize' : 'text-orange-600 capitalize'} />
          {p.is_blocked && (
            <Row label="Blocked" value="Yes — contact super admin" valueClass="text-red-600" />
          )}
        </div>
      </div>

      {/* Territory */}
      <div className="card">
        <h2 className="font-bold text-gray-900 mb-3">📍 Territory (Assigned Cities)</h2>
        {(p.assigned_cities || []).length === 0 ? (
          <p className="text-sm text-orange-600">⏳ No cities assigned yet. Super admin will assign your territory.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {p.assigned_cities.map(c => (
              <span key={c._id} className="px-3 py-1.5 bg-primary/15 text-gray-800 rounded-full text-sm font-semibold">
                {c.name}{c.state ? `, ${c.state}` : ''}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="card">
        <h2 className="font-bold text-gray-900 mb-3">📈 Lifetime Stats</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <StatBox label="Hotels Onboarded"  value={String(p.total_registered)} />
          <StatBox label="Total Earned"      value={`₹${p.total_earned.toLocaleString('en-IN')}`} />
          <StatBox label="Wallet Balance"    value={`₹${p.wallet_amount.toLocaleString('en-IN')}`} />
          <StatBox label="Pending Approval"  value={`₹${p.pending_amount.toLocaleString('en-IN')}`} />
        </div>
      </div>

      {/* Logout */}
      <div className="card">
        <button onClick={() => setShowLogout(true)} className="btn-danger w-full">
          🚪 Logout
        </button>
      </div>

      {showLogout && (
        <ConfirmDialog
          title="Logout?"
          message="You'll need to login again to access your sales panel."
          onConfirm={logout}
          onCancel={() => setShowLogout(false)}
          confirmText="Logout"
          confirmClass="btn-danger"
        />
      )}
    </div>
  );
}

function Row({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex justify-between border-b border-gray-100 py-2">
      <span className="text-gray-500">{label}</span>
      <span className={`font-semibold ${valueClass || 'text-gray-900'}`}>{value}</span>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-black text-gray-900 mt-1">{value}</div>
    </div>
  );
}
