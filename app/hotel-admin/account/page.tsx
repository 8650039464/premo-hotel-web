'use client';
import { useRouter } from 'next/navigation';
import { getAuth, clearAuth } from '@/lib/api';

export default function HotelAccountPage() {
  const router = useRouter();
  const auth = getAuth();
  const user = auth?.user;

  function logout() { clearAuth(); router.replace('/hotel-admin/login'); }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-black text-gray-900 mb-6">👤 Account</h1>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4 text-center">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
          <span className="text-3xl font-black text-green-700">{user?.name?.[0]?.toUpperCase() || 'H'}</span>
        </div>
        <h2 className="text-xl font-black text-gray-900">{user?.name}</h2>
        <p className="text-gray-500 text-sm mt-1">{user?.email}</p>
        <span className="inline-block mt-2 px-3 py-1 bg-green-50 text-green-600 text-xs font-bold rounded-full uppercase">Hotel Partner</span>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50 mb-4">
        {[
          { icon: '📧', label: 'Email', value: user?.email || '' },
          { icon: '🎯', label: 'Role', value: 'Hotel Partner' },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-3 px-5 py-4">
            <span className="text-xl">{item.icon}</span>
            <div>
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">{item.label}</p>
              <p className="text-gray-900 font-medium">{item.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-red-50 rounded-2xl border border-red-100 p-4">
        <button onClick={logout} className="w-full flex items-center gap-3 text-red-600 font-bold py-2">
          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">🚪</div>
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}
