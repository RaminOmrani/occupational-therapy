"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { api } from "./api";

export interface SessionUser {
  id: string;
  phone: string;
  role: "ADMIN" | "THERAPIST" | "SECRETARY" | "PATIENT";
  firstName: string;
  lastName: string;
  avatar?: string | null;
  therapistId: string | null;
  patientId: string | null;
  fileNumber?: string | null;
}

interface AuthCtx {
  user: SessionUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  setUser: (u: SessionUser | null) => void;
}

const Ctx = createContext<AuthCtx>({ user: null, loading: true, refresh: async () => {}, logout: async () => {}, setUser: () => {} });

export function useAuth() {
  return useContext(Ctx);
}

export function Providers({ children, initialUser }: { children: ReactNode; initialUser?: SessionUser | null }) {
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: false } } }));
  const [user, setUser] = useState<SessionUser | null>(initialUser ?? null);
  const [loading, setLoading] = useState(initialUser === undefined);

  const refresh = useCallback(async () => {
    try {
      const r = await api.get<{ user: SessionUser }>("/auth/me");
      setUser(r.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialUser === undefined) refresh();
  }, [initialUser, refresh]);

  const logout = useCallback(async () => {
    await api.post("/auth/logout");
    setUser(null);
    window.location.href = "/login";
  }, []);

  const value = useMemo(() => ({ user, loading, refresh, logout, setUser }), [user, loading, refresh, logout]);
  return (
    <QueryClientProvider client={qc}>
      <Ctx.Provider value={value}>{children}</Ctx.Provider>
      <Toaster position="top-center" richColors dir="rtl" toastOptions={{ style: { fontFamily: "Vazirmatn" } }} />
    </QueryClientProvider>
  );
}
