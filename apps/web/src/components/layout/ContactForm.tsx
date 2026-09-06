"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { api } from "@/lib/api";
import { Button, Field, Input, Textarea } from "@/components/ui";

export function ContactForm({ compact }: { compact?: boolean }) {
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/public/contact", form);
      setDone(true);
      toast.success("درخواست شما ثبت شد؛ به‌زودی تماس می‌گیریم");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };
  if (done)
    return (
      <div className="rounded-2xl bg-sage-100 p-6 text-center text-sage-700">
        <p className="font-bold">درخواست شما ثبت شد ✅</p>
        <p className="mt-1 text-sm">همکاران ما در اولین فرصت با شما تماس خواهند گرفت.</p>
      </div>
    );
  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="نام" required><Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required /></Field>
        <Field label="نام خانوادگی"><Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></Field>
      </div>
      <Field label="شماره موبایل" required><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required dir="ltr" placeholder="09123456789" className="num" /></Field>
      {!compact && <Field label="توضیحات / نیاز شما"><Textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="مثلاً: کودک ۵ ساله با تأخیر در مهارت‌های حرکتی" /></Field>}
      <Button type="submit" loading={loading} icon={<Send className="h-4 w-4" />} className="w-full">درخواست تماس و رزرو ارزیابی</Button>
    </form>
  );
}
