"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { authApi, Token, tokenStore, User } from "@/lib/api";

type Ctx = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (full_name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  /** Tải lại thông tin user từ server (sau khi xác thực email...) */
  refresh: () => Promise<void>;
  setUser: (u: User) => void;
};

const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tokenStore.get()) return setLoading(false);
    authApi.me().then(setUser).catch(() => tokenStore.clear()).finally(() => setLoading(false));
  }, []);

  const accept = (t: Token) => { tokenStore.set(t.access_token); setUser(t.user); };

  const login = useCallback(async (email: string, password: string) => accept(await authApi.login({ email, password })), []);
  const register = useCallback(
    async (full_name: string, email: string, password: string) => accept(await authApi.register({ full_name, email, password, accept_terms: true })), []);
  const logout = useCallback(() => { tokenStore.clear(); setUser(null); }, []);
  const refresh = useCallback(async () => { if (tokenStore.get()) setUser(await authApi.me()); }, []);

  return <AuthContext.Provider value={{ user, loading, login, register, logout, refresh, setUser }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth phải nằm trong <AuthProvider>");
  return ctx;
}
