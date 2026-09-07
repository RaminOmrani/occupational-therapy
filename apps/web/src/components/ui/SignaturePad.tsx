"use client";
import { useEffect, useRef, useState } from "react";
import { Eraser } from "lucide-react";

/** پد امضای لمسی/ماوسی؛ خروجی data URL تصویر PNG */
export function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);
  useEffect(() => {
    const c = ref.current!;
    const dpr = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * dpr; c.height = 180 * dpr;
    const ctx = c.getContext("2d")!;
    ctx.scale(dpr, dpr); ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#12473e";
  }, []);
  const pos = (e: any) => { const r = ref.current!.getBoundingClientRect(); const p = e.touches ? e.touches[0] : e; return { x: p.clientX - r.left, y: p.clientY - r.top }; };
  const start = (e: any) => { drawing.current = true; const ctx = ref.current!.getContext("2d")!; const { x, y } = pos(e); ctx.beginPath(); ctx.moveTo(x, y); };
  const move = (e: any) => { if (!drawing.current) return; e.preventDefault(); const ctx = ref.current!.getContext("2d")!; const { x, y } = pos(e); ctx.lineTo(x, y); ctx.stroke(); if (empty) setEmpty(false); };
  const end = () => { if (!drawing.current) return; drawing.current = false; onChange(ref.current!.toDataURL("image/png")); };
  const clear = () => { const c = ref.current!; c.getContext("2d")!.clearRect(0, 0, c.width, c.height); setEmpty(true); onChange(null); };
  return (
    <div>
      <div className="relative rounded-2xl border-2 border-dashed border-sand-300 bg-white">
        <canvas ref={ref} className="h-[180px] w-full cursor-crosshair touch-none rounded-2xl" onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end} onTouchStart={start} onTouchMove={move} onTouchEnd={end} />
        {empty && <p className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-slate-300">اینجا امضا کنید</p>}
      </div>
      <button type="button" onClick={clear} className="mt-2 flex items-center gap-1 text-xs text-slate-500 hover:text-coral-600"><Eraser className="h-3.5 w-3.5" />پاک‌کردن</button>
    </div>
  );
}
