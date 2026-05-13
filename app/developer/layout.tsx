'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { getDevAuth, clearDevAuth } from '@/lib/api';
import { ToastContainer } from '@/components/shared/ui';

const NAV = [
  { href: '/developer',              label: 'Dashboard',    icon: '📊' },
  { href: '/developer/earnings',     label: 'Earnings',     icon: '💰' },
  { href: '/developer/payouts',      label: 'Payouts',      icon: '💸' },
  { href: '/developer/generate-app', label: 'Generate App', icon: '📱' },
  { href: '/developer/domain',       label: 'Domain',       icon: '🌐' },
  { href: '/developer/settings',     label: 'Settings',     icon: '⚙️' },
];

const PUBLIC = ['/developer/login', '/developer/register'];

export default function DeveloperLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [user, setUser]       = useState<Record<string, unknown> | null>(null);
  const [checked, setChecked] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const auth = getDevAuth();
    const isPublic = PUBLIC.some(p => pathname === p || pathname.startsWith(p + '/'));

    if (isPublic) {
      if (auth) {
        router.replace('/developer');
        return;
      }
      setChecked(true);
      return;
    }

    if (!auth) {
      router.replace('/developer/login');
      return;
    }
    setUser(auth.user);
    setChecked(true);
  }, [pathname, router]);

  if (!checked) return null;
  const isPublicPage = PUBLIC.some(p => pathname === p || pathname.startsWith(p + '/'));
  if (isPublicPage) return <>{children}</>;

  function logout() { clearDevAuth(); router.replace('/developer/login'); }

  return (
    <div className="min-h-screen bg-gray-50">
      <ToastContainer />

      <nav className="bg-primary shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 flex items-center h-16 gap-4">
          <Link href="/developer" className="font-black text-xl text-black">🧪 Developer Portal</Link>

          <div className="hidden md:flex items-center gap-1 flex-1 ml-6">
            {NAV.map(n => (
              <Link key={n.href} href={n.href}
                className={`px-3 py-2 rounded-lg font-semibold text-sm transition-colors ${pathname === n.href ? 'bg-black/15 text-black' : 'text-black/70 hover:bg-black/10'}`}>
                {n.icon} {n.label}
              </Link>
            ))}
          </div>

          <div className="flex-1 md:flex-none" />

          {user && (
            <div className="hidden md:flex items-center gap-3">
              <span className="text-sm font-semibold text-black/80">{String(user.name || '').split(' ')[0]}</span>
              <button onClick={logout} className="px-3 py-1.5 bg-black/10 hover:bg-black/20 text-black text-sm font-bold rounded-lg transition-colors">Logout</button>
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
            <button onClick={logout} className="block w-full text-left px-3 py-2 text-red-700 font-semibold text-sm">🚪 Logout</button>
          </div>
        )}
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
