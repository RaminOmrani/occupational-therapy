import Link from "next/link";
import { CircleHelp } from "lucide-react";
import { cn } from "@/lib/utils";

/** لینک کوچک «راهنما» به بخش مربوط در صفحه راهنمای پنل (در تب جدید تا کار فعلی از دست نرود) */
export function HelpLink({ anchor, label = "راهنما", className }: { anchor: string; label?: string; className?: string }) {
  return (
    <Link href={`/panel/help#${anchor}`} target="_blank" className={cn("inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-xs font-medium text-brand-600 hover:bg-brand-50 print:hidden", className)}>
      <CircleHelp className="h-3.5 w-3.5" />{label}
    </Link>
  );
}
