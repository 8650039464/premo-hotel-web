'use client';
// ═══════════════════════════════════════════════════════════════════════
//  GoogleLoginButton — Firebase Auth-based Google Sign-In
//
//  WHY FIREBASE AUTH (instead of Google Identity Services library):
//    Custom developer domains (e.g. exyrix.com) need Google Sign-In to
//    work without per-domain manual setup in Google Cloud Console. GIS's
//    JS library checks the page origin against the OAuth client's
//    Authorized JavaScript origins list — manual-only, doesn't scale.
//
//    Firebase Auth uses its own "authorized domains" list which IS
//    programmatically updatable (Identity Toolkit Admin API). Backend
//    auto-adds each developer's domain when they verify it. So a new
//    developer's exyrix.com works the moment their domain goes live —
//    zero ops involvement.
//
//  Behaviour: clicking opens a Google popup via Firebase. On success we
//  extract the underlying Google id_token and hand it to the parent
//  handler — same shape as the old GSI flow, so LoginForm etc. need no
//  other changes. Email/password and other auth methods are untouched.
//
//  Required env (Vercel + .env.local):
//    NEXT_PUBLIC_FIREBASE_API_KEY
//    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
//    NEXT_PUBLIC_FIREBASE_PROJECT_ID
//    NEXT_PUBLIC_FIREBASE_APP_ID  (optional)
// ═══════════════════════════════════════════════════════════════════════
import { useState } from 'react';
import { Spinner } from './ui';
import { signInWithGooglePopup } from '@/lib/firebase';

export interface GoogleLoginButtonProps {
  /** Called with the underlying Google credential (id_token) on success. */
  onCredential: (idToken: string) => void | Promise<void>;
  /** Optional error reporter — used when the popup is closed or blocked. */
  onError?: (msg: string) => void;
  /** Button text variant. */
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  /** External loading state — disables interaction without breaking layout. */
  busy?: boolean;
  /** Optional wrapper class for spacing in different layouts. */
  className?: string;
  /** Reserved for future per-role provisioning hints — currently unused but
   *  kept in the prop shape so call sites don't need to change later. */
  role?: 'user' | 'hotel' | 'sales';
}

const LABELS: Record<NonNullable<GoogleLoginButtonProps['text']>, string> = {
  signin_with:   'Sign in with Google',
  signup_with:   'Sign up with Google',
  continue_with: 'Continue with Google',
  signin:        'Google',
};

export default function GoogleLoginButton({
  onCredential, onError, text = 'continue_with', busy, className,
}: GoogleLoginButtonProps) {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (busy || pending) return;
    setPending(true);
    try {
      const { idToken } = await signInWithGooglePopup();
      await onCredential(idToken);
    } catch (e: unknown) {
      // User closed the popup / blocked it / network error
      const code = (e as { code?: string })?.code || '';
      let msg: string;
      if (code === 'auth/popup-closed-by-user') {
        msg = 'Google sign-in cancel ho gaya.';
      } else if (code === 'auth/popup-blocked') {
        msg = 'Browser ne popup block kar diya. Site ko allow karke retry karo.';
      } else if (code === 'auth/cancelled-popup-request') {
        // Multiple rapid clicks — ignore silently
        msg = '';
      } else {
        msg = (e as Error)?.message || 'Google sign-in failed.';
      }
      if (msg) onError?.(msg);
    } finally {
      setPending(false);
    }
  }

  const disabled = !!busy || pending;
  const label    = LABELS[text];

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      aria-busy={disabled}
      className={`flex items-center justify-center gap-3 px-5 py-2.5 w-[320px] max-w-full rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-sm font-semibold text-gray-700 shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed ${className || ''}`}
    >
      {pending ? (
        <Spinner size="sm" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
          alt=""
          aria-hidden="true"
          className="w-5 h-5"
        />
      )}
      <span>{pending ? 'Signing in...' : label}</span>
    </button>
  );
}
