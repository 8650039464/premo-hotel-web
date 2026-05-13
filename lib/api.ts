// lib/api.ts — Central API config
//
// ─────────────────────────────────────────────────────────────
//  API_BASE  → bare server (no firm prefix)
//  API_ROOT  → server + firm prefix. Saare Premo endpoints
//              /p/api/... pe mount hain (backend me firm='p').
//  Image srcs & legacy calls are rewritten to use API_ROOT.
// ─────────────────────────────────────────────────────────────

export const API_BASE  = 'https://hotel-api-master.onrender.com';
export const API_ROOT  = `${API_BASE}/p`;                    // firm-scoped root
export const API_TOKEN = 'premo_hotel_f0eb62d75c7516f4';
export const WHATSAPP_NUMBER  = '918650039464'; // ← apna number daalo
export const WHATSAPP_MESSAGE = 'Hi, I need help with my booking on PREMO';
export const APP_NAME = 'PREMO';

export const getHeaders = (token?: string) => ({
  'Content-Type': 'application/json',
  'x-api-token': API_TOKEN,
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const { token, ...rest } = options;
  // path usually starts with /api/... — prepend firm root
  const url = path.startsWith('/p/') ? `${API_BASE}${path}` : `${API_ROOT}${path}`;
  const res = await fetch(url, {
    ...rest,
    headers: { ...getHeaders(token), ...(rest.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || data?.message || `API Error (${res.status})`);
  return data as T;
}

// Auth storage
export const TOKEN_KEY = 'premo_token';
export const ROLE_KEY  = 'premo_role';
export const USER_KEY  = 'premo_user';

export function saveAuth(token: string, role: string, user: Record<string, string>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(ROLE_KEY, role);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getAuth() {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem(TOKEN_KEY);
  const role  = localStorage.getItem(ROLE_KEY);
  const user  = localStorage.getItem(USER_KEY);
  if (!token || !role) return null;
  return { token, role, user: user ? JSON.parse(user) : {} };
}

export function clearAuth() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(USER_KEY);
}

// ─── Google login (user / hotel / sales) ────────────────────────
//  POST /p/api/auth/google  with { id_token, role }
//  Backend default role is 'user' — pass role explicitly for hotel/sales
//  so the right Auth doc (role-scoped) is matched / created.
//  Super admin intentionally does NOT support Google login.
export async function googleLogin(idToken: string, role: 'user' | 'hotel' | 'sales' = 'user') {
  const res = await fetch(`${API_ROOT}/api/auth/google`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-token': API_TOKEN },
    body:    JSON.stringify({ id_token: idToken, role }),
  });
  return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
}

export function formatDT(iso?: string) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-IN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  } catch { return iso.substring(0, 10); }
}

export function formatDate(iso?: string) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  } catch { return iso; }
}

// Wallet APIs
export async function getWalletBalance(token: string) {
  const res = await fetch(`${API_ROOT}/api/wallet/balance`, { headers: getHeaders(token) });
  return res.ok ? res.json() : { wallet_amount: 0 };
}

export async function createTopupOrder(token: string, amount: number) {
  const res = await fetch(`${API_ROOT}/api/wallet/topup/create-order`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({ amount }),
  });
  return { ok: res.ok, data: await res.json() };
}

export async function verifyTopup(token: string, payload: object) {
  const res = await fetch(`${API_ROOT}/api/wallet/topup/verify`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify(payload),
  });
  return { ok: res.ok, data: await res.json() };
}

// Cancellation APIs
export async function getCancellationPolicy(token: string, bookingId: string) {
  const res = await fetch(`${API_ROOT}/api/payment/cancellation-policy/${bookingId}`, {
    headers: getHeaders(token),
  });
  return { ok: res.ok, data: await res.json() };
}

export async function cancelBooking(token: string, bookingId: string) {
  const res = await fetch(`${API_ROOT}/api/payment/cancel/${bookingId}`, {
    method: 'POST',
    headers: getHeaders(token),
  });
  return { ok: res.ok, data: await res.json() };
}

