"use client";
import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { toPersianDigits } from "@toranj/shared";
import { usePatientLookup } from "@/lib/hooks";
import { cn } from "@/lib/utils";

interface Props {
  value: string | null;
  onChange: (id: string | null, patient?: { id: string; fullName: string; fileNumber: string; phone: string; primaryTherapistId: string | null }) => void;
  initialLabel?: string;
  className?: string;
  disabled?: boolean;
}

/** جستجو و انتخاب بیمار با نام، شماره پرونده یا موبایل */
export function PatientPicker({ value, onChange, initialLabel, className, disabled }: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(initialLabel ?? "");
  const ref = useRef<HTMLDivElement>(null);
  const { data, isFetching } = usePatientLookup(q);
  useEffect(() => setLabel(initialLabel ?? ""), [initialLabel]);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  if (value && label)
    return (
      <div className={cn("input flex items-center justify-between", className)}>
        <span className="truncate text-sm">{label}</span>
        {!disabled && <button type="button" onClick={() => { onChange(null); setLabel(""); }} className="rounded-full p-0.5 text-slate-400 hover:bg-sand-200"><X className="h-3.5 w-3.5" /></button>}
      </div>
    );
  return (
    <div ref={ref} className={cn("relative", className)}>
      <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input value={q} disabled={disabled} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder="نام، شماره پرونده یا موبایل بیمار..." className="input pr-9" />
      {open && (
        <div className="absolute right-0 z-40 mt-1 max-h-64 w-full overflow-y-auto rounded-2xl border border-sand-200 bg-white p-1 shadow-card">
          {isFetching && !data ? <p className="p-3 text-xs text-slate-400">در حال جستجو...</p> : null}
          {data?.items.map((p) => (
            <button key={p.id} type="button" onClick={() => { onChange(p.id, p); setLabel(`${p.fullName} (${p.fileNumber})`); setOpen(false); setQ(""); }} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-right text-sm hover:bg-brand-50">
              <span>{p.fullName}</span>
              <span className="num text-xs text-slate-400">{p.fileNumber} · {toPersianDigits(p.phone)}</span>
            </button>
          ))}
          {data && !data.items.length && <p className="p-3 text-xs text-slate-400">بیماری یافت نشد</p>}
        </div>
      )}
    </div>
  );
}
