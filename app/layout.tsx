// ═══════════════════════════════════════════════════════════════════════
//  ROOT LAYOUT — handles white-label branding injection
//
//  Edge middleware (middleware.ts) sets a `premo-brand` cookie when the
//  request comes from a custom domain. This layout reads it server-side
//  (no client flash) and:
//    • Sets <title> to developer's app_name
//    • Injects CSS variables (--primary, --primary-dark, --accent) into
//      :root so every Tailwind `bg-primary` / `text-primary` etc. picks
//      up the developer's colors automatically.
//    • Falls back to default Premo branding if no cookie present.
//
//  Logo, support contact, and other branding bits are read by individual
//  pages/components from the same cookie via a small `useBrand()` hook.
// ═══════════════════════════════════════════════════════════════════════
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import './globals.css';

type Branding = {
    logo_url:       string;
    primary_color:  string;
    accent_color:   string;
    support_email:  string;
    support_phone:  string;
    tagline:        string;
    play_store_url: string;
    app_store_url:  string;
};

type BrandPayload = {
    firm_id:  string;
    app_name: string;
    branding: Partial<Branding>;
};

const DEFAULT_BRAND: BrandPayload = {
    firm_id:  '',
    app_name: 'PREMO',
    branding: {
        primary_color: '#FDC507',
        accent_color:  '#111827',
        tagline:       'Hourly hotel bookings, simplified',
    },
};

async function readBrandCookie(): Promise<BrandPayload> {
    try {
        const c = (await cookies()).get('premo-brand');
        if (!c?.value) return DEFAULT_BRAND;
        const parsed = JSON.parse(c.value);
        return {
            firm_id:  parsed.firm_id  || '',
            app_name: parsed.app_name || DEFAULT_BRAND.app_name,
            branding: { ...DEFAULT_BRAND.branding, ...(parsed.branding || {}) },
        };
    } catch {
        return DEFAULT_BRAND;
    }
}

// Helper: parse a hex color into [r, g, b] integers. Returns null if invalid.
function parseHex(hex: string): [number, number, number] | null {
    const m = /^#?([a-f\d]{6})$/i.exec(hex.trim());
    if (!m) return null;
    const num = parseInt(m[1], 16);
    return [(num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff];
}

// Helper: lighten a hex color by mixing with white (percent > 0) or darken
// (percent < 0). Returns "R G B" triplet string for CSS variable use.
function shadeToTriplet(hex: string, percent: number): string {
    const rgb = parseHex(hex);
    if (!rgb) return '253 197 7'; // fallback to default primary
    const adjust = (c: number) =>
        Math.max(0, Math.min(255, Math.round(c + (percent < 0 ? c : 255 - c) * percent)));
    return rgb.map(adjust).join(' ');
}

// Helper: convert hex → "R G B" triplet for direct CSS variable use.
function hexToTriplet(hex: string, fallback: string): string {
    const rgb = parseHex(hex);
    return rgb ? rgb.join(' ') : fallback;
}

export async function generateMetadata(): Promise<Metadata> {
    const brand = await readBrandCookie();
    const tagline = brand.branding.tagline || 'Hotel Booking';
    return {
        title:       `${brand.app_name} — ${tagline}`,
        description: tagline,
        icons:       brand.branding.logo_url ? [{ url: brand.branding.logo_url }] : undefined,
    };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
    const brand   = await readBrandCookie();
    const primary = brand.branding.primary_color || '#FDC507';
    const accent  = brand.branding.accent_color  || '#111827';

    // CSS variable overrides for this request — injected via inline <style>.
    // Values are emitted as space-separated RGB triplets (e.g. "253 197 7")
    // so Tailwind opacity modifiers like `bg-primary/20` resolve correctly via
    // `rgb(var(--primary) / <alpha-value>)` (configured in tailwind.config.js).
    const cssOverride = `:root{
        --primary: ${hexToTriplet(primary, '253 197 7')};
        --primary-dark: ${shadeToTriplet(primary, -0.18)};
        --primary-light: ${shadeToTriplet(primary,  0.78)};
        --accent: ${hexToTriplet(accent, '17 24 39')};
    }`;

    return (
        <html lang="en">
            <head>
                <style dangerouslySetInnerHTML={{ __html: cssOverride }} />
            </head>
            <body className="min-h-screen bg-gray-50">{children}</body>
        </html>
    );
}
