import { cn } from "@/lib/utils";

/** نشان کلینیک: دست باز درون برگ سبز؛ نماد مراقبت، رشد و حرکت */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={cn("h-10 w-10 shrink-0", className)} aria-hidden>
      <rect width="512" height="512" rx="112" fill="#f8f2e1" />
      <g fill="none" stroke="#0b5e2e" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" transform="translate(256 292)">
        <path d="M-8,-118 C-40,-140 -92,-128 -104,-92 C-146,-92 -168,-50 -150,-14 C-176,14 -166,60 -128,74 C-124,112 -80,132 -46,116 C-30,128 -12,128 -8,120 Z" />
        <path d="M8,-118 C40,-140 92,-128 104,-92 C146,-92 168,-50 150,-14 C176,14 166,60 128,74 C124,112 80,132 46,116 C30,128 12,128 8,120 Z" />
        <path d="M-104,-92 C-92,-60 -110,-40 -120,-30" /><path d="M-150,-14 C-118,-10 -100,20 -112,50" /><path d="M-46,116 C-48,80 -20,60 -8,40" />
        <path d="M104,-92 C92,-60 110,-40 120,-30" /><path d="M150,-14 C118,-10 100,20 112,50" /><path d="M46,116 C48,80 20,60 8,40" />
        <path d="M-8,120 C-8,150 -22,168 -36,180" />
      </g>
      <path d="M256,260 L256,120" stroke="#c18a26" strokeWidth="16" strokeLinecap="round" fill="none" />
      <circle cx="256" cy="262" r="14" fill="#c18a26" />
      <path d="M256,128 C252,72 200,44 150,52 C154,104 200,136 256,128 Z" fill="#4e8b2b" />
      <path d="M256,112 C260,56 312,28 362,36 C358,88 312,120 256,112 Z" fill="#5fa235" />
    </svg>
  );
}

export function Logo({ name = "کلینیک توان‌بخشی ذهن سبز 💚", className, light, src }: { name?: string; className?: string; light?: boolean; src?: string | null }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      {src ? <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#f8f2e1] p-0.5"><img src={src} alt={name} className="h-full w-full object-contain" /></span> : <LogoMark />}
      <span className={cn("text-base font-extrabold leading-tight", light ? "text-white" : "text-brand-800")}>{name}</span>
    </span>
  );
}

