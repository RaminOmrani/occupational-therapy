"use client";
import { usePublicSettings } from "@/lib/settings";
import { Logo } from "./Logo";

/** لوگو با نام کلینیک از تنظیمات (سمت کلاینت) */
export function ClinicLogo({ light, className }: { light?: boolean; className?: string }) {
  const s = usePublicSettings();
  return <Logo name={s.str("clinic.name", "کلینیک کاردرمانی ذهن سبز")} light={light} className={className} />;
}
