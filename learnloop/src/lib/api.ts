/** Typed fetch client for the LearnLoop API: bearer auth, single-flight token refresh, one error shape. */

// In development the Vite proxy forwards /api to the local API, so the base is empty. In production the static site
// and the API live on different Render URLs, so the build sets VITE_API_URL (e.g. https://learnloop-api.onrender.com).
const API_ORIGIN = ((import.meta.env.VITE_API_URL as string | undefined) ?? "").trim().replace(/\/+$/, "");
const BASE = `${API_ORIGIN}/api/v1`;
// Free hosting puts the API to sleep when idle and a cold start can take ~a minute, so don't give up early.
const REQUEST_TIMEOUT_MS = 60_000;
const SLOW_AFTER_MS = 4_000;

// --- "the server is waking up" signal, shown as a banner by <ServerWaking /> --------------------------------
let slowCount = 0;
const slowListeners = new Set<() => void>();
export const subscribeSlow = (fn: () => void) => {
  slowListeners.add(fn);
  return () => void slowListeners.delete(fn);
};
export const isServerSlow = () => slowCount > 0;
const notifySlow = () => slowListeners.forEach((fn) => fn());

/** Fire-and-forget request that wakes a sleeping free-tier API while the visitor is still reading the page. */
export const warmUp = () => void fetch(`${BASE}/health`, { cache: "no-store" }).catch(() => {});
const TOKEN_KEY = "learnloop.session";

export type Tokens = { access_token: string; refresh_token: string; expires_in: number };

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
    public requestId?: string,
  ) {
    super(message);
  }
}

// --- token storage (session tokens only; progress lives in the database) ---------------------------
export const tokenStore = {
  get(): Tokens | null {
    try {
      const raw = localStorage.getItem(TOKEN_KEY);
      return raw ? (JSON.parse(raw) as Tokens) : null;
    } catch {
      return null;
    }
  },
  set(t: Tokens | null) {
    try {
      if (t) localStorage.setItem(TOKEN_KEY, JSON.stringify(t));
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage blocked: the session will last until reload */
    }
  },
};

let onSessionLost: () => void = () => {};
export const setSessionLostHandler = (fn: () => void) => (onSessionLost = fn);

// --- core request ---------------------------------------------------------------------------------
type Opts = { method?: string; body?: unknown; auth?: boolean; keepalive?: boolean };

async function parseError(res: Response): Promise<ApiError> {
  const data = await res.json().catch(() => null);
  const e = data?.error;
  return new ApiError(e?.message ?? "Something went wrong. Please try again.", e?.code ?? "unknown", res.status, e?.request_id);
}

let refreshing: Promise<boolean> | null = null;

/** Exchange the refresh token once, even if several requests hit 401 at the same time. */
function refreshTokens(): Promise<boolean> {
  refreshing ??= (async () => {
    const t = tokenStore.get();
    if (!t) return false;
    try {
      const res = await fetch(`${BASE}/auth/refresh`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: t.refresh_token }) });
      if (!res.ok) return false;
      tokenStore.set(await res.json());
      return true;
    } catch {
      return false;
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}

export async function request<T>(path: string, opts: Opts = {}): Promise<T> {
  const slowTimer = setTimeout(() => { slowCount++; notifySlow(); flagged = true; }, SLOW_AFTER_MS);
  let flagged = false;
  try {
    return await doRequest<T>(path, opts);
  } finally {
    clearTimeout(slowTimer);
    if (flagged) { slowCount--; notifySlow(); }
  }
}

async function doRequest<T>(path: string, opts: Opts): Promise<T> {
  const { method = "GET", body, auth = true, keepalive } = opts;
  const send = () => {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const t = tokenStore.get();
    if (auth && t) headers.Authorization = `Bearer ${t.access_token}`;
    // never leave the UI spinning: give up after REQUEST_TIMEOUT_MS
    return fetch(`${BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), keepalive, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  };

  let res: Response;
  try {
    res = await send();
  } catch (e) {
    if (e instanceof DOMException && e.name === "TimeoutError") {
      throw new ApiError("The server is taking too long to respond. Please try again in a moment.", "timeout", 0);
    }
    throw new ApiError("Can't reach the server. Check your connection (is the API running?).", "network_error", 0);
  }

  if (res.status === 401 && auth && tokenStore.get()) {
    if (await refreshTokens()) res = await send();
    if (res.status === 401) {
      tokenStore.set(null);
      onSessionLost();
    }
  }
  if (res.status === 204) return undefined as T;
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as T;
}

export const api = {
  get: <T>(p: string) => request<T>(p),
  post: <T>(p: string, body?: unknown, opts?: Opts) => request<T>(p, { method: "POST", body: body ?? {}, ...opts }),
  put: <T>(p: string, body: unknown, opts?: Opts) => request<T>(p, { method: "PUT", body, ...opts }),
  patch: <T>(p: string, body: unknown) => request<T>(p, { method: "PATCH", body }),
};

// --- typed endpoints ------------------------------------------------------------------------------
export type Role = "user" | "admin";
export type User = { id: string; email: string; display_name: string; role: Role; is_active: boolean; created_at: string; last_login_at: string | null };
export type AuthResponse = { user: User; tokens: Tokens };
export type AdminUser = User & { xp: number; streak: number; projects_completed: number };
export type AdminStats = { total_users: number; active_users: number; admins: number; new_last_7_days: number; total_projects_completed: number; ai_calls_today: number };
