"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

/** تنظیمات عمومی (کلینیک، نوبت‌دهی) برای استفاده در پنل */
export function usePublicSettings() {
  const q = useQuery({ queryKey: ["public-settings"], queryFn: () => api.get<{ settings: Record<string, string> }>("/settings/public"), staleTime: 5 * 60_000 });
  const s = q.data?.settings ?? {};
  return {
    ...q,
    settings: s,
    num: (k: string, d: number) => { const v = Number(s[k]); return isNaN(v) || !s[k] ? d : v; },
    str: (k: string, d = "") => s[k] ?? d,
  };
}
