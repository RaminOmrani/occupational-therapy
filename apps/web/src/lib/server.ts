import { cookies } from "next/headers";
import { SERVER_API_URL } from "./api";
import type { SessionUser } from "./auth";

/** کاربر جاری در سمت سرور (برای هیدراسیون سریع پنل) */
export async function getServerUser(): Promise<SessionUser | null> {
  try {
    const token = (await cookies()).get("ot_token")?.value;
    if (!token) return null;
    const res = await fetch(`${SERVER_API_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()).user as SessionUser;
  } catch {
    return null;
  }
}

export async function getClinic() {
  try {
    const res = await fetch(`${SERVER_API_URL}/api/public/clinic`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return (await res.json()) as { settings: Record<string, string>; therapists: { id: string; fullName: string; specialty: string | null; bio: string | null; avatar: string | null; color: string }[]; stats: { patients: number; sessions: number; articles: number } };
  } catch {
    return null;
  }
}
