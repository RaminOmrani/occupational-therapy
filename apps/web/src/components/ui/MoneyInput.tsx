"use client";
import { forwardRef, type InputHTMLAttributes } from "react";
import { toEnglishDigits, toPersianDigits } from "@toranj/shared";
import { cn } from "@/lib/utils";

/** ورودی مبلغ: هنگام تایپ سه‌رقم سه‌رقم جدا می‌شود؛ مقدار خروجی فقط رقم است (رشته) */
export const MoneyInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & { value: string | number | null | undefined; onChange: (digits: string) => void; suffix?: string }>(function MoneyInput({ value, onChange, className, suffix, ...rest }, ref) {
  const digits = String(value ?? "").replace(/[^0-9۰-۹]/g, "");
  const en = toEnglishDigits(digits);
  const shown = en ? toPersianDigits(Number(en).toLocaleString("en-US")) : "";
  return (
    <div className="relative">
      <input ref={ref} value={shown} inputMode="numeric" dir="ltr" onChange={(e) => onChange(toEnglishDigits(e.target.value).replace(/[^0-9]/g, "").replace(/^0+(?=\d)/, ""))} className={cn("input num text-left", suffix && "pr-14", className)} {...rest} />
      {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{suffix}</span>}
    </div>
  );
});
