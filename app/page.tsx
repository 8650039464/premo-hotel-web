'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getAuth } from '@/lib/api';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Already logged in? Seedha portal pe bhejo
    const auth = getAuth();
    if (auth?.role === 'user')  { router.replace('/user'); return; }
    if (auth?.role === 'hotel') { router.replace('/hotel-admin'); return; }
    if (auth?.role === 'sales') { router.replace('/sales'); return; }
    if (auth?.role === 'admin') { router.replace('/super-admin'); return; }
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-yellow-50 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        {/* Logo */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary rounded-2xl mb-4 shadow-lg">
            <span className="text-3xl">🏨</span>
          </div>
          <h1 className="text-4xl font-black text-gray-900 mb-2">PREMO</h1>
          <p className="text-gray-500 text-lg">Hotel Booking Platform</p>
        </div>

        {/* Portal Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-5">
          {/* User Portal */}
          <Link href="/user" className="group">
            <div className="card hover:shadow-lg hover:border-primary/30 transition-all duration-300 text-center py-8 cursor-pointer group-hover:-translate-y-1">
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">👤</span>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">User Portal</h2>
              <p className="text-gray-500 text-sm">Browse & book hotels by the hour</p>
              <div className="mt-4 inline-block px-4 py-2 bg-primary text-black text-sm font-bold rounded-lg group-hover:bg-primary-dark transition-colors">
                Enter →
              </div>
            </div>
          </Link>

          {/* Hotel Admin */}
          <Link href="/hotel-admin" className="group">
            <div className="card hover:shadow-lg hover:border-primary/30 transition-all duration-300 text-center py-8 cursor-pointer group-hover:-translate-y-1">
              <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🏩</span>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Hotel Admin</h2>
              <p className="text-gray-500 text-sm">Manage your hotel, bookings & rooms</p>
              <div className="mt-4 inline-block px-4 py-2 bg-primary text-black text-sm font-bold rounded-lg group-hover:bg-primary-dark transition-colors">
                Enter →
              </div>
            </div>
          </Link>

          {/* Sales Agent */}
          <Link href="/sales" className="group">
            <div className="card hover:shadow-lg hover:border-primary/30 transition-all duration-300 text-center py-8 cursor-pointer group-hover:-translate-y-1">
              <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">💼</span>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Sales Agent</h2>
              <p className="text-gray-500 text-sm">Onboard hotels & earn commission</p>
              <div className="mt-4 inline-block px-4 py-2 bg-primary text-black text-sm font-bold rounded-lg group-hover:bg-primary-dark transition-colors">
                Enter →
              </div>
            </div>
          </Link>

          {/* Super Admin */}
          <Link href="/super-admin" className="group">
            <div className="card hover:shadow-lg hover:border-primary/30 transition-all duration-300 text-center py-8 cursor-pointer group-hover:-translate-y-1">
              <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">⚡</span>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Super Admin</h2>
              <p className="text-gray-500 text-sm">Platform management & approvals</p>
              <div className="mt-4 inline-block px-4 py-2 bg-primary text-black text-sm font-bold rounded-lg group-hover:bg-primary-dark transition-colors">
                Enter →
              </div>
            </div>
          </Link>

          {/* Developer Portal */}
          <Link href="/developer" className="group">
            <div className="card hover:shadow-lg hover:border-primary/30 transition-all duration-300 text-center py-8 cursor-pointer group-hover:-translate-y-1">
              <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🧪</span>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Developer</h2>
              <p className="text-gray-500 text-sm">White-label partners · API key & earnings</p>
              <div className="mt-4 inline-block px-4 py-2 bg-primary text-black text-sm font-bold rounded-lg group-hover:bg-primary-dark transition-colors">
                Enter →
              </div>
            </div>
          </Link>
        </div>

        <p className="text-center text-gray-400 text-sm mt-8">
          Powered by PREMO API · Built for the web
        </p>
      </div>
    </main>
  );
}
