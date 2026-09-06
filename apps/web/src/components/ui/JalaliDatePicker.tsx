"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { JALALI_MONTHS, formatJalali, jalaliMonthLength, jalaliToDate, parseJalali, toJalali, toPersianDigits, toEnglishDigits } from "@toranj/shared";
import { cn } from "@/lib/utils";

interface Props {
  value: Date | string | null | undefined;
  onChange: (d: Date | null) => void;
  placeholder?: string;
  className?: string;
  withTime?: boolean;
  disabled?: boolean;
}

/** انتخابگر تاریخ شمسی سبک، بدون وابستگی خارجی */
export function JalaliDatePicker({ value, onChange, placeholder = "۱۴۰۳/۰۱/۰۱", className, withTime, disabled }: Props) {
  const date = useMemo(() => (value ? (typeof value === "string" ? new Date(value) : value) : null), [value]);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(formatJalali(date));
  const init = toJalali(date && !isNaN(date.getTime()) ? date : new Date());
  const [view, setView] = useState({ jy: init.jy, jm: init.jm });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setText(formatJalali(date)), [date]);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const commitText = () => {
    if (!text.trim()) return onChange(null);
    const d = parseJalali(text);
    if (d) {
      if (date) d.setHours(date.getHours(), date.getMinutes());
      onChange(d);
      const j = toJalali(d);
      setView({ jy: j.jy, jm: j.jm });
    } else setText(formatJalali(date));
  };

  const pick = (jd: number) => {
    const d = jalaliToDate(view.jy, view.jm, jd, date?.getHours() ?? 0, date?.getMinutes() ?? 0);
    onChange(d);
    if (!withTime) setOpen(false);
  };
  const shift = (n: number) => {
    let jm = view.jm + n;
    let jy = view.jy;
    if (jm > 12) { jm = 1; jy += 1; }
    if (jm < 1) { jm = 12; jy -= 1; }
    setView({ jy, jm });
  };

  const first = jalaliToDate(view.jy, view.jm, 1);
  const startOffset = (first.getDay() + 1) % 7; // شنبه = ۰
  const len = jalaliMonthLength(view.jy, view.jm);
  const sel = date && !isNaN(date.getTime()) ? toJalali(date) : null;
  const today = toJalali(new Date());
  const timeVal = date ? `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}` : "";

  return (
    <div ref={ref} className={cn("relative", className)}>
      <div className="relative">
        <input value={text} disabled={disabled} onChange={(e) => setText(e.target.value)} onBlur={commitText} onKeyDown={(e) => e.key === "Enter" && commitText()} onFocus={() => setOpen(true)} placeholder={placeholder} className="input num pl-9" dir="ltr" style={{ textAlign: "right" }} />
        <button type="button" disabled={disabled} onClick={() => setOpen((o) => !o)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-sand-200 hover:text-brand-600">
          <CalendarDays className="h-4 w-4" />
        </button>
      </div>
      {open && !disabled && (
        <div className="absolute right-0 z-40 mt-1 w-72 rounded-2xl border border-sand-200 bg-white p-3 shadow-card animate-fade-up">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => shift(-1)} className="rounded-lg p-1 hover:bg-sand-200"><ChevronRight className="h-4 w-4" /></button>
            <div className="flex items-center gap-1 text-sm font-bold">
              <select value={view.jm} onChange={(e) => setView({ ...view, jm: +e.target.value })} className="rounded-lg bg-sand-100 px-1 py-0.5 text-sm">
                {JALALI_MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
              <input value={toPersianDigits(view.jy)} onChange={(e) => { const y = +toEnglishDigits(e.target.value); if (y > 1300 && y < 1500) setView({ ...view, jy: y }); }} className="num w-16 rounded-lg bg-sand-100 px-1 py-0.5 text-center text-sm" />
            </div>
            <button type="button" onClick={() => shift(1)} className="rounded-lg p-1 hover:bg-sand-200"><ChevronLeft className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center text-[11px] text-slate-400">
            {["ش", "ی", "د", "س", "چ", "پ", "ج"].map((d) => <span key={d} className="py-1">{d}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: startOffset }).map((_, i) => <span key={`e${i}`} />)}
            {Array.from({ length: len }).map((_, i) => {
              const jd = i + 1;
              const isSel = sel && sel.jy === view.jy && sel.jm === view.jm && sel.jd === jd;
              const isToday = today.jy === view.jy && today.jm === view.jm && today.jd === jd;
              const friday = (startOffset + i) % 7 === 6;
              return (
                <button key={jd} type="button" onClick={() => pick(jd)} className={cn("num h-8 rounded-lg text-sm transition hover:bg-brand-100", isSel && "bg-brand-600 text-white hover:bg-brand-700", !isSel && isToday && "ring-1 ring-brand-400", !isSel && friday && "text-coral-500")}>
                  {toPersianDigits(jd)}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-sand-200 pt-2">
            <button type="button" onClick={() => { onChange(new Date()); setView({ jy: today.jy, jm: today.jm }); if (!withTime) setOpen(false); }} className="text-xs text-brand-600 hover:underline">امروز</button>
            {withTime && <input type="time" value={timeVal} onChange={(e) => { const [h, m] = e.target.value.split(":").map(Number); const d = new Date(date ?? new Date()); d.setHours(h || 0, m || 0, 0, 0); onChange(d); }} className="num rounded-lg border border-sand-300 px-2 py-1 text-sm" />}
            <button type="button" onClick={() => { onChange(null); setOpen(false); }} className="text-xs text-slate-400 hover:underline">پاک‌کردن</button>
          </div>
        </div>
      )}
    </div>
  );
}
