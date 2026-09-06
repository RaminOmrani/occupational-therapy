import Link from "next/link";
import { LogoMark } from "@/components/layout/Logo";
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-sand-100 p-6 text-center">
      <LogoMark className="h-16 w-16" />
      <h1 className="text-2xl font-black text-brand-900">صفحه پیدا نشد</h1>
      <p className="text-slate-500">آدرس وارد‌شده وجود ندارد یا جابه‌جا شده است.</p>
      <Link href="/" className="btn-primary">بازگشت به خانه</Link>
    </div>
  );
}