// Payment APIs
export async function createPaymentOrder(token: string, payload: object) {
  const res = await fetch(`${API_ROOT}/api/payment/create-order`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify(payload),
  });
  return { ok: res.ok, status: res.status, data: await res.json() };
}

export async function verifyPayment(token: string, payload: object) {
  const res = await fetch(`${API_ROOT}/api/payment/verify`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify(payload),
  });
  return { ok: res.ok, data: await res.json() };
}

// Razorpay loader
export function loadRazorpay(): Promise<boolean> {
  return new Promise(resolve => {
    if ((window as any).Razorpay) { resolve(true); return; }
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload  = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

// WhatsApp
export function openWhatsApp() {
  const msg = encodeURIComponent(WHATSAPP_MESSAGE);
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, '_blank');
}

// ═══════════════════════════════════════════════════════════════
//  DEVELOPER PORTAL APIs (/p/api/developers/*)
// ═══════════════════════════════════════════════════════════════
export const DEV_TOKEN_KEY = 'premo_dev_token';
export const DEV_USER_KEY  = 'premo_dev_user';

export function saveDevAuth(token: string, user: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DEV_TOKEN_KEY, token);
  localStorage.setItem(DEV_USER_KEY, JSON.stringify(user));
}

export function getDevAuth() {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem(DEV_TOKEN_KEY);
  const user  = localStorage.getItem(DEV_USER_KEY);
  if (!token) return null;
  return { token, user: user ? JSON.parse(user) : {} };
}

export function clearDevAuth() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(DEV_TOKEN_KEY);
  localStorage.removeItem(DEV_USER_KEY);
}

async function devFetch(path: string, token: string, init: RequestInit = {}) {
  const res = await fetch(`${API_ROOT}/api/developers${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-api-token':  API_TOKEN,
      Authorization:  `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export async function devLogin(email: string, password: string) {
  const res = await fetch(`${API_ROOT}/api/developers/login`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-token': API_TOKEN },
    body:    JSON.stringify({ email, password }),
  });
  return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
}

export async function devRegister(payload: Record<string, unknown>) {
  const res = await fetch(`${API_ROOT}/api/developers/register`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-token': API_TOKEN },
    body:    JSON.stringify(payload),
  });
  return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
}

// ─── Developer Google login ─────────────────────────────────────
//  POST /p/api/developers/google  with { id_token }
//  Returns { token, developer } on success. New accounts get
//  status=pending so super admin must approve before login works.
export async function devGoogleLogin(idToken: string) {
  const res = await fetch(`${API_ROOT}/api/developers/google`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-token': API_TOKEN },
    body:    JSON.stringify({ id_token: idToken }),
  });
  return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
}

export const devApi = {
  me:           (t: string)               => devFetch('/me', t),
  update:       (t: string, body: object) => devFetch('/me/update', t, { method: 'PUT', body: JSON.stringify(body) }),
  regenKey:     (t: string)               => devFetch('/me/regenerate-key', t, { method: 'POST' }),
  earnings:     (t: string, page = 1)     => devFetch(`/me/earnings?page=${page}&limit=20`, t),
  requestPayout:(t: string, amount: number) => devFetch('/me/request-payout', t, { method: 'POST', body: JSON.stringify({ amount }) }),

  // White-label builds
  requestBuild: (t: string, body: { platform?: 'android'; channel?: 'release' | 'profile' | 'debug' } = {}) =>
    devFetch('/build-request', t, { method: 'POST', body: JSON.stringify(body) }),
  listBuildJobs: (t: string, limit = 25) =>
    devFetch(`/build-jobs?limit=${limit}`, t),
  getBuildJob: (t: string, id: string) =>
    devFetch(`/build-jobs/${id}`, t),
  cancelBuildJob: (t: string, id: string) =>
    devFetch(`/build-jobs/${id}`, t, { method: 'DELETE' }),

  // Custom domain (white-label website)
  domainStatus: (t: string) =>
    devFetch('/domain/status', t),
  domainAdd: (t: string, domain: string) =>
    devFetch('/domain/add', t, { method: 'POST', body: JSON.stringify({ domain }) }),
  domainVerify: (t: string) =>
    devFetch('/domain/verify', t, { method: 'POST' }),
  domainRemove: (t: string) =>
    devFetch('/domain', t, { method: 'DELETE' }),

  // Play Console SHA-1 (production keystore registration)
  playSha1Get: (t: string) =>
    devFetch('/me/play-sha1', t),
  playSha1Set: (t: string, sha1: string) =>
    devFetch('/me/play-sha1', t, { method: 'POST', body: JSON.stringify({ sha1 }) }),
};

