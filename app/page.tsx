// ═══════════════════════════════════════════════════════════════════════
//  ROOT LANDING (premo.app / *.vercel.app)
//
//  Server component — reads `premo-brand` cookie set by edge middleware
//  so the title / tagline / footer reflect the current host's branding
//  even though this page is also reachable from default Premo domain.
//
//  On custom domains the middleware now redirects `/` → `/user`, so this
//  landing is only rendered on premo-hotel-web.vercel.app (or premo.app)
//  where the 5-role picker makes sense. The branding-aware rendering is
//  still kept so the default brand string stays consistent everywhere.
// ═══════════════════════════════════════════════════════════════════════
import { cookies } from 'next/headers';
import LandingClient from './_LandingClient';

type BrandShape = {
  firm_id: string;
  app_name: string;
  branding: { tagline?: string; logo_url?: string; show_premo_footer?: boolean };
};

const DEFAULT: BrandShape = {
  firm_id:  '',
  app_name: 'PREMO',
  branding: { tagline: 'Hotel Booking Platform', show_premo_footer: true },
};

async function readBrand(): Promise<BrandShape> {
  try {
    const c = (await cookies()).get('premo-brand');
    if (!c?.value) return DEFAULT;
    const parsed = JSON.parse(c.value);
    return {
      firm_id:  parsed.firm_id  || '',
      app_name: parsed.app_name || DEFAULT.app_name,
      branding: { ...DEFAULT.branding, ...(parsed.branding || {}) },
    };
  } catch { return DEFAULT; }
}

export default async function Home() {
  const brand = await readBrand();
  return <LandingClient brand={brand} />;
}
