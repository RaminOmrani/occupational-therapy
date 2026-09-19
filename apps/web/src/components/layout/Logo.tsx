import { cn } from "@/lib/utils";

/** نشان کلینیک: دست باز درون برگ سبز؛ نماد مراقبت، رشد و حرکت */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={cn("h-10 w-10 shrink-0", className)} aria-hidden>
      <rect width="512" height="512" rx="112" fill="#178a6e" />
      <g transform="translate(256 250)">
        <path d="M-10,-124 C-40,-138 -78,-128 -96,-104 C-128,-108 -156,-84 -152,-50 C-172,-30 -172,6 -152,26 C-160,58 -140,90 -106,96 C-92,124 -50,132 -24,112 C-18,118 -12,120 -10,120 Z" fill="#ffffff" />
        <path d="M10,-124 C40,-138 78,-128 96,-104 C128,-108 156,-84 152,-50 C172,-30 172,6 152,26 C160,58 140,90 106,96 C92,124 50,132 24,112 C18,118 12,120 10,120 Z" fill="#ffffff" />
        <g fill="none" stroke="#178a6e" strokeWidth="11" strokeLinecap="round"><path d="M-26,-100 C-80,-60 -100,10 -44,100" /><path d="M26,-100 C80,-60 100,10 44,100" /></g>
        <g fill="none" stroke="#178a6e" strokeWidth="8" strokeLinecap="round" opacity="0.9">
          <path d="M-62,-64 C-92,-58 -114,-40 -126,-16" /><path d="M-78,-8 C-108,2 -128,22 -134,48" /><path d="M-62,44 C-90,56 -106,74 -108,92" />
          <path d="M62,-64 C92,-58 114,-40 126,-16" /><path d="M78,-8 C108,2 128,22 134,48" /><path d="M62,44 C90,56 106,74 108,92" />
        </g>
        <path d="M0,120 C2,150 -10,172 -30,188" fill="none" stroke="#ffffff" strokeWidth="14" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function Logo({ name = "کلینیک توان‌بخشی ذهن سبز 💚", className, light, src }: { name?: string; className?: string; light?: boolean; src?: string | null }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      {src ? <img src={src} alt={name} className="h-10 w-10 rounded-xl object-cover" /> : <LogoMark />}
      <span className={cn("text-base font-extrabold leading-tight", light ? "text-white" : "text-brand-800")}>{name}</span>
    </span>
  );
}

