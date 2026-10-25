"use client";
import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Wallet, Printer } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { PageHeader, Spinner } from "@/components/ui";
import { FinancePanel } from "@/components/patient/FinancePanel";
function Inner() {
  const { user } = useAuth();
  const sp = useSearchParams();
  const router = useRouter();
  // کارمندی که برای مراجع پرداخت آنلاین ساخته، بعد از درگاه به پروفایل مالی همان مراجع برمی‌گردد
  const pid = sp.get("pid");
  useEffect(() => {
    if (user && !user.patientId && pid) router.replace(`/panel/patients/${pid}?tab=finance&payment=${sp.get("payment") ?? ""}${sp.get("ref") ? `&ref=${encodeURIComponent(sp.get("ref")!)}` : ""}`);
  }, [user, pid, sp, router]);
  if (!user?.patientId) return <Spinner />;
  return <><PageHeader title="امور مالی" subtitle="بدهکاری، بستانکاری، صورت‌حساب‌ها، پرداخت‌ها و کیف پول" icon={<Wallet className="h-5 w-5" />} actions={<Link href={`/panel/finance/statement/${user.patientId}`} className="btn-secondary"><Printer className="h-4 w-4" />صورت‌حساب کلی</Link>} /><FinancePanel patientId={user.patientId} /></>;
}

export default function Page() { return <Suspense><Inner /></Suspense>; }
