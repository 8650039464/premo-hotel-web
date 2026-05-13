'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { salesApi } from '@/lib/api';
import { Spinner, toast } from '@/components/shared/ui';

interface City { _id: string; name: string; state?: string; }

export default function RegisterHotelPage() {
  const router = useRouter();
  const [cities, setCities] = useState<City[]>([]);
  const [bootLoading, setBootLoading] = useState(true);
  const [submitting,  setSubmitting]  = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    owner_name:     '',
    owner_email:    '',
    owner_phone:    '',
    owner_password: '',
    hotel_name:     '',
    hotel_city:     '',
    hotel_address:  '',
    hotel_desc:     '',
    hotel_lat:      '',
    hotel_lng:      '',
  });

  // Load assigned cities (territory) so agent can ONLY pick from those
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { ok, data } = await salesApi.profile();
      if (cancelled) return;
      if (ok && data?.profile?.assigned_cities) {
        setCities(data.profile.assigned_cities as City[]);
      }
      setBootLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (form.owner_password.length < 6) { setError('Owner password must be at least 6 characters'); return; }
    if (!form.hotel_city) { setError('Please pick a city from your assigned territory'); return; }

    setSubmitting(true);
    const payload: Record<string, unknown> = { ...form };
    if (form.hotel_lat) payload.hotel_lat = Number(form.hotel_lat);
    if (form.hotel_lng) payload.hotel_lng = Number(form.hotel_lng);
    if (!form.hotel_lat) delete payload.hotel_lat;
    if (!form.hotel_lng) delete payload.hotel_lng;

    const { ok, data } = await salesApi.registerHotel(payload);
    setSubmitting(false);
    if (ok) {
      toast(`Hotel registered! +₹${data?.pending_credit || 0} pending credit`, 'success');
      setTimeout(() => router.replace('/sales/hotels'), 1500);
    } else {
      setError(data?.error || 'Registration failed');
    }
  }

  if (bootLoading) return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;

  if (cities.length === 0) {
    return (
      <div className="card text-center py-10">
        <div className="text-5xl mb-3">⏳</div>
        <h2 className="font-bold text-lg text-gray-900">No Territory Assigned</h2>
        <p className="text-gray-500 text-sm mt-2 max-w-md mx-auto">
          Super admin has not assigned any cities to your account yet. You can only register hotels in cities assigned to you.
        </p>
        <Link href="/sales" className="inline-block mt-6 btn-outline">← Back to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900">Register a New Hotel</h1>
        <p className="text-gray-500 mt-1">Onboard the hotel owner — earnings credit after super admin approval.</p>
      </div>

      <form onSubmit={submit} className="space-y-6">
        {/* Hotel Owner Section */}
        <div className="card">
          <h2 className="font-bold text-gray-900 mb-4">👤 Hotel Owner Details</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <Input
              label="Owner Name *"
              value={form.owner_name}
              onChange={v => setForm({ ...form, owner_name: v })}
              required
            />
            <Input
              label="Owner Email *"
              type="email"
              value={form.owner_email}
              onChange={v => setForm({ ...form, owner_email: v })}
              required
            />
            <Input
              label="Owner Phone"
              type="tel"
              value={form.owner_phone}
              onChange={v => setForm({ ...form, owner_phone: v })}
            />
            <Input
              label="Owner Password *"
              type="password"
              value={form.owner_password}
              onChange={v => setForm({ ...form, owner_password: v })}
              required
              minLength={6}
              hint="Min 6 chars — share with the owner so they can login"
            />
          </div>
        </div>

        {/* Hotel Section */}
        <div className="card">
          <h2 className="font-bold text-gray-900 mb-4">🏩 Hotel Details</h2>
          <div className="space-y-4">
            <Input
              label="Hotel Name *"
              value={form.hotel_name}
              onChange={v => setForm({ ...form, hotel_name: v })}
              required
            />
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">City * (your territory)</label>
              <select
                className="input-field"
                required
                value={form.hotel_city}
                onChange={e => setForm({ ...form, hotel_city: e.target.value })}
              >
                <option value="">Select a city...</option>
                {cities.map(c => (
                  <option key={c._id} value={c._id}>
                    {c.name}{c.state ? ` — ${c.state}` : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">You can only register hotels in cities assigned to you.</p>
            </div>
            <Input
              label="Address"
              value={form.hotel_address}
              onChange={v => setForm({ ...form, hotel_address: v })}
            />
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description</label>
              <textarea
                className="input-field"
                rows={3}
                value={form.hotel_desc}
                onChange={e => setForm({ ...form, hotel_desc: e.target.value })}
                placeholder="Short description, amenities, etc."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Latitude (optional)"
                type="number"
                value={form.hotel_lat}
                onChange={v => setForm({ ...form, hotel_lat: v })}
              />
              <Input
                label="Longitude (optional)"
                type="number"
                value={form.hotel_lng}
                onChange={v => setForm({ ...form, hotel_lng: v })}
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">{error}</div>
        )}

        <div className="flex gap-3">
          <Link href="/sales" className="btn-outline flex-1 text-center">Cancel</Link>
          <button type="submit" disabled={submitting} className="btn-primary flex-1 flex items-center justify-center gap-2">
            {submitting ? <Spinner size="sm" /> : null}
            {submitting ? 'Registering...' : 'Register Hotel'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Input({
  label, value, onChange, type = 'text', required, minLength, hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  minLength?: number;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        required={required}
        minLength={minLength}
        className="input-field"
      />
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  );
}
