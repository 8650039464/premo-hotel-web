'use client';
// ═══════════════════════════════════════════════════════════════════════
//  LANDING CLIENT — the actual 5-card role picker UI.
//
//  Split out of app/page.tsx so the parent stays a Server Component (can
//  read cookies()), while this one keeps the existing client-side logic:
//    • Auto-redirect if user is already logged in (any role)
//    • Renders portal cards with hover transitions
//
//  Receives the resolved brand from the server component as a prop. No
//  cookie re-read on the client — single source of truth (server).
// ═══════════════════════════════════════════════════════════════════════
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getAuth } from '@/lib/api';

type BrandProp = {
  firm_id: string;
  app_name: string;
  branding: { tagline?: string; logo_url?: string; show_premo_footer?: boolean };
};

export default function LandingClient({ brand }: { brand: BrandProp }) {
  const router = useRouter();

  useEffect(() => {
    // Already logged in? Skip the role picker — go to their portal.
    const auth = getAuth();
    if (auth?.role === 'user')  { router.replace('/user'); return; }
    if (auth?.role === 'hotel') { router.replace('/hotel-admin'); return; }
    if (auth?.role === 'sales') { router.replace('/sales'); return; }
    if (auth?.role === 'admin') { router.replace('/super-admin'); return; }
  }, [router]);

  const tagline = brand.branding.tagline || 'Hotel Booking Platform';
  const showPoweredBy = brand.branding.show_premo_footer !== false;

  return (
    <main className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-yellow-50 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        {/* Logo + brand */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary rounded-2xl mb-4 shadow-lg overflow-hidden">
            {brand.branding.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.branding.logo_url} alt={brand.app_name} className="w-full h-full object-contain" />
            ) : (
              <span className="text-3xl">🏨</span>
            )}
          </div>
          <h1 className="text-4xl font-black text-gray-900 mb-2">{brand.app_name}</h1>
          <p className="text-gray-500 text-lg">{tagline}</p>
        </div>

        {/* Portal Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-5">
          <PortalCard href="/user"        icon="👤" bg="bg-blue-100"   title="User Portal"  desc="Browse & book hotels by the hour" />
          <PortalCard href="/hotel-admin" icon="🏩" bg="bg-green-100"  title="Hotel Admin"  desc="Manage your hotel, bookings & rooms" />
          <PortalCard href="/sales"       icon="💼" bg="bg-orange-100" title="Sales Agent"  desc="Onboard hotels & earn commission" />
          <PortalCard href="/super-admin" icon="⚡" bg="bg-purple-100" title="Super Admin"  desc="Platform management & approvals" />
          <PortalCard href="/developer"   icon="🧪" bg="bg-indigo-100" title="Developer"    desc="White-label partners · API key & earnings" />
        </div>

        {showPoweredBy && (
          <p className="text-center text-gray-400 text-sm mt-8">
            Powered by PREMO API · Built for the web
          </p>
        )}
      </div>
    </main>
  );
}

function PortalCard({ href, icon, bg, title, desc }: {
  href: string; icon: string; bg: string; title: string; desc: string;
}) {
  return (
    <Link href={href} className="group">
      <div className="card hover:shadow-lg hover:border-primary/30 transition-all duration-300 text-center py-8 cursor-pointer group-hover:-translate-y-1">
        <div className={`w-16 h-16 ${bg} rounded-2xl flex items-center justify-center mx-auto mb-4`}>
          <span className="text-3xl">{icon}</span>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">{title}</h2>
        <p className="text-gray-500 text-sm">{desc}</p>
        <div className="mt-4 inline-block px-4 py-2 bg-primary text-black text-sm font-bold rounded-lg group-hover:bg-primary-dark transition-colors">
          Enter →
        </div>
      </div>
    </Link>
  );
}
