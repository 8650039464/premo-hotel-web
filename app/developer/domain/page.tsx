'use client';
// ═══════════════════════════════════════════════════════════════════════
//  DEVELOPER PORTAL — Custom Domain page
//
//  Full lifecycle:
//    1. No domain   → form to enter domain
//    2. verify_pending → show TXT + CNAME instructions, "Verify" button
//    3. verifying  → polling for SSL provisioning (every 5s)
//    4. live       → show domain link, "Disconnect" option
//    5. failed     → show error, allow retry
//
//  Polling stops as soon as we hit `live` to avoid wasting cycles.
// ═══════════════════════════════════════════════════════════════════════
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getDevAuth, devApi } from '@/lib/api';
import { Spinner } from '@/components/shared/ui';

type Status = 'none' | 'verify_pending' | 'verifying' | 'live' | 'failed';

interface DomainState {
    domain:      string;
    status:      Status;
    error:       string;
    added_at:    string | null;
    verified_at: string | null;
}

interface AddInstructions {
    txt_record:   { host: string; value: string; type: string; note: string };
    cname_record: { host: string; value: string; type: string; note: string };
    next_step:    string;
}

export default function CustomDomainPage() {
    const router = useRouter();
    const [state, setState]   = useState<DomainState | null>(null);
    const [loading, setLoad]  = useState(true);
    const [err, setErr]       = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [domainInput, setDomainInput] = useState('');
    const [instructions, setInstructions] = useState<AddInstructions | null>(null);

    // ── load + polling ─────────────────────────────────────────────────
    const load = useCallback(async () => {
        const auth = getDevAuth();
        if (!auth) { router.replace('/developer/login'); return null; }
        const r = await devApi.domainStatus(auth.token);
        if (r.ok) {
            setState(r.data);
            return r.data as DomainState;
        }
        setErr(r.data?.error || 'Failed to load domain status');
        return null;
    }, [router]);

    useEffect(() => {
        (async () => { await load(); setLoad(false); })();
    }, [load]);

    useEffect(() => {
        if (state?.status !== 'verifying') return;
        const id = setInterval(async () => {
            const next = await load();
            if (next?.status === 'live' || next?.status === 'failed') {
                clearInterval(id);
            }
        }, 5000);
        return () => clearInterval(id);
    }, [state?.status, load]);

    // ── handlers ───────────────────────────────────────────────────────
    async function handleAdd(e: React.FormEvent) {
        e.preventDefault();
        const auth = getDevAuth();
        if (!auth) return;

        const cleaned = domainInput.trim().toLowerCase()
            .replace(/^https?:\/\//, '').replace(/\/.*$/, '');
        if (!cleaned || !cleaned.includes('.')) {
            setErr('Enter a valid domain like myhotelapp.com');
            return;
        }

        setSubmitting(true); setErr('');
        const r = await devApi.domainAdd(auth.token, cleaned);
        setSubmitting(false);
        if (!r.ok) {
            setErr(r.data?.error || 'Failed to add domain');
            return;
        }
        setInstructions(r.data.instructions);
        await load();
    }

    async function handleVerify() {
        const auth = getDevAuth();
        if (!auth) return;
        setSubmitting(true); setErr('');
        const r = await devApi.domainVerify(auth.token);
        setSubmitting(false);
        if (!r.ok) {
            setErr(r.data?.error || 'Verification failed');
            return;
        }
        await load();
    }

    async function handleDisconnect() {
        const auth = getDevAuth();
        if (!auth) return;
        if (!confirm('Disconnect this domain? Your custom domain will stop working immediately.')) return;
        setSubmitting(true); setErr('');
        const r = await devApi.domainRemove(auth.token);
        setSubmitting(false);
        if (!r.ok) {
            setErr(r.data?.error || 'Failed to disconnect');
            return;
        }
        setInstructions(null);
        setDomainInput('');
        await load();
    }

    async function reshowInstructions() {
        const auth = getDevAuth();
        if (!auth || !state?.domain) return;
        // Re-add with same domain just rotates the token & returns instructions
        setSubmitting(true); setErr('');
        const r = await devApi.domainAdd(auth.token, state.domain);
        setSubmitting(false);
        if (r.ok) setInstructions(r.data.instructions);
        else setErr(r.data?.error || 'Failed to fetch instructions');
    }

    // ── render ─────────────────────────────────────────────────────────
    if (loading) return <div className="flex justify-center py-20"><Spinner /></div>;

    return (
        <div className="space-y-6 max-w-3xl">
            <div>
                <h1 className="text-2xl font-black text-gray-900">🌐 Custom Domain</h1>
                <p className="text-gray-500 text-sm mt-1">
                    Apna domain Premo se connect karo. Visitors ko aapki branding wali Premo website dikhegi.
                </p>
            </div>

            {err && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
                    {err}
                </div>
            )}

            {/* ── State machine UI ───────────────────────────── */}
            {(!state || state.status === 'none') && (
                <AddDomainForm
                    value={domainInput}
                    onChange={setDomainInput}
                    onSubmit={handleAdd}
                    submitting={submitting}
                />
            )}

            {state && state.status !== 'none' && (
                <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <div>
                            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Your domain</div>
                            <div className="font-mono text-lg font-bold mt-1">{state.domain}</div>
                        </div>
                        <StatusBadge status={state.status} />
                    </div>

                    {state.error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
                            ❌ {state.error}
                        </div>
                    )}

                    {state.status === 'verify_pending' && (
                        <>
                            {!instructions && (
                                <button
                                    onClick={reshowInstructions}
                                    disabled={submitting}
                                    className="text-sm text-blue-600 underline"
                                >
                                    Show DNS instructions again
                                </button>
                            )}
                            {instructions && <DnsInstructions instructions={instructions} />}
                            <div className="flex gap-2 flex-wrap">
                                <button
                                    onClick={handleVerify}
                                    disabled={submitting}
                                    className="btn-primary"
                                >
                                    {submitting ? 'Verifying…' : '✓ I\'ve added the records — Verify'}
                                </button>
                                <button
                                    onClick={handleDisconnect}
                                    disabled={submitting}
                                    className="px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 rounded-lg"
                                >
                                    Cancel
                                </button>
                            </div>
                        </>
                    )}

                    {state.status === 'verifying' && (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800 flex items-center gap-3">
                            <Spinner />
                            <div>
                                <b>SSL provisioning in progress…</b>
                                <div className="text-xs opacity-80 mt-0.5">Vercel issue Let's Encrypt cert. Usually &lt;60s. Page khud refresh hogi.</div>
                            </div>
                        </div>
                    )}

                    {state.status === 'live' && (
                        <>
                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-800">
                                ✅ <b>Live!</b> Visitors aapki branded website {state.domain} pe access kar sakte hain.
                            </div>
                            <a
                                href={`https://${state.domain}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-block btn-primary"
                            >
                                Visit https://{state.domain} ↗
                            </a>
                            <button
                                onClick={handleDisconnect}
                                disabled={submitting}
                                className="ml-2 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 rounded-lg"
                            >
                                Disconnect domain
                            </button>
                        </>
                    )}

                    {state.status === 'failed' && (
                        <div className="flex gap-2">
                            <button onClick={handleVerify} disabled={submitting} className="btn-primary">
                                Retry verification
                            </button>
                            <button
                                onClick={handleDisconnect}
                                disabled={submitting}
                                className="px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 rounded-lg"
                            >
                                Remove & start over
                            </button>
                        </div>
                    )}
                </div>
            )}

            <HelpBox />
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════
//  Sub-components
// ═══════════════════════════════════════════════════════════════════
function AddDomainForm({
    value, onChange, onSubmit, submitting,
}: {
    value: string;
    onChange: (v: string) => void;
    onSubmit: (e: React.FormEvent) => void;
    submitting: boolean;
}) {
    return (
        <form onSubmit={onSubmit} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-3">
            <label className="block text-sm font-semibold text-gray-700">
                Domain name (apex/root form)
            </label>
            <input
                type="text"
                placeholder="myhotelapp.com"
                value={value}
                onChange={e => onChange(e.target.value)}
                className="input-field font-mono"
            />
            <p className="text-xs text-gray-500">
                Sirf domain — <code>https://</code>, <code>www.</code> ya path nahi. Example: <code>myhotelapp.com</code>
            </p>
            <button type="submit" disabled={submitting || !value.trim()} className="btn-primary">
                {submitting ? 'Adding…' : 'Connect domain →'}
            </button>
        </form>
    );
}

function StatusBadge({ status }: { status: Status }) {
    const map: Record<Status, { label: string; cls: string }> = {
        none:           { label: 'Not connected',  cls: 'bg-gray-100 text-gray-600' },
        verify_pending: { label: 'Awaiting DNS',   cls: 'bg-amber-100 text-amber-800' },
        verifying:      { label: 'Provisioning…', cls: 'bg-blue-100 text-blue-700' },
        live:           { label: 'Live ✓',         cls: 'bg-emerald-100 text-emerald-800' },
        failed:         { label: 'Failed',         cls: 'bg-red-100 text-red-700' },
    };
    const m = map[status] || map.none;
    return (
        <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold ${m.cls}`}>
            {m.label}
        </span>
    );
}

function DnsInstructions({ instructions }: { instructions: AddInstructions }) {
    return (
        <div className="space-y-3">
            <div className="text-sm font-semibold text-gray-700">
                Apne domain registrar (GoDaddy / Namecheap / Hostinger / etc.) ke DNS settings me ye 2 records add karo:
            </div>

            <DnsRow label="1. TXT record (proves ownership)" record={instructions.txt_record} />
            <DnsRow label="2. CNAME record (routes traffic)" record={instructions.cname_record} />

            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-800">
                ⏱ DNS propagation me 1–60 minute lag sakte hain. Records add karne ke baad <b>Verify</b> dabao.
            </div>
        </div>
    );
}

function DnsRow({ label, record }: { label: string; record: AddInstructions['txt_record'] }) {
    return (
        <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 text-sm">
            <div className="font-semibold mb-2">{label}</div>
            <div className="grid grid-cols-[80px_1fr] gap-y-1 gap-x-3 font-mono text-xs">
                <div className="text-gray-500">Type</div>
                <div>{record.type}</div>
                <div className="text-gray-500">Host</div>
                <div className="break-all">{record.host}</div>
                <div className="text-gray-500">Value</div>
                <div className="break-all">{record.value}</div>
            </div>
            <div className="text-xs text-gray-500 mt-2 italic">{record.note}</div>
        </div>
    );
}

function HelpBox() {
    return (
        <details className="bg-white border border-gray-100 rounded-xl p-4 text-sm">
            <summary className="font-semibold cursor-pointer">❓ Need help with DNS?</summary>
            <div className="mt-3 space-y-2 text-gray-700">
                <p>
                    Aapke domain registrar ke control panel me <b>DNS</b> ya <b>DNS Records</b> section dhundo.
                    Wahan "Add record" karke ek-ek karke 2 records add karo (TXT first, fir CNAME).
                </p>
                <p>
                    Agar aapke registrar par <code>@</code> CNAME allowed nahi hai (Hostinger, GoDaddy me kabhi-kabhi nahi hota),
                    to <b>ALIAS</b> ya <b>ANAME</b> use karo — same value <code>cname.vercel-dns.com</code>.
                </p>
                <p>
                    Agar email pehle se chal raha hai (MX records), unhe mat chedo — sirf TXT aur CNAME add karo.
                </p>
            </div>
        </details>
    );
}
