'use client';
import { useEffect, useRef, useState } from 'react';
import { Spinner } from './ui';
import { getBrand } from '@/lib/brand';
import { API_ROOT } from '@/lib/api';

// ═══════════════════════════════════════════════════════════════
//  GoogleLoginButton — reusable Google Sign-In wrapper
//
//  Loads the Google Identity Services script once and renders the
//  official Google "Sign in with G" button. On success it forwards
//  the credential (id_token) to a parent-supplied handler so each
//  portal (user / hotel / sales / developer) can route it to the
//  correct backend endpoint.
//
//  Required env: NEXT_PUBLIC_GOOGLE_CLIENT_ID (set in Vercel + .env.local)
//
//  Super admin intentionally does NOT use this — too sensitive,
//  email+password only.
// ═══════════════════════════════════════════════════════════════

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (cfg: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
            ux_mode?: 'popup' | 'redirect';
            auto_select?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            opts: {
              type?: 'standard' | 'icon';
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              width?: number | string;
              logo_alignment?: 'left' | 'center';
            }
          ) => void;
          prompt?: () => void;
          cancel?: () => void;
        };
      };
    };
  }
}

const GSI_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

function loadGsi(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.google?.accounts?.id) return Promise.resolve(true);
  return new Promise(resolve => {
    const existing = document.querySelector(`script[src="${GSI_SCRIPT_SRC}"]`) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load',  () => resolve(true));
      existing.addEventListener('error', () => resolve(false));
      // If it already finished loading before we attached
      if (window.google?.accounts?.id) resolve(true);
      return;
    }
    const s = document.createElement('script');
    s.src   = GSI_SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload  = () => resolve(true);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
}

export interface GoogleLoginButtonProps {
  /** Called with the Google credential (id_token) on successful auth. */
  onCredential: (idToken: string) => void | Promise<void>;
  /** Optional error reporter — used when GSI fails to load or env var is missing. */
  onError?: (msg: string) => void;
  /** Button text variant. */
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  /** External loading state — disables interaction without breaking layout. */
  busy?: boolean;
  /** Optional wrapper class for spacing in different layouts. */
  className?: string;
  /**
   * Role to register/login the user as on the backend. Used by the proxy
   * redirect path so backend knows whether to create a user/hotel/sales
   * record on first Google sign-in.
   */
  role?: 'user' | 'hotel' | 'sales';
}

export default function GoogleLoginButton({
  onCredential, onError, text = 'continue_with', busy, className, role = 'user',
}: GoogleLoginButtonProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onCredentialRef = useRef(onCredential);
  const onErrorRef      = useRef(onError);
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState('');
  // True when the user is on a developer's white-label domain. We render a
  // plain redirect button in that case instead of the GSI popup library —
  // see proxy flow docs in p_AuthController.js (googleProxyRedirect).
  const [useProxyFlow, setUseProxyFlow] = useState(false);

  // Keep latest callbacks reachable from the GSI callback without re-init
  // every render (parents typically pass inline arrow functions).
  useEffect(() => { onCredentialRef.current = onCredential; }, [onCredential]);
  useEffect(() => { onErrorRef.current = onError; },           [onError]);

  useEffect(() => {
    let cancelled = false;
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

    // Detect custom domain via brand cookie set by edge middleware. If
    // `firm_id` is present we're on a developer's branded domain — Google's
    // JS lib would fail origin_mismatch here, so use the redirect proxy.
    if (typeof window !== 'undefined' && getBrand().firm_id) {
      setUseProxyFlow(true);
      setReady(true);
      return;
    }

    if (!clientId) {
      const msg = 'Google Sign-In not configured. Set NEXT_PUBLIC_GOOGLE_CLIENT_ID.';
      setBootError(msg);
      onErrorRef.current?.(msg);
      return;
    }

    (async () => {
      const ok = await loadGsi();
      if (cancelled) return;
      if (!ok || !window.google?.accounts?.id || !containerRef.current) {
        const msg = 'Google Sign-In could not load. Check your network or ad-blocker.';
        setBootError(msg);
        onErrorRef.current?.(msg);
        return;
      }

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          if (response?.credential) onCredentialRef.current(response.credential);
        },
        ux_mode:     'popup',
        auto_select: false,
      });

      // Render the official Google button
      window.google.accounts.id.renderButton(containerRef.current, {
        type:           'standard',
        theme:          'outline',
        size:           'large',
        text,
        shape:          'rectangular',
        width:          320,
        logo_alignment: 'left',
      });

      setReady(true);
    })();

    return () => { cancelled = true; };
    // Only re-render the Google button if `text` changes (different copy).
  }, [text]);

  if (bootError) {
    return (
      <p className={`text-xs text-orange-600 text-center ${className || ''}`}>
        ⚠️ {bootError}
      </p>
    );
  }

  // ── Proxy-redirect button (custom domain) ─────────────────────────────
  //  Plain link to backend, which signs state and forwards to Google.
  //  Avoids GSI library entirely (which would otherwise fail with
  //  origin_mismatch since custom domain isn't in Cloud Console).
  if (useProxyFlow) {
    const returnUrl = typeof window !== 'undefined' ? window.location.href.split('?')[0] : '';
    const proxyHref =
      `${API_ROOT}/api/auth/google-redirect`
      + `?return=${encodeURIComponent(returnUrl)}`
      + `&role=${encodeURIComponent(role)}`;
    return (
      <a
        href={proxyHref}
        className={`flex items-center justify-center gap-3 px-5 py-2.5 w-[320px] max-w-full rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-sm font-semibold text-gray-700 shadow-sm transition ${busy ? 'opacity-50 pointer-events-none' : ''} ${className || ''}`}
        aria-busy={!!busy}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
          alt="Google"
          className="w-5 h-5"
        />
        <span>Continue with Google</span>
      </a>
    );
  }

  return (
    <div className={`flex flex-col items-center gap-2 ${className || ''}`}>
      <div
        ref={containerRef}
        className={`transition-opacity ${busy ? 'opacity-50 pointer-events-none' : ''}`}
        aria-busy={!!busy}
      />
      {!ready && (
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Spinner size="sm" /> Loading Google Sign-In...
        </div>
      )}
    </div>
  );
}
