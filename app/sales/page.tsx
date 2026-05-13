'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { salesApi } from '@/lib/api';
import { Spinner, EmptyState } from '@/components/shared/ui';

interface City { _id: string; name: string; state?: string; }
interface Profile {
  user:    { name: string; email: string; phone?: string };
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
    source?:              string;
  };
}

export default function SalesDashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(true);

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

  if (loading) return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;
  if (error || !profile) {
    return <EmptyState icon="⚠️" title="Could not load dashboard" desc={error || 'Try again later'} />;
  }

  const p = profile.profile;
  const cities = p.assigned_cities || [];

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-black text-gray-900">Hi {profile.user.name?.split(' ')[0] || 'Agent'} 👋</h1>
        <p className="text-gray-500 mt-1">Onboard hotels in your assigned cities and earn commission.</p>
      </div>

      {p.is_blocked && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm font-semibold">
          🚫 Your account has been blocked. Please contact super admin.
        </div>
      )}

      {/* Stat Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Tile label="Wallet (Available)" value={`₹${p.wallet_amount.toLocaleString('en-IN')}`} accent="bg-green-50 text-green-700" />
        <Tile label="Pending Earnings"   value={`₹${p.pending_amount.toLocaleString('en-IN')}`} accent="bg-orange-50 text-orange-700" />
        <Tile label="Hotels Onboarded"   value={String(p.total_registered)} accent="bg-blue-50 text-blue-700" />
        <Tile label="Lifetime Earned"    value={`₹${p.total_earned.toLocaleString('en-IN')}`} accent="bg-primary/10 text-gray-900" />
      </div>

      {/* Earning policy */}
      <div className="card">
        <h2 className="text-lg font-bold text-gray-900 mb-3">Your Earning Plan</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-gray-500">Per hotel onboarded</div>
            <div className="text-2xl font-black text-gray-900 mt-1">₹{profile.policy.earning_per_hotel.toLocaleString('en-IN')}</div>
          </div>
          <div>
            <div className="text-gray-500">Monthly cap</div>
            <div className="text-2xl font-black text-gray-900 mt-1">₹{profile.policy.max_earning_per_month.toLocaleString('en-IN')}</div>
          </div>
          <div>
            <div className="text-gray-500">Minimum payout</div>
            <div className="text-2xl font-black text-gray-900 mt-1">₹{profile.policy.min_payout.toLocaleString('en-IN')}</div>
          </div>
        </div>
      </div>

      {/* Assigned Territory */}
      <div className="card">
        <h2 className="text-lg font-bold text-gray-900 mb-3">Your Territory</h2>
        {cities.length === 0 ? (
          <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-orange-700 text-sm">
            ⏳ No cities assigned yet. Super admin will assign your territory soon — until then you cannot register hotels.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {cities.map(c => (
              <span key={c._id} className="px-3 py-1.5 bg-primary/15 text-gray-800 rounded-full text-sm font-semibold">
                📍 {c.name}{c.state ? `, ${c.state}` : ''}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-2 gap-4">
        <Link href="/sales/register-hotel" className="card hover:shadow-md hover:border-primary/40 transition-all cursor-pointer">
          <div className="text-3xl mb-2">➕</div>
          <h3 className="font-bold text-gray-900">Register a New Hotel</h3>
          <p className="text-gray-500 text-sm mt-1">Onboard a hotel owner in one of your assigned cities.</p>
        </Link>
        <Link href="/sales/earnings" className="card hover:shadow-md hover:border-primary/40 transition-all cursor-pointer">
          <div className="text-3xl mb-2">💸</div>
          <h3 className="font-bold text-gray-900">Withdraw Earnings</h3>
          <p className="text-gray-500 text-sm mt-1">Request a payout once you reach the minimum amount.</p>
        </Link>
      </div>
    </div>
  );
}

function Tile({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="card">
      <div className={`inline-block px-2 py-0.5 text-xs font-bold rounded-md ${accent}`}>{label}</div>
      <div className="text-2xl font-black text-gray-900 mt-2">{value}</div>
    </div>
  );
}
