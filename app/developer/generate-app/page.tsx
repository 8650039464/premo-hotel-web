'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { getDevAuth, devApi, formatDT } from '@/lib/api';
import { Spinner } from '@/components/shared/ui';

// ─────────────────────────────────────────────────────────────────────
//  GENERATE-APP — White-label APK builder (developer-facing)
//
//  Flow:
//   1. Developer clicks "Generate Android APK"
//   2. POST /p/api/developers/build-request  →  202 { job_id }
//   3. Page polls GET /p/api/developers/build-jobs every 5s
//   4. When status flips to 'done', apk_url becomes downloadable
//   5. On 'failed' status, log_tail is shown for self-diagnosis
//
//  Pre-flight UX: page surfaces a branding readiness check (colour +
//  app name set), because the backend will 400 without them.
// ─────────────────────────────────────────────────────────────────────

interface BuildJob {
  _id:         string;
  platform:    string;
  channel:     string;
  status:      'queued' | 'building' | 'done' | 'failed' | 'cancelled';
  apk_url?:    string;
  apk_size?:   number;
  error?:      string;
  log_tail?:   string;
  started_at?: string;
  finished_at?:string;
  createdAt:   string;
  config_snapshot?: {
    app_name?:      string;
    primary_color?: string;
    logo_url?:      string;
  };
}

interface DevMe {
  _id:       string;
  app_name?: string;
  company?:  string;
  firm_id?:  string;
  branding?: {
    primary_color?: string;
    logo_url?:      string;
    tagline?:       string;
  };
}

const STATUS_STYLE: Record<string, string> = {
  queued:    'bg-gray-100 text-gray-700',
  building:  'bg-blue-100 text-blue-700',
  done:      'bg-green-100 text-green-700',
  failed:    'bg-red-100 text-red-700',
  cancelled: 'bg-yellow-100 text-yellow-700',
};

const STATUS_ICON: Record<string, string> = {
  queued:    '⏳',
  building:  '🔨',
  done:      '✅',
  failed:    '❌',
  cancelled: '🚫',
};

