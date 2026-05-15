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
    firm_id:  string;
    app_name: string;
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
    firm_id:  '',
    app_name: 'PREMO',
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
            firm_id:  parsed.firm_id  || '',
            app_name: parsed.app_name || DEFAULT_BRAND.app_name,
            branding: { ...DEFAULT_BRAND.branding, ...(parsed.branding || {}) },
        };
    } catch {
        return DEFAULT_BRAND;
    }
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
