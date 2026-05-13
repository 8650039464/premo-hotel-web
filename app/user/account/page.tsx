'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth, clearAuth, API_BASE, API_ROOT, API_TOKEN, getWalletBalance, createTopupOrder, verifyTopup, loadRazorpay, openWhatsApp, APP_NAME } from '@/lib/api';
import { Spinner } from '@/components/shared/ui';

export default function UserAccountPage() {
  const router = useRouter();
  const auth   = getAuth();
  const [profile, setProfile]           = useState<any>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [loading, setLoading]           = useState(true);
  const [editing, setEditing]           = useState(false);
  const [name, setName]                 = useState('');
  const [saving, setSaving]             = useState(false);
  const [topupAmount, setTopupAmount]   = useState('');
  const [topupLoading, setTopupLoading] = useState(false);
  const [showTopup, setShowTopup]       = useState(false);
  // OTP edit
  const [editType, setEditType]         = useState<'email' | 'phone' | null>(null);
  const [editValue, setEditValue]       = useState('');
  const [otp, setOtp]                   = useState('');
  const [otpSent, setOtpSent]           = useState(false);
  const [otpLoading, setOtpLoading]     = useState(false);
  const [editSaving, setEditSaving]     = useState(false);

  const headers = { 'Content-Type': 'application/json', 'x-api-token': API_TOKEN, Authorization: `Bearer ${auth?.token}` };

  async function load() {
    setLoading(true);
    try {
      const [profileRes, walletRes] = await Promise.all([
        fetch(`${API_ROOT}/api/auth/me`, { headers }).then(r => r.json()),
        getWalletBalance(auth!.token),
      ]);
      setProfile(profileRes);
      setName(profileRes.name || '');
      setWalletBalance(walletRes.wallet_amount || 0);
    } catch {}
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function saveName() {
    setSaving(true);
    try {
      const res = await fetch(`${API_ROOT}/api/auth/me/update`, { method: 'PUT', headers, body: JSON.stringify({ name }) });
      if (res.ok) { setProfile({ ...profile, name }); setEditing(false); }
    } catch {} finally { setSaving(false); }
  }

  // Wallet top-up
  async function startTopup() {
    const amt = parseFloat(topupAmount);
    if (!amt || amt < 10) { alert('Minimum ₹10'); return; }
    setTopupLoading(true);
    try {
      const loaded = await loadRazorpay();
      if (!loaded) { alert('Razorpay failed to load'); setTopupLoading(false); return; }

      const { ok, data } = await createTopupOrder(auth!.token, amt);
      if (!ok) { alert(data.error || 'Failed'); setTopupLoading(false); return; }

      new (window as any).Razorpay({
        key: data.key_id,
        amount: data.amount * 100,
        currency: 'INR',
        order_id: data.order_id,
        name: APP_NAME,
        description: 'Wallet Top-up',
        theme: { color: '#FDC507' },
        handler: async (response: any) => {
          const { ok: vOk, data: vData } = await verifyTopup(auth!.token, {
            razorpay_order_id:   response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature:  response.razorpay_signature,
            amount: amt,
          });
          if (vOk) {
            setWalletBalance(vData.wallet_amount);
            setShowTopup(false);
            setTopupAmount('');
            alert(`₹${amt} added to wallet! New balance: ₹${vData.wallet_amount}`);
          } else {
            alert(vData.error || 'Verification failed');
          }
        },
        modal: { ondismiss: () => setTopupLoading(false) },
      }).open();
    } catch (e) { alert((e as Error).message); }
    finally { setTopupLoading(false); }
  }

  // OTP edit
  async function sendOtp() {
    if (!editValue) return;
    setOtpLoading(true);
    try {
      const res = await fetch(`${API_ROOT}/api/otp/send`, {
        method: 'POST', headers,
        body: JSON.stringify({ identifier: editValue, type: editType, purpose: 'update_profile' }),
      });
      if (res.ok) { setOtpSent(true); alert('OTP sent!'); }
      else { const d = await res.json(); alert(d.error || 'Failed'); }
    } catch {} finally { setOtpLoading(false); }
  }

  async function saveWithOtp() {
    if (otp.length !== 6) { alert('Enter 6-digit OTP'); return; }
    setEditSaving(true);
    try {
      // Verify OTP
      const vRes = await fetch(`${API_ROOT}/api/otp/verify`, {
        method: 'POST', headers,
        body: JSON.stringify({ identifier: editValue, type: editType, purpose: 'update_profile', otp }),
      });
      if (!vRes.ok) { const d = await vRes.json(); alert(d.error || 'Wrong OTP'); setEditSaving(false); return; }

      // Update
      const body = editType === 'email' ? { email: editValue } : { phone: editValue };
      const uRes = await fetch(`${API_ROOT}/api/auth/me/update`, { method: 'PUT', headers, body: JSON.stringify(body) });
      if (uRes.ok) {
        alert(`${editType === 'email' ? 'Email' : 'Phone'} updated!`);
        setEditType(null); setEditValue(''); setOtp(''); setOtpSent(false);
        load();
      } else { alert('Update failed'); }
    } catch {} finally { setEditSaving(false); }
  }

  function logout() { clearAuth(); router.replace('/user/login'); }

  if (loading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;

  const photoUrl = profile?.photo ? (profile.photo.startsWith('http') ? profile.photo : `${API_BASE}${profile.photo}`) : null;
  const PRESETS  = [100, 200, 500, 1000];

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-black text-gray-900 mb-6">👤 My Account</h1>

      {/* Avatar */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4 text-center">
        <div className="w-20 h-20 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center mx-auto mb-3 overflow-hidden">
          {photoUrl
            ? <img src={photoUrl} alt="Profile" className="w-full h-full object-cover" />
            : <span className="text-3xl font-black text-primary">{profile?.name?.[0]?.toUpperCase() || 'U'}</span>}
        </div>
        {editing ? (
          <div className="flex gap-2 justify-center mt-2">
            <input className="input-field text-center max-w-xs" value={name} onChange={e => setName(e.target.value)} />
            <button onClick={saveName} disabled={saving} className="btn-primary px-4 py-2">
              {saving ? <Spinner size="sm" /> : '✓'}
            </button>
            <button onClick={() => setEditing(false)} className="px-4 py-2 border border-gray-200 rounded-xl text-gray-500">✕</button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 mt-2">
            <h2 className="text-xl font-black text-gray-900">{profile?.name}</h2>
            <button onClick={() => setEditing(true)} className="text-gray-400 hover:text-gray-600 text-sm">✏️</button>
          </div>
        )}
        <span className="inline-block mt-2 px-3 py-1 bg-blue-50 text-blue-600 text-xs font-bold rounded-full uppercase">Customer</span>
      </div>

      {/* Wallet Card */}
      <div className="bg-gradient-to-r from-primary to-yellow-400 rounded-2xl p-5 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-black/60 uppercase tracking-wide">Wallet Balance</p>
            <p className="text-3xl font-black text-black">₹{walletBalance}</p>
          </div>
          <button onClick={() => setShowTopup(true)}
            className="flex items-center gap-2 bg-black/10 hover:bg-black/20 text-black font-bold px-4 py-2 rounded-xl transition-colors text-sm">
            + Add Money
          </button>
        </div>
      </div>

      {/* Profile Details with OTP edit */}
      <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50 mb-4">
        {[
          { icon: '📧', label: 'Email', value: profile?.email || 'Not set', type: 'email' as const },
          { icon: '📱', label: 'Phone', value: profile?.phone || 'Not set', type: 'phone' as const },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-3 px-5 py-4">
            <span className="text-xl">{item.icon}</span>
            <div className="flex-1">
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">{item.label}</p>
              <p className="text-gray-900 font-medium">{item.value}</p>
            </div>
            <button onClick={() => { setEditType(item.type); setEditValue(''); setOtp(''); setOtpSent(false); }}
              className="text-primary text-sm font-bold hover:underline">Edit</button>
          </div>
        ))}
        <div className="flex items-center gap-3 px-5 py-4">
          <span className="text-xl">🎯</span>
          <div>
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Role</p>
            <p className="text-gray-900 font-medium">Customer</p>
          </div>
        </div>
      </div>

      {/* WhatsApp Support */}
      <button onClick={openWhatsApp}
        className="w-full bg-[#25D366]/10 border border-[#25D366]/30 rounded-2xl p-4 mb-4 flex items-center gap-3 hover:bg-[#25D366]/15 transition-colors">
        <div className="w-10 h-10 bg-[#25D366]/20 rounded-xl flex items-center justify-center text-xl">💬</div>
        <div className="flex-1 text-left">
          <p className="font-bold text-gray-900">Chat with Support</p>
          <p className="text-sm text-gray-500">Available on WhatsApp</p>
        </div>
        <span className="text-gray-400">→</span>
      </button>

      {/* Logout */}
      <div className="bg-red-50 rounded-2xl border border-red-100 p-4">
        <button onClick={logout} className="w-full flex items-center gap-3 text-red-600 font-bold py-2">
          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">🚪</div>
          <span>Logout</span>
        </button>
      </div>

      {/* Top-up Modal */}
      {showTopup && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-t-3xl md:rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black">Add Money to Wallet</h3>
              <button onClick={() => setShowTopup(false)} className="text-gray-400 text-2xl hover:text-gray-600">×</button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Current balance: ₹{walletBalance}</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {PRESETS.map(p => (
                <button key={p} onClick={() => setTopupAmount(String(p))}
                  className={`px-4 py-2 rounded-xl font-bold text-sm border transition-all ${topupAmount === String(p) ? 'bg-primary border-primary' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                  ₹{p}
                </button>
              ))}
            </div>
            <input className="input-field mb-4" type="number" placeholder="Or enter amount (min ₹10)"
              value={topupAmount} onChange={e => setTopupAmount(e.target.value)} />
            <button onClick={startTopup} disabled={topupLoading}
              className="btn-primary w-full flex items-center justify-center gap-2">
              {topupLoading ? <Spinner size="sm" /> : null}
              {topupLoading ? 'Processing...' : 'Proceed to Pay'}
            </button>
          </div>
        </div>
      )}

      {/* OTP Edit Modal */}
      {editType && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-t-3xl md:rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black">Update {editType === 'email' ? 'Email' : 'Phone'}</h3>
              <button onClick={() => { setEditType(null); setOtpSent(false); }} className="text-gray-400 text-2xl">×</button>
            </div>
            <div className="flex gap-2 mb-3">
              <input className="input-field flex-1"
                type={editType === 'email' ? 'email' : 'tel'}
                placeholder={`New ${editType === 'email' ? 'email address' : 'phone number'}`}
                value={editValue} onChange={e => setEditValue(e.target.value)}
                disabled={otpSent} />
              <button onClick={sendOtp} disabled={otpLoading || otpSent}
                className="px-4 py-2 bg-primary text-black font-bold rounded-xl disabled:opacity-50 whitespace-nowrap">
                {otpLoading ? <Spinner size="sm" /> : 'Send OTP'}
              </button>
            </div>
            {otpSent && (
              <>
                <input className="input-field mb-3" placeholder="6-digit OTP" maxLength={6}
                  value={otp} onChange={e => setOtp(e.target.value)} />
                <button onClick={saveWithOtp} disabled={editSaving}
                  className="btn-primary w-full flex items-center justify-center gap-2">
                  {editSaving ? <Spinner size="sm" /> : null}
                  {editSaving ? 'Saving...' : `Verify & Update ${editType === 'email' ? 'Email' : 'Phone'}`}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
