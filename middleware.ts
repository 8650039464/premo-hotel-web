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
    //
    //  Render free tier server idle 15 min ke baad sleep ho jaata hai aur
    //  cold start 30-60 sec leta hai. Single 5 sec request fail ho jaati
    //  thi → middleware default brand serve kar deta tha → developer ko
    //  apni branded site ki jagah default Premo dikhti thi (flaky UX).
    //
    //  Fix: do attempts with progressively longer timeouts. First attempt
    //  4 sec — fast path for warm servers. Second attempt 14 sec — gives
    //  cold start enough room. Vercel Edge ka overall budget 30 sec hai.
    //  ────────────────────────────────────────────────────────────────────
    const fetchByDomain = async (timeoutMs: number): Promise<Response | null> => {
        try {
            // Route is mounted at /p/api/developers/* in server.js — NOT /p/api/*.
            // Earlier bug: the path was /p/api/public/by-domain (missing the
            // `developers` segment) so Express returned 404 for every host,
            // even for valid live domains. Verified in p_DeveloperRoutes.js:
            //   router.get('/public/by-domain', ...)   ← relative to the
            //   `/p/api/developers` mount in server.js.
            const lookupUrl = `${API_BASE}/p/api/developers/public/by-domain?host=${encodeURIComponent(host)}`;
            return await fetch(lookupUrl, {
                signal:  AbortSignal.timeout(timeoutMs),
                cache:   'no-store',
                headers: { 'User-Agent': 'premo-edge-middleware' },
            });
        } catch { return null; }
    };

    let firmData: {
        firm_id: string;
        branding: Record<string, string>;
        app_name: string;
        markup_percent?: number;
        premo_brokerage_percent?: number;
    } | null = null;
    try {
        let r = await fetchByDomain(4000);
        // Cold start retry — sirf tabhi jab pehli call timeout / connection
        // error se fail hui (r === null). 4xx / 5xx pe retry nahi karte.
        if (r === null) {
            r = await fetchByDomain(14_000);
        }

        if (r && r.ok) {
            firmData = await r.json();
        } else if (r && r.status === 404) {
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
        // Other status (5xx, or both attempts failed): continue with default
        // brand so the site remains usable instead of erroring out.
    } catch (e) {
        console.error('[middleware] by-domain fetch failed:', (e as Error).message);
        return NextResponse.next();
    }

    if (!firmData) return NextResponse.next();

    // ── Custom-domain access policy ───────────────────────────────────
    //  A developer's branded domain (e.g. exyrix.com) is for END USERS
    //  only. Hotel admin / sales / super-admin / developer portals are
    //  Premo's internal B2B surfaces — they must NOT be reachable from
    //  the developer's branded domain (confusing for the dev's customers
    //  and a UX/security concern). On custom domains:
    //    • `/` → redirect to `/user`
    //    • `/hotel-admin/*`, `/sales/*`, `/super-admin/*`, `/developer/*`
    //      → redirect to `/user`
    //  These business-side users keep logging in via the default Premo
    //  domain (premo-hotel-web.vercel.app or premo.app).
    const url = request.nextUrl;
    const path = url.pathname;
    const BLOCKED_PREFIXES = ['/hotel-admin', '/super-admin', '/developer', '/sales'];
    const isBlocked = BLOCKED_PREFIXES.some(p => path === p || path.startsWith(p + '/'));
    if (path === '/' || isBlocked) {
        const redirectUrl = url.clone();
        redirectUrl.pathname = '/user';
        redirectUrl.search = '';
        return NextResponse.redirect(redirectUrl, 307);
    }

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
        firm_id:                 firmData.firm_id,
        app_name:                firmData.app_name,
        branding:                firmData.branding,
        markup_percent:          firmData.markup_percent || 0,
        premo_brokerage_percent: firmData.premo_brokerage_percent || 0,
    });
    response.cookies.set('premo-brand', brandingPayload, {
        path:     '/',
        // 30s — short enough that super-admin brokerage changes and dev
        // markup updates propagate to live custom-domain visitors quickly.
        // The middleware itself re-fetches on every request anyway; this
        // cookie is the client-side cache.
        maxAge:   300,
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
