"use client";
import { Suspense } from "react";
import Link from "next/link";
import { Wallet, Printer } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { PageHeader, Spinner } from "@/components/ui";
import { FinancePanel } from "@/components/patient/FinancePanel";
function Inner() {
  const { user } = useAuth();
  if (!user?.patientId) return <Spinner />;
  return <><PageHeader title="امور مالی" subtitle="بدهکاری، بستانکاری، صورت‌حساب‌ها، پرداخت‌ها و کیف پول" icon={<Wallet className="h-5 w-5" />} actions={<Link href={`/panel/finance/statement/${user.patientId}`} className="btn-secondary"><Printer className="h-4 w-4" />صورت‌حساب کلی</Link>} /><FinancePanel patientId={user.patientId} /></>;
}

export default function Page() { return <Suspense><Inner /></Suspense>; }