export default function GenerateAppPage() {
  const [me, setMe]             = useState<DevMe | null>(null);
  const [jobs, setJobs]         = useState<BuildJob[]>([]);
  const [loading, setLoading]   = useState(true);
  const [requesting, setReqing] = useState(false);
  const [err, setErr]           = useState('');
  const [ok, setOk]             = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [logs, setLogs]         = useState<Record<string, string>>({});
  const [loadingLogs, setLoadingLogs] = useState<Record<string, boolean>>({});
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    void load(true);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll every 5s whenever at least one job is in-flight
  useEffect(() => {
    const hasInflight = jobs.some(j => j.status === 'queued' || j.status === 'building');
    if (hasInflight && !pollRef.current) {
      pollRef.current = setInterval(() => { void load(false); }, 5000);
    }
    if (!hasInflight && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, [jobs]);

  async function load(initial: boolean) {
    const auth = getDevAuth();
    if (!auth) return;
    if (initial) setLoading(true);
    try {
      const [meRes, jobsRes] = await Promise.all([
        devApi.me(auth.token),
        devApi.listBuildJobs(auth.token, 25),
      ]);
      if (meRes.ok)   setMe(meRes.data);
      if (jobsRes.ok) setJobs(jobsRes.data.jobs || []);
      else if (initial) setErr(jobsRes.data?.error || 'Failed to load builds');
    } catch {
      if (initial) setErr('Connection error — retry in a moment.');
    } finally {
      if (initial) setLoading(false);
    }
  }

  async function requestBuild() {
    const auth = getDevAuth();
    if (!auth) return;
    setErr(''); setOk(''); setReqing(true);
    try {
      const { ok, data, status } = await devApi.requestBuild(auth.token, {
        platform: 'android', channel: 'release',
      });
      if (ok) {
        setOk('✓ Build queued. Typical wait: 3–8 minutes.');
        void load(false);
      } else if (status === 429) {
        setErr(data.error || 'Build already in-flight or daily limit hit.');
      } else {
        setErr(data.error || 'Build request failed.');
      }
    } catch {
      setErr('Network error.');
    } finally {
      setReqing(false);
    }
  }

  async function cancelJob(id: string) {
    const auth = getDevAuth();
    if (!auth) return;
    if (!confirm('Cancel this queued build?')) return;
    const { ok, data } = await devApi.cancelBuildJob(auth.token, id);
    if (ok) { setOk('Build cancelled.'); void load(false); }
    else    { setErr(data.error || 'Cancel failed.'); }
  }

  async function toggleLogs(id: string) {
    const wasOpen = Boolean(expanded[id]);
    setExpanded(e => ({ ...e, [id]: !wasOpen }));
    if (wasOpen) return;            // closing — nothing else to do
    if (logs[id]) return;           // already loaded

    const auth = getDevAuth();
    if (!auth) return;
    setLoadingLogs(l => ({ ...l, [id]: true }));
    try {
      const { ok, data } = await devApi.getBuildJob(auth.token, id);
      if (ok && data.job) {
        setLogs(l => ({ ...l, [id]: data.job.log_tail || '(no log output captured)' }));
      } else {
        setLogs(l => ({ ...l, [id]: `Could not load logs: ${data.error || 'unknown error'}` }));
      }
    } catch {
      setLogs(l => ({ ...l, [id]: 'Network error while fetching logs.' }));
    } finally {
      setLoadingLogs(l => ({ ...l, [id]: false }));
    }
  }

  // ── Pre-flight checks ──
  const hasAppName = Boolean((me?.app_name || me?.company || '').trim());
  const hasPrimary = Boolean(me?.branding?.primary_color &&
                             /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(me.branding.primary_color));
  const hasLogo    = Boolean(me?.branding?.logo_url);
  const readyToBuild = hasAppName && hasPrimary;

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-black text-gray-900 mb-2">📱 Generate White-Label App</h1>
      <p className="text-sm text-gray-500 mb-6">
        Apne branding settings se Android APK generate karo. Har booking ka markup aapki wallet mein jayega —
        apni Play Store listing bhi allowed hai.
      </p>

      {/* Readiness card */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-5">
        <h3 className="font-bold text-gray-800 mb-3">Pre-flight checklist</h3>
        <ul className="space-y-2 text-sm">
          <Check ok={hasAppName} label="App name set"        hint="Settings → App name / Company" />
          <Check ok={hasPrimary} label="Primary colour set"  hint="Settings → Branding → Primary colour (hex)" />
          <Check ok={hasLogo}    label="Logo URL set"        hint="Optional — Premo default use hoga agar missing"
                 optional />
        </ul>
        {!readyToBuild && (
          <Link href="/developer/settings"
                className="inline-block mt-4 px-4 py-2 bg-primary text-black font-bold rounded-lg text-sm">
            ⚙️ Open Settings
          </Link>
        )}
      </div>

      {err && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm mb-4">
          {err}
        </div>
      )}
      {ok && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-green-700 text-sm mb-4">
          {ok}
        </div>
      )}

      {/* Action bar */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="font-bold text-gray-800">Build a new APK</div>
          <div className="text-xs text-gray-500 mt-0.5">
            Max 10/day · 1 in-flight at a time · Android release channel only (v1)
          </div>
        </div>
        <button
          onClick={requestBuild}
          disabled={!readyToBuild || requesting}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
          {requesting ? <Spinner size="sm" /> : '🚀'}
          {requesting ? 'Queuing…' : 'Generate Android APK'}
        </button>
      </div>

      {/* Jobs table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-800">Recent builds</h3>
          <button onClick={() => void load(false)} className="text-xs text-gray-500 hover:text-gray-800">
            Refresh
          </button>
        </div>
        {jobs.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-400">
            No builds yet. Settings fill karo aur first APK generate karo.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {jobs.map(j => (
              <div key={j._id} className="px-5 py-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${STATUS_STYLE[j.status] || 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_ICON[j.status]} {j.status.toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-800 truncate">
                        {j.config_snapshot?.app_name || '(no name)'}
                        <span className="text-gray-400 font-normal"> · {j.platform}</span>
                      </div>
                      <div className="text-xs text-gray-400">
                        #{String(j._id).slice(-8)} · {formatDT(j.createdAt)}
                        {j.finished_at && ` · finished ${formatDT(j.finished_at)}`}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {j.status === 'queued' && (
                      <button onClick={() => cancelJob(j._id)}
                              className="text-xs text-red-500 hover:text-red-700 font-semibold">
                        Cancel
                      </button>
                    )}
                    {j.status === 'done' && j.apk_url && (
                      <a href={j.apk_url} download
                         className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg">
                        ⬇️ Download APK{j.apk_size ? ` (${(j.apk_size / 1024 / 1024).toFixed(1)} MB)` : ''}
                      </a>
                    )}
                    {j.status === 'failed' && (
                      <button onClick={() => void toggleLogs(j._id)}
                              className="text-xs text-gray-500 hover:text-gray-800 font-semibold">
                        {loadingLogs[j._id] ? 'Loading…' : (expanded[j._id] ? 'Hide' : 'Show')} logs
                      </button>
                    )}
                  </div>
                </div>

                {j.status === 'building' && (
                  <div className="mt-3 h-1 bg-blue-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 animate-pulse w-1/3" />
                  </div>
                )}

                {j.status === 'failed' && (
                  <div className="mt-3">
                    <div className="text-xs text-red-600">
                      <span className="font-semibold">Error:</span> {j.error || 'Unknown error'}
                    </div>
                    {expanded[j._id] && (
                      <pre className="mt-2 p-3 bg-gray-900 text-gray-100 text-[10px] leading-relaxed rounded-lg max-h-80 overflow-auto whitespace-pre-wrap">
                        {logs[j._id] || (loadingLogs[j._id] ? 'Loading logs…' : 'No logs available.')}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 text-xs text-gray-400">
        APK generate hone mein usually 3–8 min lagte hain (Flutter release build + gradle). Window band
        karne pe bhi build chalta rahega — wapas aake status check kar sakte ho.
      </div>
    </div>
  );
}

function Check({ ok, label, hint, optional }: { ok: boolean; label: string; hint?: string; optional?: boolean }) {
  const badge = ok ? '✅' : optional ? '○' : '❌';
  const color = ok ? 'text-green-700' : optional ? 'text-gray-400' : 'text-red-600';
  return (
    <li className="flex items-start gap-2">
      <span className={color}>{badge}</span>
      <div>
        <div className={`font-semibold ${color}`}>{label}{optional && !ok && <span className="text-gray-400 font-normal"> (optional)</span>}</div>
        {hint && <div className="text-xs text-gray-400">{hint}</div>}
      </div>
    </li>
  );
}
