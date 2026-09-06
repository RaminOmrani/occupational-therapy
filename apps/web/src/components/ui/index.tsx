"use client";
import { forwardRef, useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Loader2, X, Search, Inbox } from "lucide-react";
import { cn, colorFor, initials } from "@/lib/utils";

// ---------- Button ----------
type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent";
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: ReactNode;
}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = "primary", size = "md", loading, icon, className, children, disabled, ...rest }, ref) {
  return (
    <button ref={ref} className={cn(`btn-${variant}`, size === "sm" && "px-3 py-1.5 text-xs", size === "lg" && "px-6 py-3 text-base", className)} disabled={disabled || loading} {...rest}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
});

// ---------- Inputs ----------
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn("input", className)} {...rest} />;
});
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn("input min-h-[90px]", className)} {...rest} />;
});
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cn("input appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2364748b%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:14px] bg-[left_0.75rem_center] bg-no-repeat pl-8", className)} {...rest}>
      {children}
    </select>
  );
});

export function Field({ label, error, hint, children, className, required }: { label?: string; error?: string; hint?: string; children: ReactNode; className?: string; required?: boolean }) {
  return (
    <div className={className}>
      {label && (
        <label className="label">
          {label} {required && <span className="text-coral-500">*</span>}
        </label>
      )}
      {children}
      {error ? <p className="mt-1 text-xs text-coral-600">{error}</p> : hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label?: string; description?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={cn("relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition", checked ? "bg-brand-600" : "bg-sand-300")}>
        <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", checked ? "right-[1.375rem]" : "right-0.5")} />
      </button>
      {(label || description) && (
        <span>
          {label && <span className="block text-sm font-medium text-slate-700">{label}</span>}
          {description && <span className="block text-xs text-slate-400">{description}</span>}
        </span>
      )}
    </label>
  );
}

export function SearchInput({ value, onChange, placeholder = "جستجو...", className, autoFocus }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string; autoFocus?: boolean }) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoFocus={autoFocus} className="input pr-9" />
      {value && (
        <button type="button" onClick={() => onChange("")} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-sand-200">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// ---------- Layout ----------
export function Card({ children, className, title, subtitle, actions, padded = true }: { children?: ReactNode; className?: string; title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; padded?: boolean }) {
  return (
    <section className={cn("card", padded && "p-5", className)}>
      {(title || actions) && (
        <header className={cn("mb-4 flex flex-wrap items-center justify-between gap-3", !padded && "px-5 pt-5")}>
          <div>
            {title && <h3 className="text-base font-bold text-slate-800">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle, actions, icon }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4 animate-fade-up">
      <div className="flex items-center gap-3">
        {icon && <div className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-100 text-brand-700">{icon}</div>}
        <div>
          <h1 className="text-xl font-extrabold text-slate-800 md:text-2xl">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, icon, tone = "brand", hint, className }: { label: string; value: ReactNode; icon?: ReactNode; tone?: "brand" | "coral" | "amber" | "sage" | "violet" | "slate"; hint?: ReactNode; className?: string }) {
  const tones: Record<string, string> = { brand: "bg-brand-100 text-brand-700", coral: "bg-coral-100 text-coral-700", amber: "bg-amber-400/20 text-amber-500", sage: "bg-sage-100 text-sage-700", violet: "bg-violet-100 text-violet-700", slate: "bg-sand-200 text-slate-600" };
  return (
    <div className={cn("card flex items-center gap-4 p-4", className)}>
      {icon && <div className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-2xl", tones[tone])}>{icon}</div>}
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="num truncate text-xl font-extrabold text-slate-800">{value}</p>
        {hint && <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p>}
      </div>
    </div>
  );
}

export function Badge({ children, tone = "slate", className }: { children: ReactNode; tone?: "brand" | "coral" | "amber" | "sage" | "violet" | "slate" | "sky"; className?: string }) {
  const tones: Record<string, string> = {
    brand: "bg-brand-100 text-brand-800",
    coral: "bg-coral-100 text-coral-800",
    amber: "bg-amber-400/20 text-amber-600",
    sage: "bg-sage-100 text-sage-700",
    violet: "bg-violet-100 text-violet-800",
    slate: "bg-sand-200 text-slate-600",
    sky: "bg-sky-100 text-sky-800",
  };
  return <span className={cn("badge", tones[tone], className)}>{children}</span>;
}

export function Avatar({ name, src, size = "md", className }: { name: string; src?: string | null; size?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  const sizes = { sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", lg: "h-14 w-14 text-lg", xl: "h-20 w-20 text-2xl" };
  if (src) return <img src={src} alt={name} className={cn("rounded-full object-cover", sizes[size], className)} />;
  return <div className={cn("grid shrink-0 place-items-center rounded-full font-bold", sizes[size], colorFor(name), className)}>{initials(name)}</div>;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center py-10 text-brand-600", className)}>
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );
}

export function EmptyState({ title = "موردی یافت نشد", description, action, icon }: { title?: string; description?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-3xl bg-sand-200 text-slate-400">{icon ?? <Inbox className="h-6 w-6" />}</div>
      <p className="font-semibold text-slate-700">{title}</p>
      {description && <p className="max-w-sm text-sm text-slate-400">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange, className }: { tabs: { key: T; label: ReactNode; count?: number }[]; value: T; onChange: (k: T) => void; className?: string }) {
  return (
    <div className={cn("flex gap-1 overflow-x-auto rounded-2xl bg-sand-200/70 p-1", className)}>
      {tabs.map((t) => (
        <button key={t.key} type="button" onClick={() => onChange(t.key)} className={cn("flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition", value === t.key ? "bg-white text-brand-700 shadow-soft" : "text-slate-500 hover:text-slate-700")}>
          {t.label}
          {t.count !== undefined && <span className={cn("num rounded-full px-1.5 text-[11px]", value === t.key ? "bg-brand-100 text-brand-700" : "bg-sand-300 text-slate-500")}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

// ---------- Modal ----------
export function Modal({ open, onClose, title, children, footer, size = "md" }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; footer?: ReactNode; size?: "sm" | "md" | "lg" | "xl" }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  const sizes = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl" };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={cn("flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-white shadow-card animate-fade-up sm:rounded-3xl", sizes[size])}>
        <header className="flex items-center justify-between border-b border-sand-200 px-5 py-4">
          <h3 className="text-base font-bold">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-sand-200">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex items-center justify-end gap-2 border-t border-sand-200 px-5 py-3">{footer}</footer>}
      </div>
    </div>
  );
}

export function useConfirm() {
  const [state, setState] = useState<{ message: string; resolve: (v: boolean) => void } | null>(null);
  const confirm = (message: string) => new Promise<boolean>((resolve) => setState({ message, resolve }));
  const dialog = state ? (
    <Modal open onClose={() => { state.resolve(false); setState(null); }} title="تأیید" size="sm" footer={<><Button variant="secondary" onClick={() => { state.resolve(false); setState(null); }}>انصراف</Button><Button variant="danger" onClick={() => { state.resolve(true); setState(null); }}>تأیید</Button></>}>
      <p className="text-sm text-slate-600">{state.message}</p>
    </Modal>
  ) : null;
  return { confirm, dialog };
}

export function ProgressBar({ value, tone = "brand", className }: { value: number; tone?: "brand" | "coral" | "amber" | "sage" | "violet"; className?: string }) {
  const tones = { brand: "bg-brand-500", coral: "bg-coral-500", amber: "bg-amber-400", sage: "bg-sage-500", violet: "bg-violet-500" };
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-sand-200", className)}>
      <div className={cn("h-full rounded-full transition-all", tones[tone])} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}
