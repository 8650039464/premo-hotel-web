// ═══════════════════════════════════════════════════════════════════════
//  FIREBASE AUTH — singleton initialiser
//
//  Used by the GoogleLoginButton to run Google Sign-In through Firebase's
//  popup handler instead of Google Identity Services' direct popup. Why?
//
//    • Firebase Auth's "Authorized domains" list is programmatically
//      managed via the Identity Toolkit Admin API. The backend adds each
//      developer's custom domain (e.g. exyrix.com) to this list when the
//      domain is verified — zero manual Cloud Console intervention.
//    • Google's own JS Identity Services library requires every origin
//      to be pre-registered as an "Authorized JavaScript origin" on the
//      OAuth client, which is manual-only and doesn't scale.
//
//  Architecture: single Firebase Web App for the entire Premo platform.
//  All developer-branded domains share the same Firebase project, just
//  appear in its authorized-domains allowlist. End users on exyrix.com
//  see a Google consent screen referencing premo-5d2f0.firebaseapp.com
//  (the auth handler host) — acceptable trade-off for full automation.
//
//  Required env vars (set in Vercel + .env.local):
//    NEXT_PUBLIC_FIREBASE_API_KEY            firebase web config
//    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN        usually <project>.firebaseapp.com
//    NEXT_PUBLIC_FIREBASE_PROJECT_ID         premo-5d2f0 (our master project)
//    NEXT_PUBLIC_FIREBASE_APP_ID             optional but recommended
// ═══════════════════════════════════════════════════════════════════════
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
    RecaptchaVerifier,
    signInWithPhoneNumber,
    ConfirmationResult,
    Auth,
    UserCredential,
} from 'firebase/auth';

let _app: FirebaseApp | null = null;

function getOrInit(): FirebaseApp {
    if (_app) return _app;
    // Reuse if Next.js HMR has already initialised it.
    const existing = getApps();
    if (existing.length) {
        _app = existing[0];
        return _app;
    }
    _app = initializeApp({
        apiKey:        process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain:    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId:     process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        appId:         process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    });
    return _app;
}

export function getFirebaseAuth(): Auth {
    return getAuth(getOrInit());
}

/**
 * Run Google Sign-In via Firebase popup. Returns:
 *   • idToken: the underlying Google id_token (audience = our OAuth web
 *     client_id, because Firebase Console's Google provider is configured
 *     to use that same client). Send this to backend /p/api/auth/google.
 *   • user:   convenience snapshot of the returned Firebase user.
 *
 * Throws if popup is blocked / user closes it — caller should surface the
 * error message to the UI rather than retrying automatically.
 */
export async function signInWithGooglePopup(): Promise<{
    idToken: string;
    user: { email: string; name: string; photo: string };
}> {
    const auth     = getFirebaseAuth();
    const provider = new GoogleAuthProvider();
    // Force the account-chooser so a returning visitor on a shared device
    // doesn't accidentally re-use the previous Google account.
    provider.setCustomParameters({ prompt: 'select_account' });

    const result: UserCredential = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const idToken    = credential?.idToken;
    if (!idToken) {
        throw new Error('Google sign-in succeeded but no id_token returned');
    }
    const u = result.user;
    return {
        idToken,
        user: {
            email: u.email      || '',
            name:  u.displayName || '',
            photo: u.photoURL   || '',
        },
    };
}
// ─── Phone OTP via Firebase ───────────────────────────────────────

let _recaptchaVerifier: RecaptchaVerifier | null = null;

export async function sendPhoneOtp(
    phone: string,
    recaptchaContainerId: string
): Promise<ConfirmationResult> {
    const auth = getFirebaseAuth();

    // Pehle wala instance clear karo
    if (_recaptchaVerifier) {
        try { _recaptchaVerifier.clear(); } catch {}
        _recaptchaVerifier = null;
    }

    _recaptchaVerifier = new RecaptchaVerifier(auth, recaptchaContainerId, {
        size: 'invisible',
    });

    const formattedPhone = phone.startsWith('+') ? phone : '+91' + phone;
    return await signInWithPhoneNumber(auth, formattedPhone, _recaptchaVerifier);
}

export async function verifyPhoneOtp(
    confirmationResult: ConfirmationResult,
    otp: string
): Promise<string> {
    const result = await confirmationResult.confirm(otp);
    return await result.user.getIdToken();
}