// ═══════════════════════════════════════════════════════════════
//  SALES AGENT APIs (/p/api/sales/*)
//  Sales agents login via /p/api/auth/login with role='sales'.
//  After login, the same TOKEN_KEY/ROLE_KEY/USER_KEY (saveAuth) is used —
//  helpers below read it via getAuth() so callers don't pass tokens.
// ═══════════════════════════════════════════════════════════════
async function salesFetch(
  path: string,
  init: RequestInit & { query?: Record<string, string | number | undefined> } = {}
) {
  const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
  const { query, ...rest } = init;

  let url = `${API_ROOT}/api/sales${path}`;
  if (query) {
    const qs = Object.entries(query)
      .filter(([, v]) => v !== undefined && v !== '' && v !== null)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
    if (qs) url += `?${qs}`;
  }

  const res = await fetch(url, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      'x-api-token':  API_TOKEN,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(rest.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export const salesApi = {
  profile:        () => salesFetch('/profile'),
  myHotels:       () => salesFetch('/my-hotels'),
  earnings:       (status?: string) => salesFetch('/earnings', { query: { status } }),
  registerHotel:  (body: Record<string, unknown>) =>
    salesFetch('/register-hotel', { method: 'POST', body: JSON.stringify(body) }),
  requestPayout:  (amount: number) =>
    salesFetch('/request-payout', { method: 'POST', body: JSON.stringify({ amount }) }),
};

// Public: list of active cities (used by sales register-hotel form for city dropdown)
export async function listActiveCities() {
  const res = await fetch(`${API_ROOT}/api/cities`, {
    headers: { 'x-api-token': API_TOKEN },
  });
  if (!res.ok) return [];
  return res.json().catch(() => []);
}

// ═══════════════════════════════════════════════════════════════
//  SUPREME (SUPER) ADMIN AUTH
//  Supreme admin ka endpoint /p/supreme/* hai, /p/api/* nahi.
//  Credentials .env me define hote hain (P_SUPREME_EMAIL/PASSWORD).
//  JWT server-side role: 'supreme' ke saath sign hota hai, par
//  client-side hum role='admin' save karte hain taaki existing
//  super-admin UI guards (allowedRoles=['admin']) work kare.
// ═══════════════════════════════════════════════════════════════
export async function supremeLogin(email: string, password: string) {
  const res = await fetch(`${API_BASE}/p/supreme/login`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-token': API_TOKEN },
    body:    JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

// ─────────────────────────────────────────────────────────────
//  supremeFetch — central helper for all /p/supreme/* calls
//  Reads token from same TOKEN_KEY that saveAuth() writes to.
// ─────────────────────────────────────────────────────────────
async function supremeFetch(
  path: string,
  init: RequestInit & { query?: Record<string, string | number | boolean | undefined> } = {}
) {
  const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
  const { query, ...rest } = init;

  let url = `${API_BASE}/p/supreme${path}`;
  if (query) {
    const qs = Object.entries(query)
      .filter(([, v]) => v !== undefined && v !== '' && v !== null)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
    if (qs) url += `?${qs}`;
  }

  const res = await fetch(url, {
    ...rest,
    headers: {
      'Content-Type':  'application/json',
      'x-api-token':   API_TOKEN,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(rest.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

// ═══════════════════════════════════════════════════════════════
//  supremeApi — typed wrappers for super-admin panel
// ═══════════════════════════════════════════════════════════════
export const supremeApi = {
  // Stats
  stats: () => supremeFetch('/stats'),

  // Users
  listUsers: (q: { role?: string; status?: string; search?: string } = {}) =>
    supremeFetch('/users', { query: q }),
  setUserStatus: (id: string, status: 'active' | 'pending' | 'rejected') =>
    supremeFetch(`/users/status/${id}`, { method: 'PUT', body: JSON.stringify({ status }) }),
  deleteUser: (id: string) =>
    supremeFetch(`/users/delete/${id}`, { method: 'DELETE' }),

  // Hotels
  listHotels: (q: { status?: string | boolean; search?: string } = {}) =>
    supremeFetch('/hotels', { query: q as Record<string, string | undefined> }),
  toggleHotelStatus: (id: string, status: boolean) =>
    supremeFetch(`/hotels/toggle/${id}`, { method: 'PUT', body: JSON.stringify({ status }) }),
  deleteHotel: (id: string) =>
    supremeFetch(`/hotels/delete/${id}`, { method: 'DELETE' }),

  // Bookings
  listBookings: (q: { status?: string; hotel_id?: string; booking_type?: string } = {}) =>
    supremeFetch('/bookings', { query: q }),
  updateBooking: (id: string, body: Record<string, unknown>) =>
    supremeFetch(`/bookings/update/${id}`, { method: 'PUT', body: JSON.stringify(body) }),

  // Complaints
  listComplaints: (q: { status?: string } = {}) =>
    supremeFetch('/complaints', { query: q }),
  setComplaintStatus: (id: string, status: string) =>
    supremeFetch(`/complaints/status/${id}`, { method: 'PUT', body: JSON.stringify({ status }) }),

  // Cities
  listCities: (q: { search?: string } = {}) =>
    supremeFetch('/cities', { query: q }),
  addCity: (body: { name: string; state?: string }) =>
    supremeFetch('/cities/add', { method: 'POST', body: JSON.stringify(body) }),
  updateCity: (id: string, body: Record<string, unknown>) =>
    supremeFetch(`/cities/update/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteCity: (id: string) =>
    supremeFetch(`/cities/delete/${id}`, { method: 'DELETE' }),
  toggleCity: (id: string) =>
    supremeFetch(`/cities/toggle/${id}`, { method: 'PATCH' }),

  // Commission (global)
  getCommission: () => supremeFetch('/commission'),
  setCommission: (body: Record<string, unknown>) =>
    supremeFetch('/commission/set', { method: 'POST', body: JSON.stringify(body) }),

  // City commission overrides
  listCityCommissions: () => supremeFetch('/city-commissions'),
  getCityCommission: (cityId: string) =>
    supremeFetch(`/city-commissions/${cityId}`),
  upsertCityCommission: (cityId: string, body: Record<string, unknown>) =>
    supremeFetch(`/city-commissions/${cityId}`, { method: 'PUT', body: JSON.stringify(body) }),
  toggleCityCommission: (cityId: string) =>
    supremeFetch(`/city-commissions/${cityId}/toggle`, { method: 'PATCH' }),
  deleteCityCommission: (cityId: string) =>
    supremeFetch(`/city-commissions/${cityId}`, { method: 'DELETE' }),

  // Sales agents
  listSalesAgents: (q: { status?: string; search?: string; city?: string } = {}) =>
    supremeFetch('/sales/agents', { query: q }),
  getSalesPolicy: () => supremeFetch('/sales/policy'),
  setSalesPolicy: (body: Record<string, unknown>) =>
    supremeFetch('/sales/policy/set', { method: 'POST', body: JSON.stringify(body) }),
  assignCitiesToSales: (salesId: string, cityIds: string[]) =>
    supremeFetch(`/sales/${salesId}/assign-cities`, {
      method: 'PUT',
      body:   JSON.stringify({ city_ids: cityIds }),
    }),
  toggleSalesBlock: (salesId: string) =>
    supremeFetch(`/sales/${salesId}/block-toggle`, { method: 'PATCH' }),

  // Developers
  listDevelopers: (q: { status?: string; search?: string } = {}) =>
    supremeFetch('/developers', { query: q }),
  setDeveloperStatus: (id: string, status: 'pending' | 'active' | 'suspended') =>
    supremeFetch(`/developers/status/${id}`, {
      method: 'PUT',
      body:   JSON.stringify({ status }),
    }),
};
