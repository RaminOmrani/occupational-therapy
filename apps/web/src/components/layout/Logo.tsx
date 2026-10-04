import { cn } from "@/lib/utils";

/** نشان کلینیک ذهن سبز: مغز با جوانه‌ها و برگ‌ها (همان لوگوی رسمی کلینیک و آیکون اپلیکیشن) */
export function LogoMark({ className }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/logo-mark-256.png" alt="" aria-hidden width={256} height={256} className={cn("h-10 w-10 shrink-0 object-contain", className)} />;
}

export function Logo({ name = "کلینیک توان‌بخشی ذهن سبز 💚", className, light, src }: { name?: string; className?: string; light?: boolean; src?: string | null }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      {src ? <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#f8f2e1] p-0.5"><img src={src} alt={name} className="h-full w-full object-contain" /></span> : <LogoMark />}
      <span className={cn("text-base font-extrabold leading-tight", light ? "text-white" : "text-brand-800")}>{name}</span>
    </span>
  );
}

