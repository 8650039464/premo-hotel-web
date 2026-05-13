'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { getAuth, clearAuth } from '@/lib/api';
import { ToastContainer } from '@/components/shared/ui';

const NAV = [
  { href: '/super-admin',                  label: 'Dashboard',    icon: '📊' },
  { href: '/super-admin/hotels',           label: 'Hotels',       icon: '🏨' },
  { href: '/super-admin/bookings',         label: 'Bookings',     icon: '📋' },
  { href: '/super-admin/users',            label: 'Users',        icon: '👥' },
  { href: '/super-admin/sales',            label: 'Sales',        icon: '👔' },
  { href: '/super-admin/developers',       label: 'Developers',   icon: '🔌' },
  { href: '/super-admin/commission',       label: 'Commission',   icon: '💰' },
  { href: '/super-admin/city-commissions', label: 'City Rates',   icon: '🗺️' },
  { href: '/super-admin/complaints',       label: 'Complaints',   icon: '💬' },
  { href: '/super-admin/account',          label: 'Account',      icon: '👤' },
];

const PUBLIC = ['/super-admin/login'];

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<Record<string, string> | null>(null);
  const [checked, setChecked] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const auth = getAuth();
    const isPublic = PUBLIC.some(p => pathname === p || pathname.startsWith(p + '/'));

    if (isPublic) {
      if (auth?.role === 'admin') {
        router.replace('/super-admin');
        return;
      }
      setChecked(true);
      return;
    }

    if (!auth || auth.role !== 'admin') {
      router.replace('/super-admin/login');
      return;
    }
    setUser(auth.user);
    setChecked(true);
  }, [pathname]);

  if (!checked) return null;

  const isPublicPage = PUBLIC.some(p => pathname === p || pathname.startsWith(p + '/'));
  if (isPublicPage) return <>{children}</>;

  function logout() { clearAuth(); router.replace('/super-admin/login'); }

  return (
    <div className="min-h-screen bg-gray-50">
      <ToastContainer />

      <nav className="bg-gray-900 shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 flex items-center h-16 gap-4">
          <Link href="/super-admin" className="font-black text-xl text-primary">⚡ Super Admin</Link>

          <div className="hidden md:flex items-center gap-1 flex-1 ml-4">
            {NAV.map(n => (
              <Link key={n.href} href={n.href}
                className={`px-3 py-2 rounded-lg font-semibold text-xs transition-colors ${pathname === n.href ? 'bg-primary text-black' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
                {n.icon} {n.label}
              </Link>
            ))}
          </div>

          <div className="flex-1 md:flex-none" />

          {user && (
            <div className="hidden md:flex items-center gap-3">
              <span className="text-sm font-semibold text-gray-300">{user.name?.split(' ')[0]}</span>
              <button onClick={logout} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-bold rounded-lg transition-colors">Logout</button>
            </div>
          )}

          <button className="md:hidden text-gray-300 text-xl" onClick={() => setMenuOpen(!menuOpen)}>☰</button>
        </div>

        {menuOpen && (
          <div className="md:hidden bg-gray-900 border-t border-gray-800 px-4 py-3 space-y-1">
            {NAV.map(n => (
              <Link key={n.href} href={n.href} onClick={() => setMenuOpen(false)}
                className={`block px-3 py-2 rounded-lg font-semibold text-sm ${pathname === n.href ? 'bg-primary text-black' : 'text-gray-400 hover:text-white'}`}>
                {n.icon} {n.label}
              </Link>
            ))}
            <button onClick={logout} className="block w-full text-left px-3 py-2 text-red-400 font-semibold text-sm">🚪 Logout</button>
          </div>
        )}
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
