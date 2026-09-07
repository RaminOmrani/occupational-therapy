"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, LogOut, Menu, X, ChevronDown, Globe, KeyRound, CheckCheck } from "lucide-react";
import { ROLE_LABELS, formatJalaliLong, toPersianDigits } from "@toranj/shared";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { navForRole } from "@/lib/nav";
import { Logo, LogoMark } from "./Logo";
import { Avatar, Spinner } from "@/components/ui";
import { cn } from "@/lib/utils";

export function PanelShell({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!loading && !user) router.replace(`/login?next=${encodeURIComponent(path)}`);
  }, [loading, user, path, router]);

  const unreadMsgs = useQuery({ queryKey: ["msg-unread"], queryFn: () => api.get<{ unread: number }>("/messages/unread"), refetchInterval: 30_000, enabled: !!user });
  if (loading || !user) return <Spinner className="min-h-screen" />;
  const items = navForRole(user.role);
  const groups = [...new Set(items.map((i) => i.group ?? ""))];
  const fullName = `${user.firstName} ${user.lastName}`;

  const nav = (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {groups.map((g) => (
        <div key={g}>
          {g && <p className="mb-1.5 px-3 text-[11px] font-semibold text-brand-300/80">{g}</p>}
          <ul className="space-y-0.5">
            {items.filter((i) => (i.group ?? "") === g).map((i) => {
              const active = i.href === "/panel" ? path === "/panel" : path.startsWith(i.href);
              return (
                <li key={i.href}>
                  <Link href={i.href} className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition", active ? "bg-white/15 text-white shadow-inner" : "text-brand-100/90 hover:bg-white/10 hover:text-white")}>
                    <i.icon className="h-[18px] w-[18px] shrink-0" />
                    {i.label}
                    {(i.href === "/panel/messages" || i.href === "/panel/my/messages") && !!unreadMsgs.data?.unread && <span className="num mr-auto rounded-full bg-coral-500 px-1.5 text-[10px] font-bold text-white">{toPersianDigits(unreadMsgs.data.unread)}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-gradient-to-b from-brand-800 to-brand-950 text-white lg:flex">
        <div className="px-5 py-5"><Logo light /></div>
        {nav}
        <div className="border-t border-white/10 p-3">
          <Link href="/" className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-brand-200 hover:bg-white/10"><Globe className="h-4 w-4" />مشاهده سایت</Link>
        </div>
      </aside>

      {/* Sidebar (mobile) */}
      {open && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="absolute inset-0 bg-brand-950/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="relative flex h-full w-72 flex-col bg-gradient-to-b from-brand-800 to-brand-950 text-white animate-fade-up">
            <div className="flex items-center justify-between px-5 py-4"><Logo light /><button onClick={() => setOpen(false)}><X className="h-5 w-5" /></button></div>
            {nav}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-sand-200 bg-sand-50/80 px-4 py-3 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3">
            <button className="rounded-xl p-2 hover:bg-sand-200 lg:hidden" onClick={() => setOpen(true)} aria-label="منو"><Menu className="h-5 w-5" /></button>
            <span className="lg:hidden"><LogoMark className="h-8 w-8" /></span>
            <p className="hidden text-sm text-slate-500 md:block">{formatJalaliLong(new Date(), true)}</p>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <UserMenu name={fullName} role={user.role} onLogout={logout} avatar={user.avatar} />
          </div>
        </header>
        <main className="flex-1 px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

function NotificationBell() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data } = useQuery({ queryKey: ["notifications"], queryFn: () => api.get<{ items: any[]; unread: number }>("/notifications"), refetchInterval: 60_000 });
  const readAll = async () => {
    await api.post("/notifications/read-all");
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="relative rounded-xl p-2 text-slate-600 hover:bg-sand-200" aria-label="اعلان‌ها">
        <Bell className="h-5 w-5" />
        {!!data?.unread && <span className="num absolute -right-0.5 -top-0.5 grid h-4.5 min-w-[18px] place-items-center rounded-full bg-coral-500 px-1 text-[10px] font-bold text-white">{toPersianDigits(data.unread)}</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-40 mt-2 w-80 rounded-2xl border border-sand-200 bg-white shadow-card animate-fade-up">
            <div className="flex items-center justify-between border-b border-sand-200 px-4 py-2.5">
              <p className="text-sm font-bold">اعلان‌ها</p>
              <button onClick={readAll} className="flex items-center gap-1 text-xs text-brand-600 hover:underline"><CheckCheck className="h-3.5 w-3.5" />خواندن همه</button>
            </div>
            <ul className="max-h-80 overflow-y-auto">
              {data?.items.length ? data.items.map((n) => (
                <li key={n.id}>
                  <Link href={n.link ?? "#"} onClick={() => setOpen(false)} className={cn("block border-b border-sand-100 px-4 py-3 text-sm hover:bg-brand-50", !n.readAt && "bg-brand-50/60")}>
                    <p className="font-medium text-slate-800">{n.title}</p>
                    {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{n.body}</p>}
                    <p className="mt-1 text-[10px] text-slate-400">{formatJalaliLong(n.createdAt)}</p>
                  </Link>
                </li>
              )) : <li className="px-4 py-8 text-center text-sm text-slate-400">اعلانی ندارید</li>}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

function UserMenu({ name, role, onLogout, avatar }: { name: string; role: string; onLogout: () => void; avatar?: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-xl p-1.5 pr-1.5 hover:bg-sand-200">
        <Avatar name={name} src={avatar} size="sm" />
        <span className="hidden text-right sm:block">
          <span className="block text-sm font-semibold leading-4">{name}</span>
          <span className="block text-[11px] text-slate-400">{ROLE_LABELS[role as keyof typeof ROLE_LABELS]}</span>
        </span>
        <ChevronDown className="hidden h-4 w-4 text-slate-400 sm:block" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-40 mt-2 w-52 rounded-2xl border border-sand-200 bg-white p-1.5 shadow-card animate-fade-up">
            <Link href="/panel/account" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-sand-100"><KeyRound className="h-4 w-4 text-slate-400" />حساب کاربری و رمز</Link>
            <Link href="/" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-sand-100"><Globe className="h-4 w-4 text-slate-400" />سایت کلینیک</Link>
            <button onClick={onLogout} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-coral-600 hover:bg-coral-50"><LogOut className="h-4 w-4" />خروج</button>
          </div>
        </>
      )}
    </div>
  );
}
