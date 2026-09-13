import { LogoMark } from "@/components/layout/Logo";
export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-sand-100 p-6 text-center">
      <LogoMark className="h-16 w-16" />
      <h1 className="text-xl font-black text-brand-900">اتصال اینترنت برقرار نیست</h1>
      <p className="max-w-sm text-sm text-slate-500">برای مشاهده برنامه جلسات و پرونده، به اینترنت وصل شوید و دوباره تلاش کنید.</p>
      <a href="/panel" className="btn-primary">تلاش دوباره</a>
    </div>
  );
}
