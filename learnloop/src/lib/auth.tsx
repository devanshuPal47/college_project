import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, setSessionLostHandler, tokenStore, type AuthResponse, type User } from "./api";

type Status = "loading" | "anon" | "authed";

type AuthApi = {
  status: Status;
  user: User | null;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  /** Creates the account; `initialProgress` is saved to the database before the app opens. */
  register: (p: { email: string; password: string; displayName: string }, initialProgress?: unknown) => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthApi>(null as unknown as AuthApi);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<User | null>(null);

  const drop = useCallback(() => {
    tokenStore.set(null);
    setUser(null);
    setStatus("anon");
  }, []);

  useEffect(() => {
    setSessionLostHandler(drop);
    if (!tokenStore.get()) {
      setStatus("anon");
      return;
    }
    api
      .get<User>("/auth/me")
      .then((u) => {
        setUser(u);
        setStatus("authed");
      })
      .catch(() => drop());
  }, [drop]);

  const adopt = (r: AuthResponse) => {
    tokenStore.set(r.tokens);
    setUser(r.user);
    setStatus("authed");
  };

  const value = useMemo<AuthApi>(
    () => ({
      status,
      user,
      isAdmin: user?.role === "admin",
      login: async (email, password) => adopt(await api.post<AuthResponse>("/auth/login", { email, password }, { auth: false })),
      register: async ({ email, password, displayName }, initialProgress) => {
        const r = await api.post<AuthResponse>("/auth/register", { email, password, display_name: displayName }, { auth: false });
        tokenStore.set(r.tokens); // needed so the progress save below is authenticated
        if (initialProgress) await api.put("/progress", { state: initialProgress });
        adopt(r);
      },
      logout: async () => {
        const t = tokenStore.get();
        if (t) await api.post("/auth/logout", { refresh_token: t.refresh_token }, { auth: false }).catch(() => {});
        drop();
      },
    }),
    [status, user, drop],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
