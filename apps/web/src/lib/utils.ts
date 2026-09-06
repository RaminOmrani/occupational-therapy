import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join("");
}

/** رنگ پس‌زمینه ملایم بر اساس رشته (برای آواتار) */
export function colorFor(str: string) {
  const palette = ["bg-brand-100 text-brand-800", "bg-coral-100 text-coral-800", "bg-amber-400/20 text-amber-500", "bg-sage-100 text-sage-700", "bg-violet-100 text-violet-800", "bg-sky-100 text-sky-800"];
  let h = 0;
  for (const c of str) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return palette[h % palette.length];
}

export function toDateInput(d: Date | string | null | undefined) {
  if (!d) return "";
  const x = typeof d === "string" ? new Date(d) : d;
  return isNaN(x.getTime()) ? "" : x.toISOString();
}
