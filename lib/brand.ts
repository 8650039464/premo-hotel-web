// ═══════════════════════════════════════════════════════════════════════
//  BRAND HELPER (client-side)
//
//  Reads the `premo-brand` cookie set by edge middleware (middleware.ts)
//  and exposes app_name, logo, support contact, etc. to client components.
//
//  Server components should read the cookie directly via `cookies()` from
//  next/headers — see app/layout.tsx for the pattern.
//
//  Why a cookie and not a Context provider?
//    The cookie is already available everywhere (server + client) without
//    wrapping the tree. SSR + client-hydration both see the same value.
//    Context would require injecting a provider in every layout and would
//    not work for server components.
// ═══════════════════════════════════════════════════════════════════════

export type Brand = {
    firm_id:                 string;
    app_name:                string;
    // Developer's markup % added on top of hotel cost. 0 on Premo's own
    // domain. Set from the brand cookie populated by the edge middleware.
    markup_percent:          number;
    // Premo's platform brokerage %. Same value across all hosts (Premo's
    // own domain AND custom developer domains both add this on top of the
    // hotel's listed cost). Fetched from backend by middleware on custom
    // domains; on Premo's own domain, frontend lazy-fetches via /commission/public.
    premo_brokerage_percent: number;
    branding: {
        logo_url?:          string;
        primary_color?:     string;
        accent_color?:      string;
        support_email?:     string;
        support_phone?:     string;
        tagline?:           string;
        play_store_url?:    string;
        app_store_url?:     string;
        show_premo_footer?: boolean;     // controlled by developer in /settings
    };
};

export const DEFAULT_BRAND: Brand = {
    firm_id:                 '',
    app_name:                'PREMO',
    markup_percent:          0,         // Premo's first-party site has no dev markup
    premo_brokerage_percent: 0,         // overwritten on first /commission/public fetch
    branding: {
        primary_color:     '#FDC507',
        accent_color:      '#111827',
        tagline:           'Hourly hotel bookings, simplified',
        show_premo_footer: true,
    },
};

/**
 * Reads the brand cookie. Safe to call from any client component.
 * On the server this returns DEFAULT_BRAND because document.cookie is
 * undefined — for server components, read cookies() directly from
 * next/headers instead (see app/layout.tsx).
 */
export function getBrand(): Brand {
    if (typeof document === 'undefined') return DEFAULT_BRAND;

    const raw = document.cookie
        .split(';')
        .map(s => s.trim())
        .find(s => s.startsWith('premo-brand='));
    if (!raw) return DEFAULT_BRAND;

    try {
        const value  = decodeURIComponent(raw.split('=').slice(1).join('='));
        const parsed = JSON.parse(value);
        return {
            firm_id:                 parsed.firm_id  || '',
            app_name:                parsed.app_name || DEFAULT_BRAND.app_name,
            markup_percent:          Number(parsed.markup_percent) || 0,
            premo_brokerage_percent: Number(parsed.premo_brokerage_percent) || 0,
            branding:                { ...DEFAULT_BRAND.branding, ...(parsed.branding || {}) },
        };
    } catch {
        return DEFAULT_BRAND;
    }
}

// ─── Premo brokerage cache (default domain) ──────────────────────────
//  On Premo's own domain there's no brand cookie, so the brokerage % isn't
//  baked in. We fetch it once per page load and cache it in localStorage
//  (TTL 5 min) so the user/hotel pages can apply it to displayed prices
//  without each component making its own request.
const BROKERAGE_CACHE_KEY = 'premo-brokerage-cache';
const BROKERAGE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function getCachedBrokeragePercent(): number {
    if (typeof window === 'undefined') return 0;
    try {
        const raw = localStorage.getItem(BROKERAGE_CACHE_KEY);
        if (!raw) return 0;
        const parsed = JSON.parse(raw);
        if (Date.now() - parsed.ts > BROKERAGE_CACHE_TTL) return 0;
        return Number(parsed.pct) || 0;
    } catch { return 0; }
}

export function setCachedBrokeragePercent(pct: number): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(BROKERAGE_CACHE_KEY, JSON.stringify({ pct, ts: Date.now() }));
    } catch { /* quota exceeded — ignore */ }
}

/**
 * Apply the full additive pricing to a hotel-set cost for display:
 *   display = hotelCost + (hotelCost * brokerage%) + (hotelCost * markup%)
 *
 * On Premo's own domain: only brokerage is added (markup = 0).
 * On a developer's custom domain: both brokerage and developer markup are added.
 *
 * The brokerage % comes from the brand cookie (custom domain) OR the
 * localStorage cache (Premo default domain — see fetchAndCacheBrokerage).
 *
 * Rounded to integer rupees — backend re-computes the exact charge at
 * payment time, this is purely for display consistency.
 */
export function withMarkup(basePrice: number, brand?: Brand): number {
    const b = brand || getBrand();
    const brokeragePct = b.premo_brokerage_percent || getCachedBrokeragePercent();
    const markupPct    = b.markup_percent || 0;
    if (!brokeragePct && !markupPct) return basePrice;
    const marked = basePrice * (1 + (brokeragePct + markupPct) / 100);
    return Math.round(marked);
}

/**
 * React hook variant — same value, suitable for client components.
 * Re-evaluates only on mount (cookie rarely changes mid-session).
 */
export function useBrand(): Brand {
    // Intentionally not using useState/useEffect — we just want the cookie
    // value at render time. If the cookie is updated by middleware, the
    // next navigation will pick up the new value automatically.
    return getBrand();
}

/**
 * Helper: returns firm_id as a header to pass through to API calls so
 * bookings made on a custom domain are correctly attributed to the
 * developer's wallet.
 */
export function brandFirmHeader(): Record<string, string> {
    const b = getBrand();
    return b.firm_id ? { 'X-Premo-Firm': b.firm_id } : {};
}
