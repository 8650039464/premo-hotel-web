// ═══════════════════════════════════════════════════════════════════════
//  HOSTNAME → BRANDING MIDDLEWARE
//
//  Runs on every request at the Vercel Edge. Inspects the Host header
//  and decides which developer's branding to apply (if any).
//
//  Decision tree:
//    1. Default Premo hosts (premo.app, premo.com, *.vercel.app, localhost)
//       → no branding lookup, continue with default theme.
//    2. Any other host → look up `/p/api/public/by-domain?host=X` on backend
//       → if found, set `premo-firm-id` cookie + `x-premo-firm` header so
//         downstream pages/components use developer's branding.
//       → if NOT found, return a friendly 404 ("Domain not yet provisioned").
//
//  Why cookie AND header?
//    Header   → server components in this same request can read it
//                (preferred over cookie because it's request-scoped)
//    Cookie   → client components on subsequent navigations can read it
//                without a fetch round-trip
//
//  Why not just SSR fetch every page? Edge middleware is FAR cheaper than
//  per-page fetches and runs once per request, before any rendering.
//
//  Required env: NEXT_PUBLIC_API_BASE (set in Vercel project settings)
// ═══════════════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server';

const PREMO_HOSTS = new Set([
    'premo.app',
    'www.premo.app',
    'premo.com',
    'www.premo.com',
    'premo.in',
    'www.premo.in',
]);

// Vercel preview/production deployments end with these. Treat as default-branded.
const PREMO_HOST_SUFFIXES = ['.vercel.app'];

// Local dev — treat as default brand
const LOCAL_HOST_PREFIXES = ['localhost', '127.0.0.1', '192.168.', '0.0.0.0'];

function isPremoHost(host: string): boolean {
    if (!host) return true; // safety: no host header → default brand
    const h = host.toLowerCase().split(':')[0]; // strip port

    if (PREMO_HOSTS.has(h)) return true;
    if (PREMO_HOST_SUFFIXES.some(s => h.endsWith(s))) return true;
    if (LOCAL_HOST_PREFIXES.some(p => h.startsWith(p))) return true;

    return false;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export async function middleware(request: NextRequest) {
    const host = request.headers.get('host') || '';

    // Default brand → just continue
    if (isPremoHost(host)) {
        return NextResponse.next();
    }

    // No API configured → fail safe rather than blocking traffic
    if (!API_BASE) {
        console.error('[middleware] NEXT_PUBLIC_API_BASE not set — skipping branding lookup');
        return NextResponse.next();
    }

    // ── Custom domain — look up developer ────────────────────────────────
    let firmData: { firm_id: string; branding: Record<string, string>; app_name: string } | null = null;
    try {
        const lookupUrl = `${API_BASE}/p/api/public/by-domain?host=${encodeURIComponent(host)}`;
        const r = await fetch(lookupUrl, {
            // Edge fetch: short timeout (Vercel kills middleware after 30s anyway,
            // but we want to fail fast and let the user retry).
            signal: AbortSignal.timeout(5000),
            // Don't send cookies, this is server-to-server
            cache: 'no-store',
            headers: { 'User-Agent': 'premo-edge-middleware' },
        });
        if (r.ok) {
            firmData = await r.json();
        } else if (r.status === 404) {
            // Unknown custom domain — show friendly page
            return new NextResponse(
                `<!DOCTYPE html><html><head><title>Not provisioned</title>
<style>body{font-family:system-ui;text-align:center;padding:80px 20px;background:#fafafa}
h1{color:#111;font-size:28px}p{color:#555;margin-top:12px}</style></head><body>
<h1>This domain isn't connected to Premo yet.</h1>
<p>If you're the owner, please complete domain setup in your Developer Portal.</p>
</body></html>`,
                { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } }
            );
        }
        // Other status: continue with default brand to keep site usable
    } catch (e) {
        console.error('[middleware] by-domain fetch failed:', (e as Error).message);
        // Don't block traffic on transient API hiccup
        return NextResponse.next();
    }

    if (!firmData) return NextResponse.next();

    // ── Inject branding into request + response ─────────────────────────
    const response = NextResponse.next({
        request: {
            headers: new Headers(request.headers),
        },
    });

    // Header on the *response* — picked up by Server Components in this request
    response.headers.set('x-premo-firm-id',  firmData.firm_id);
    response.headers.set('x-premo-app-name', firmData.app_name || 'Hotel Booking');

    // Cookie for client components — short max-age so changes propagate
    // when developer updates branding (alongside the 60s API cache).
    const brandingPayload = JSON.stringify({
        firm_id:  firmData.firm_id,
        app_name: firmData.app_name,
        branding: firmData.branding,
    });
    response.cookies.set('premo-brand', brandingPayload, {
        path:     '/',
        maxAge:   60,                  // refreshed every minute
        sameSite: 'lax',
        httpOnly: false,               // client JS needs to read it
    });

    return response;
}

// Skip middleware on Next.js internals and static assets — no point looking
// up branding for /_next/static/chunks/*.js etc.
export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:js|css|png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|map)$).*)',
    ],
};
