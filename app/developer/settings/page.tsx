'use client';
import { useEffect, useState } from 'react';
import { getDevAuth, devApi, saveDevAuth } from '@/lib/api';
import { Spinner } from '@/components/shared/ui';

interface Branding {
  logo_url?: string; primary_color?: string; accent_color?: string;
  support_email?: string; support_phone?: string; tagline?: string;
  play_store_url?: string; app_store_url?: string;
}
interface DevProfile {
  id: string; name: string; email: string; phone: string; company: string; website: string;
  app_name: string; firm_id: string; api_key: string;
  markup_percent: number; wallet_balance: number; total_earned: number; status: string;
  max_markup_cap?: number | null;
  branding?: Branding;
}

interface PlayShaStatus {
  play_signing_sha1: string;
  play_signing_sha1_registered_at: string | null;
  firebase_release_sha1: string;
  in_sync: boolean;
}

export default function DeveloperSettingsPage() {
  const [profile, setProfile] = useState<DevProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [rotating, setRotating] = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');

  // Play Console SHA-1 state
  const [playSha, setPlaySha]       = useState<PlayShaStatus | null>(null);
  const [shaInput, setShaInput]     = useState('');
  const [savingSha, setSavingSha]   = useState(false);
  const [shaError, setShaError]     = useState('');
  const [shaSuccess, setShaSuccess] = useState('');

  async function load() {
    const auth = getDevAuth();
    if (!auth) return;
    setLoading(true);
    try {
      const [me, sha] = await Promise.all([
        devApi.me(auth.token),
        devApi.playSha1Get(auth.token),
      ]);
      if (me.ok) setProfile(me.data);
      else setError(me.data.error || 'Failed to load');
      if (sha.ok) {
        setPlaySha(sha.data);
        setShaInput(sha.data?.play_signing_sha1 || '');
      }
    } catch { setError('Connection error'); }
    finally { setLoading(false); }
  }

  // Format input as user types: uppercase hex, auto-insert colons every 2 chars
  function normaliseShaInput(raw: string): string {
    const hex = raw.toUpperCase().replace(/[^0-9A-F]/g, '').slice(0, 40);
    const pairs = hex.match(/.{1,2}/g) || [];
    return pairs.join(':');
  }

  async function handleSavePlaySha() {
    setShaError(''); setShaSuccess('');
    const clean = shaInput.trim().toUpperCase();
    if (!/^([0-9A-F]{2}:){19}[0-9A-F]{2}$/.test(clean)) {
      setShaError('Invalid format. Expected 40 hex chars with colons (e.g. AB:CD:EF:01:...)');
      return;
    }
    const auth = getDevAuth();
    if (!auth) return;
    setSavingSha(true);
    try {
      const { ok, data } = await devApi.playSha1Set(auth.token, clean);
      if (ok) {
        setShaSuccess(data?.message || 'Registered with Firebase');
        load();
      } else {
        // Backend may return 502 with `saved: true, will_retry_on_next_build: true`
        if (data?.saved) {
          setShaSuccess('SHA-1 saved. Firebase registration will retry on next build.');
          load();
        } else {
          setShaError(data?.error || 'Failed to register SHA-1');
        }
      }
    } catch { setShaError('Network error'); }
    finally { setSavingSha(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setError(''); setSuccess(''); setSaving(true);
    const auth = getDevAuth();
    if (!auth) return;

    const markup = Number(profile.markup_percent);
    if (isNaN(markup) || markup < 0 || markup > 100) {
      setError('Markup must be 0–100'); setSaving(false); return;
    }
    // Platform cap check (client-side mirror of backend)
    const cap = profile.max_markup_cap;
    if (cap != null && markup > cap) {
      setError(`Markup platform cap (${cap}%) se zyada nahi ho sakta.`);
      setSaving(false);
      return;
    }

    // Basic client-side hex color check
    const b = profile.branding || {};
    const hexRe = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
    for (const f of ['primary_color', 'accent_color'] as const) {
      const v = b[f];
      if (v && !hexRe.test(v)) {
        setError(`${f.replace('_', ' ')} hex format mein hona chahiye (e.g. #FFC107)`);
        setSaving(false);
        return;
      }
    }

    try {
      const { ok, data } = await devApi.update(auth.token, {
        app_name:       profile.app_name,
        company:        profile.company,
        website:        profile.website,
        phone:          profile.phone,
        markup_percent: markup,
        branding:       b,
      });
      if (ok) {
        setSuccess('Profile updated!');
        // Update stored user record
        saveDevAuth(auth.token, { ...auth.user, markup_percent: markup, app_name: profile.app_name });
      } else setError(data.error || 'Update failed');
    } catch { setError('Connection error'); }
    finally { setSaving(false); }
  }

  function setBrand<K extends keyof Branding>(key: K, val: Branding[K]) {
    if (!profile) return;
    setProfile({ ...profile, branding: { ...(profile.branding || {}), [key]: val } });
  }

  async function handleRotateKey() {
    const ok = confirm('Purani API key bekaar ho jaayegi. Aapko apne app mein new key set karni hogi. Continue?');
    if (!ok) return;
    const auth = getDevAuth();
    if (!auth) return;
    setRotating(true); setError(''); setSuccess('');
    try {
      const { ok, data } = await devApi.regenKey(auth.token);
      if (ok) {
        setSuccess(`New API key: ${data.api_key}`);
        load();
      } else setError(data.error || 'Failed to rotate key');
    } catch { setError('Connection error'); }
    finally { setRotating(false); }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>;
  if (!profile) return <div className="text-red-600 text-sm">{error || 'No profile'}</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-black text-gray-900">⚙️ Settings</h1>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-bold text-lg mb-4">Profile</h2>
        <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Name (read-only)" value={profile.name} readOnly />
          <Field label="Email (read-only)" value={profile.email} readOnly />
          <Field label="Phone"   value={profile.phone}   onChange={v => setProfile({ ...profile, phone: v })} />
          <Field label="Company" value={profile.company} onChange={v => setProfile({ ...profile, company: v })} />
          <Field label="Website" value={profile.website} onChange={v => setProfile({ ...profile, website: v })} />
          <Field label="App Name" value={profile.app_name} onChange={v => setProfile({ ...profile, app_name: v })} />
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Markup %
              {profile.max_markup_cap != null && (
                <span className="ml-2 text-xs font-normal text-gray-500">
                  (platform cap: {profile.max_markup_cap}%)
                </span>
              )}
            </label>
            <input type="number" min={0}
              max={profile.max_markup_cap != null ? profile.max_markup_cap : 100}
              step={0.1}
              value={profile.markup_percent}
              onChange={e => setProfile({ ...profile, markup_percent: Number(e.target.value) })}
              className={`input-field ${profile.max_markup_cap != null && profile.markup_percent > profile.max_markup_cap ? 'border-red-300' : ''}`} />
            <p className="text-xs text-gray-400 mt-1">
              User se extra % charge — hotel base price + Premo commission pe top-up.
              {profile.max_markup_cap != null && (
                <> Max allowed: <b>{profile.max_markup_cap}%</b>.</>
              )}
            </p>
            {profile.max_markup_cap != null && profile.markup_percent > profile.max_markup_cap && (
              <p className="text-xs text-red-600 mt-1">
                ⚠️ Cap exceeded — save karne se pehle {profile.max_markup_cap}% ya uske niche rakho.
              </p>
            )}
          </div>
          <div></div>

          {error   && <div className="md:col-span-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">{error}</div>}
          {success && <div className="md:col-span-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-emerald-700 text-sm break-all">{success}</div>}

          <div className="md:col-span-2">
            <button type="submit" disabled={saving} className="btn-primary flex items-center justify-center gap-2">
              {saving ? <Spinner size="sm" /> : null}
              {saving ? 'Saving...' : 'SAVE CHANGES'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-bold text-lg mb-1">🎨 Branding</h2>
        <p className="text-xs text-gray-500 mb-4">
          White-label app build aur hosted website ke liye brand theme. Blank fields Premo defaults use karenge.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Logo URL (https)"
            value={profile.branding?.logo_url || ''}
            onChange={v => setBrand('logo_url', v)} />
          <Field label="Tagline"
            value={profile.branding?.tagline || ''}
            onChange={v => setBrand('tagline', v)} />

          <ColorField label="Primary color (hex)"
            value={profile.branding?.primary_color || ''}
            onChange={v => setBrand('primary_color', v)} />
          <ColorField label="Accent color (hex)"
            value={profile.branding?.accent_color || ''}
            onChange={v => setBrand('accent_color', v)} />

          <Field label="Support email"
            value={profile.branding?.support_email || ''}
            onChange={v => setBrand('support_email', v)} />
          <Field label="Support phone"
            value={profile.branding?.support_phone || ''}
            onChange={v => setBrand('support_phone', v)} />

          <Field label="Play Store URL"
            value={profile.branding?.play_store_url || ''}
            onChange={v => setBrand('play_store_url', v)} />
          <Field label="App Store URL"
            value={profile.branding?.app_store_url || ''}
            onChange={v => setBrand('app_store_url', v)} />
        </div>

        {/* Live preview swatch */}
        {(profile.branding?.primary_color || profile.branding?.accent_color || profile.branding?.logo_url) && (
          <div className="mt-4 rounded-xl border border-gray-200 p-4 flex items-center gap-4">
            {profile.branding?.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.branding.logo_url} alt="Logo preview" className="h-10 w-10 object-contain rounded bg-gray-50" />
            )}
            <div className="flex-1">
              <div className="font-black" style={{ color: profile.branding?.primary_color || '#111' }}>
                {profile.app_name || profile.company || 'Your app'}
              </div>
              {profile.branding?.tagline && (
                <div className="text-xs" style={{ color: profile.branding?.accent_color || '#555' }}>
                  {profile.branding.tagline}
                </div>
              )}
            </div>
            <div className="flex gap-1">
              {profile.branding?.primary_color && <Swatch color={profile.branding.primary_color} label="P" />}
              {profile.branding?.accent_color  && <Swatch color={profile.branding.accent_color}  label="A" />}
            </div>
          </div>
        )}

        <p className="text-xs text-gray-400 mt-3">
          💡 Save karne ke baad ye values white-label app build script me
          <code className="bg-gray-100 px-1 mx-1 rounded">--dart-define</code>
          ke through inject hoti hain.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-bold text-lg mb-2">🔑 API Key</h2>
        <p className="text-sm text-gray-500 mb-3">
          Apne app ke <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">X-Dev-Key</code> header mein yeh bhejo.
        </p>
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mb-3">
          <code className="flex-1 text-sm font-mono truncate">{profile.api_key}</code>
        </div>
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mb-3">
          <span className="text-xs text-gray-500 shrink-0">firm_id:</span>
          <code className="flex-1 text-sm font-mono truncate">{profile.firm_id}</code>
        </div>
        <button onClick={handleRotateKey} disabled={rotating}
          className="px-4 py-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-bold text-sm rounded-lg">
          {rotating ? 'Rotating...' : 'Regenerate API Key'}
        </button>
      </div>

      {/* ── PLAY CONSOLE SHA-1 ──────────────────────────────────────
          Production AAB Play Console pe upload karne ke baad Google
          App Signing apni alag release SHA-1 generate karta hai. Yeh
          SHA Firebase me register hona chahiye warna Google Sign-In
          aapke production app me kaam nahi karega. */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-bold text-lg mb-1">📱 Play Console SHA-1</h2>
        <p className="text-sm text-gray-500 mb-4">
          Production AAB Play Console pe upload karne ke baad Google App Signing apni alag
          release SHA-1 generate karta hai. Woh SHA yahaan paste karo — backend automatically
          Firebase Console me register kar dega, taaki Google Sign-In production builds me kaam kare.
        </p>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900 mb-4">
          <p className="font-bold mb-2">📋 SHA-1 kahan se laaye?</p>
          <ol className="list-decimal list-inside space-y-1 text-amber-800">
            <li>Play Console kholo → apna app select karo</li>
            <li>Setup → <b>App integrity</b> → App signing</li>
            <li>&quot;App signing key certificate&quot; section me <b>SHA-1 certificate fingerprint</b> copy karo</li>
            <li>Format: <code className="bg-white px-1.5 py-0.5 rounded">AB:CD:EF:01:23:...</code> (40 hex chars + colons)</li>
            <li>Yahan paste karke <b>Save</b> dabao</li>
          </ol>
        </div>

        {playSha && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <StatusPill
              label="DB pe saved"
              value={playSha.play_signing_sha1 ? 'Yes' : 'Not set'}
              good={!!playSha.play_signing_sha1}
            />
            <StatusPill
              label="Firebase synced"
              value={playSha.in_sync
                ? 'Yes — production builds ready'
                : (playSha.play_signing_sha1 ? 'Pending — retry on next build' : 'Not set')}
              good={playSha.in_sync}
            />
            {playSha.play_signing_sha1_registered_at && (
              <StatusPill
                label="Last registered"
                value={new Date(playSha.play_signing_sha1_registered_at).toLocaleString('en-IN')}
                good
              />
            )}
            {playSha.firebase_release_sha1 && (
              <StatusPill
                label="Firebase release SHA"
                value={playSha.firebase_release_sha1}
                good mono
              />
            )}
          </div>
        )}

        <label className="block text-sm font-semibold text-gray-700 mb-1">
          Play Console App Signing SHA-1
        </label>
        <input
          className="input-field font-mono"
          placeholder="AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01"
          value={shaInput}
          onChange={e => setShaInput(normaliseShaInput(e.target.value))}
          maxLength={59}
        />
        <p className="text-xs text-gray-500 mt-1">
          {shaInput.replace(/:/g, '').length}/40 hex chars
        </p>

        {shaError   && <div className="mt-3 bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-red-600 text-sm">{shaError}</div>}
        {shaSuccess && <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2 text-emerald-700 text-sm">{shaSuccess}</div>}

        <button
          onClick={handleSavePlaySha}
          disabled={savingSha}
          className="btn-primary px-6 mt-3 flex items-center gap-2 disabled:opacity-60"
        >
          {savingSha ? <Spinner size="sm" /> : null}
          {savingSha ? 'Registering with Firebase...' : '🔐 Save & Register with Firebase'}
        </button>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
        <b>Account Status:</b> {profile.status}
        {profile.status !== 'active' && ' — bookings tabhi count hongi jab admin approve kare.'}
      </div>
    </div>
  );
}

function StatusPill({ label, value, good, mono }: { label: string; value: string; good?: boolean; mono?: boolean }) {
  return (
    <div className={`rounded-xl px-4 py-3 border ${good ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
      <p className="text-[10px] uppercase font-bold tracking-wider text-gray-500">{label}</p>
      <p className={`text-sm mt-0.5 ${mono ? 'font-mono break-all' : 'font-semibold'} ${good ? 'text-green-800' : 'text-amber-800'}`}>{value}</p>
    </div>
  );
}

function Field({ label, value, onChange, readOnly }: { label: string; value: string; onChange?: (v: string) => void; readOnly?: boolean }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>
      <input value={value || ''} onChange={e => onChange?.(e.target.value)} readOnly={readOnly}
        className={`input-field ${readOnly ? 'bg-gray-50 text-gray-500' : ''}`} />
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const hexRe = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
  const valid = !value || hexRe.test(value);
  const displayValue = valid && value ? value : '#000000';
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input value={value || ''} onChange={e => onChange(e.target.value)}
          placeholder="#FFC107"
          className={`input-field flex-1 ${!valid ? 'border-red-300' : ''}`} />
        <input type="color"
          value={displayValue}
          onChange={e => onChange(e.target.value.toUpperCase())}
          className="h-10 w-12 rounded-lg border border-gray-200 cursor-pointer"
          aria-label={`${label} picker`} />
      </div>
      {!valid && <p className="text-xs text-red-600 mt-1">Format: #RGB or #RRGGBB</p>}
    </div>
  );
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-6 h-6 rounded border border-gray-200" style={{ background: color }} />
      <span className="text-xs text-gray-500 font-bold">{label}</span>
    </div>
  );
}
