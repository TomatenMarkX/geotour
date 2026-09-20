export const API_URL: string = import.meta.env.VITE_API_URL ?? "";

/**
 * Der Access Token lebt nur im Speicher — nicht in localStorage.
 * Persistiert wird ausschliesslich das httpOnly-Refresh-Cookie, das das
 * Backend auf Pfad /auth setzt. Nach einem Reload holt refreshSession()
 * daraus einen neuen Access Token.
 */
export type Session = {
  accessToken: string;
  expiresAt: number;
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`HTTP ${status}`);
    this.name = "ApiError";
  }
}

const DEFAULT_EXPIRES_IN_SECONDS = 900;
const CLOCK_SKEW_MS = 30_000;

let session: Session | null = null;
let refreshInFlight: Promise<Session | null> | null = null;
const listeners = new Set<(session: Session | null) => void>();

export function subscribeSession(listener: (session: Session | null) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function publish(next: Session | null): void {
  session = next;
  for (const listener of listeners) listener(next);
}

export function currentSession(): Session | null {
  return session;
}

/** Übernimmt den Token aus dem URL-Fragment des OAuth2-Redirects. */
export function adoptAccessToken(
  accessToken: string,
  expiresInSeconds: number = DEFAULT_EXPIRES_IN_SECONDS,
): Session {
  const next: Session = {
    accessToken,
    expiresAt: Date.now() + expiresInSeconds * 1000,
  };
  publish(next);
  return next;
}

export function clearSession(): void {
  publish(null);
}

/**
 * Tauscht das Refresh-Cookie gegen einen neuen Access Token.
 * Parallele Aufrufer teilen sich denselben Request, damit die
 * Token-Rotation im Backend nicht mehrfach ausgelöst wird.
 */
export function refreshSession(): Promise<Session | null> {
  refreshInFlight ??= (async () => {
    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        publish(null);
        return null;
      }

      const body = (await response.json()) as { accessToken: string; expiresIn: number };
      return adoptAccessToken(body.accessToken, body.expiresIn);
    } catch {
      publish(null);
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

async function validAccessToken(): Promise<string | null> {
  if (session && session.expiresAt - CLOCK_SKEW_MS > Date.now()) {
    return session.accessToken;
  }
  return (await refreshSession())?.accessToken ?? null;
}

type ApiInit = Omit<RequestInit, "body"> & {
  /** Wird als JSON serialisiert und setzt Content-Type. */
  json?: unknown;
  body?: BodyInit | null;
  /** false für öffentliche Endpoints wie POST /tours/verify. */
  auth?: boolean;
};

export async function apiFetch<T>(path: string, init: ApiInit = {}): Promise<T> {
  const { json, auth = true, headers: initHeaders, ...rest } = init;

  const send = (token: string | null): Promise<Response> => {
    const headers = new Headers(initHeaders);
    if (json !== undefined) headers.set("Content-Type", "application/json");
    if (token) headers.set("Authorization", `Bearer ${token}`);

    return fetch(`${API_URL}${path}`, {
      ...rest,
      headers,
      credentials: "include",
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  };

  let response = await send(auth ? await validAccessToken() : null);

  // Token kann serverseitig schon abgelaufen sein — einmal nachfassen.
  if (auth && response.status === 401) {
    const refreshed = await refreshSession();
    if (refreshed) response = await send(refreshed.accessToken);
  }

  if (!response.ok) throw new ApiError(response.status, await readBody(response));
  if (response.status === 204) return undefined as T;
  return (await readBody(response)) as T;
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
