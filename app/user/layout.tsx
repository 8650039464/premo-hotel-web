'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { getAuth, clearAuth, getWalletBalance } from '@/lib/api';
import { useBrand } from '@/lib/brand';
import { ToastContainer } from '@/components/shared/ui';

const NAV = [
  { href: '/user',          label: 'Browse Hotels', icon: '🏨' },
  { href: '/user/bookings', label: 'My Bookings',   icon: '📋' },
  { href: '/user/account',  label: 'Account',       icon: '👤' },
];

const PUBLIC = ['/user/login', '/user/register'];

export default function UserLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const brand    = useBrand();   // populated by edge middleware on custom domains
  const [user, setUser]               = useState<Record<string, string> | null>(null);
  const [checked, setChecked]         = useState(false);
  const [menuOpen, setMenuOpen]       = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  useEffect(() => {
    const auth     = getAuth();
    const isPublic = PUBLIC.some(p => pathname === p || pathname.startsWith(p + '/'));

    if (isPublic) {
      if (auth?.role === 'user') { router.replace('/user'); return; }
      setChecked(true); return;
    }
    if (!auth || auth.role !== 'user') { router.replace('/user/login'); return; }
    setUser(auth.user);
    setChecked(true);

    // Load wallet
    getWalletBalance(auth.token).then(d => setWalletBalance(d.wallet_amount ?? 0));
  }, [pathname]);

  if (!checked) return null;

  function logout() { clearAuth(); router.replace('/user/login'); }

  const isPublic = PUBLIC.some(p => pathname === p || pathname.startsWith(p + '/'));
  if (isPublic) return <>{children}</>;

  return (
    <div className="min-h-screen bg-gray-50">
      <ToastContainer />
      <nav className="bg-primary shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 flex items-center h-16 gap-4">
          <Link href="/user" className="font-black text-xl text-black flex items-center gap-2">
            {brand.branding.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.branding.logo_url} alt={brand.app_name} className="h-7 w-7 rounded object-cover" />
            ) : (
              <span>🏨</span>
            )}
            <span>{brand.app_name}</span>
          </Link>

          <div className="hidden md:flex items-center gap-1 flex-1 ml-6">
            {NAV.map(n => (
              <Link key={n.href} href={n.href}
                className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${pathname === n.href ? 'bg-black/15 text-black' : 'text-black/70 hover:bg-black/10'}`}>
                {n.icon} {n.label}
              </Link>
            ))}
          </div>

          <div className="flex-1 md:flex-none" />

          {user && (
            <div className="hidden md:flex items-center gap-3">
              {/* Wallet balance pill */}
              {walletBalance !== null && (
                <Link href="/user/account"
                  className="flex items-center gap-1.5 bg-black/10 hover:bg-black/20 text-black px-3 py-1.5 rounded-lg text-sm font-bold transition-colors">
                  💳 ₹{walletBalance}
                </Link>
              )}
              <span className="text-sm font-semibold text-black/80">Hi, {user.name?.split(' ')[0]}</span>
              <button onClick={logout} className="px-3 py-1.5 bg-black/10 hover:bg-black/20 text-black text-sm font-bold rounded-lg transition-colors">
                Logout
              </button>
            </div>
          )}
          <button className="md:hidden text-black text-xl" onClick={() => setMenuOpen(!menuOpen)}>☰</button>
        </div>

        {menuOpen && (
          <div className="md:hidden bg-yellow-400 border-t border-yellow-500 px-4 py-3 space-y-1">
            {NAV.map(n => (
              <Link key={n.href} href={n.href} onClick={() => setMenuOpen(false)}
                className="block px-3 py-2 rounded-lg font-semibold text-sm text-black/80 hover:bg-black/10">
                {n.icon} {n.label}
              </Link>
            ))}
            {walletBalance !== null && (
              <div className="px-3 py-2 text-sm font-bold text-black/80">💳 Wallet: ₹{walletBalance}</div>
            )}
            <button onClick={logout} className="block w-full text-left px-3 py-2 text-red-700 font-semibold text-sm">
              🚪 Logout
            </button>
          </div>
        )}
      </nav>
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>

      {/* Footer — conditionally shows "Powered by Premo" attribution.
          Developer toggles `show_premo_footer` in /developer/settings.
          Default true; absent value (older records) treated as true. */}
      {brand.branding.show_premo_footer !== false && (
        <footer className="border-t border-gray-100 mt-8">
          <div className="max-w-7xl mx-auto px-4 py-5 text-center">
            <p className="text-gray-400 text-xs">
              Powered by <span className="font-semibold">PREMO</span> · Hotel Booking Engine
            </p>
          </div>
        </footer>
      )}
    </div>
  );
}
