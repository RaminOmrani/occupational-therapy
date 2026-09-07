"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { KeyRound, Smartphone, ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth, type SessionUser } from "@/lib/auth";
import { Button, Field, Input, Tabs } from "@/components/ui";
import { LogoMark } from "@/components/layout/Logo";
import { usePublicSettings } from "@/lib/settings";

function LoginInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const { setUser } = useAuth();
  const [mode, setMode] = useState<"otp" | "password">("otp");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const settings = usePublicSettings();

  const finish = (user: SessionUser) => {
    setUser(user);
    toast.success(`خوش آمدید ${user.firstName} عزیز`);
    router.replace(sp.get("next") || "/panel");
    router.refresh();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "password") {
        const r = await api.post<{ user: SessionUser }>("/auth/login", { phone, password });
        finish(r.user);
      } else if (!otpSent) {
        await api.post("/auth/otp/request", { phone });
        setOtpSent(true);
        toast.success("کد ورود پیامک شد");
      } else {
        const r = await api.post<{ user: SessionUser }>("/auth/otp/verify", { phone, code });
        finish(r.user);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 via-sand-100 to-coral-50 p-4">
      <div className="w-full max-w-md animate-fade-up">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <LogoMark className="h-16 w-16" />
          <p className="text-lg font-extrabold text-brand-800">{settings.str("clinic.name", "کلینیک کاردرمانی ذهن سبز")}</p>
          <h1 className="text-xl font-black text-brand-900">ورود به سامانه</h1>
          <p className="text-sm text-slate-500">بیماران با کد پیامکی، همکاران با رمز عبور</p>
        </div>
        <div className="card p-6">
          <Tabs value={mode} onChange={(m) => { setMode(m); setOtpSent(false); }} tabs={[{ key: "otp", label: <span className="flex items-center gap-1.5"><Smartphone className="h-4 w-4" />کد پیامکی</span> }, { key: "password", label: <span className="flex items-center gap-1.5"><KeyRound className="h-4 w-4" />رمز عبور</span> }]} className="mb-5" />
          <form onSubmit={submit} className="space-y-4">
            <Field label="شماره موبایل" required>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09123456789" dir="ltr" className="num text-left" autoFocus inputMode="tel" disabled={otpSent} />
            </Field>
            {mode === "password" && (
              <Field label="رمز عبور" required>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" className="text-left" />
              </Field>
            )}
            {mode === "otp" && otpSent && (
              <Field label="کد ۶ رقمی پیامک‌شده" required hint="کد را از پیامک دریافتی وارد کنید">
                <Input value={code} onChange={(e) => setCode(e.target.value.replace(/[^\d۰-۹]/g, "").replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))))} maxLength={6} dir="ltr" className="num text-center text-xl tracking-[0.5em]" autoFocus inputMode="numeric" />
              </Field>
            )}
            <Button type="submit" loading={loading} className="w-full" size="lg">
              {mode === "password" ? "ورود" : otpSent ? "تأیید و ورود" : "دریافت کد ورود"}
            </Button>
            {otpSent && <button type="button" onClick={() => setOtpSent(false)} className="w-full text-center text-xs text-slate-400 hover:text-brand-600">تغییر شماره / ارسال مجدد</button>}
          </form>
        </div>
        <Link href="/" className="mt-5 flex items-center justify-center gap-1 text-sm text-slate-500 hover:text-brand-700"><ArrowLeft className="h-4 w-4" />بازگشت به سایت</Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense><LoginInner /></Suspense>;
}
