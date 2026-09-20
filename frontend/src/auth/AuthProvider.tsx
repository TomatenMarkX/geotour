import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  API_URL,
  apiFetch,
  clearSession,
  currentSession,
  refreshSession,
  subscribeSession,
  type Session,
} from "@/lib/api";
import { decodeJwt } from "@/lib/jwt";

export type AuthUser = {
  id: string;
  email?: string;
};

export type AuthStatus = "loading" | "authenticated" | "anonymous";

type AuthContextValue = {
  user: AuthUser | null;
  status: AuthStatus;
  loginWithGoogle: () => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function userOf(session: Session | null): AuthUser | null {
  if (!session) return null;
  const claims = decodeJwt(session.accessToken);
  return claims?.sub ? { id: claims.sub, email: claims.email } : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => currentSession());
  const [status, setStatus] = useState<AuthStatus>(() =>
    currentSession() ? "authenticated" : "loading",
  );

  // Einzige Quelle der Wahrheit ist die Session im api-Modul.
  useEffect(() => {
    const unsubscribe = subscribeSession((next) => {
      setSession(next);
      setStatus(next ? "authenticated" : "anonymous");
    });

    // AuthCallback läuft als Kind vor diesem Effect und hat den Token aus
    // dem Fragment womöglich schon übernommen — dieses publish() lief ins
    // Leere, weil noch kein Listener da war. Deshalb einmal nachziehen.
    const adopted = currentSession();
    if (adopted) {
      setSession(adopted);
      setStatus("authenticated");
    }

    return unsubscribe;
  }, []);

  // Beim ersten Laden aus dem Refresh-Cookie wiederherstellen.
  useEffect(() => {
    if (currentSession()) return;
    let cancelled = false;
    void refreshSession().then((restored) => {
      if (!cancelled && !restored) setStatus("anonymous");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Silent Refresh eine Minute vor Ablauf.
  useEffect(() => {
    if (!session) return;
    const delay = Math.max(session.expiresAt - Date.now() - 60_000, 5_000);
    const timer = setTimeout(() => void refreshSession(), delay);
    return () => clearTimeout(timer);
  }, [session]);

  const loginWithGoogle = useCallback(() => {
    // Vollständiger Seitenwechsel: Spring Security übernimmt den Flow und
    // leitet am Ende auf ${app.frontend.url}/auth/callback#token=... zurück.
    window.location.href = `${API_URL}/oauth2/authorization/google`;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch<void>("/auth/logout", { method: "POST", auth: false });
    } catch {
      // Endpoint fehlt im Backend noch — Session lokal trotzdem verwerfen.
    }
    clearSession();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user: userOf(session), status, loginWithGoogle, logout }),
    [session, status, loginWithGoogle, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth muss innerhalb von <AuthProvider> verwendet werden");
  return context;
}
