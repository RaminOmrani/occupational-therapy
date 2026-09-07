import { cn } from "@/lib/utils";

/** نشان کلینیک: دست باز درون برگ سبز؛ نماد مراقبت، رشد و حرکت */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("h-10 w-10", className)} aria-hidden>
      <path d="M32 4C16 4 6 16 6 32c0 16 12 28 26 28 16 0 26-12 26-28C58 16 48 4 32 4z" fill="#178a6e" />
      <path d="M22 40V26a3 3 0 0 1 6 0v10M28 34V22a3 3 0 0 1 6 0v12M34 34V24a3 3 0 0 1 6 0v10M40 36v-6a3 3 0 0 1 6 0v8c0 8-6 12-12 12h-2c-5 0-8-2-11-6l-5-7a3 3 0 0 1 5-3l3 4" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="47" cy="17" r="4" fill="#f4a261" />
    </svg>
  );
}

export function Logo({ name = "کلینیک کاردرمانی ذهن سبز", className, light }: { name?: string; className?: string; light?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className={cn("text-base font-extrabold leading-tight", light ? "text-white" : "text-brand-800")}>{name}</span>
    </span>
  );
}

