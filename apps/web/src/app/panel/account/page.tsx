"use client";
import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, UserCircle, Save } from "lucide-react";
import { ROLE_LABELS, toPersianDigits } from "@toranj/shared";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Avatar, Button, Card, Field, Input, PageHeader } from "@/components/ui";

export default function AccountPage() {
  const { user, refresh } = useAuth();
  const [name, setName] = useState({ firstName: user?.firstName ?? "", lastName: user?.lastName ?? "" });
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [l1, setL1] = useState(false);
  const [l2, setL2] = useState(false);
  if (!user) return null;
  const saveName = async () => { setL1(true); try { await api.patch("/auth/profile", name); await refresh(); toast.success("ذخیره شد"); } catch (e: any) { toast.error(e.message); } finally { setL1(false); } };
  const savePw = async () => {
    if (pw.newPassword !== pw.confirm) return toast.error("تکرار رمز عبور مطابقت ندارد");
    setL2(true);
    try { await api.post("/auth/change-password", { currentPassword: pw.currentPassword, newPassword: pw.newPassword }); toast.success("رمز عبور تغییر کرد"); setPw({ currentPassword: "", newPassword: "", confirm: "" }); } catch (e: any) { toast.error(e.message); } finally { setL2(false); }
  };
  return (
    <>
      <PageHeader title="حساب کاربری" icon={<UserCircle className="h-5 w-5" />} />
      <div className="grid gap-5 md:grid-cols-2">
        <Card title="مشخصات">
          <div className="mb-4 flex items-center gap-3"><Avatar name={`${user.firstName} ${user.lastName}`} size="lg" /><div><p className="font-bold">{user.firstName} {user.lastName}</p><p className="text-xs text-slate-400">{ROLE_LABELS[user.role]} · <span className="num" dir="ltr">{toPersianDigits(user.phone)}</span>{user.fileNumber ? ` · پرونده ${user.fileNumber}` : ""}</p></div></div>
          <div className="grid gap-3 sm:grid-cols-2"><Field label="نام"><Input value={name.firstName} onChange={(e) => setName({ ...name, firstName: e.target.value })} /></Field><Field label="نام خانوادگی"><Input value={name.lastName} onChange={(e) => setName({ ...name, lastName: e.target.value })} /></Field></div>
          <Button className="mt-4" loading={l1} onClick={saveName} icon={<Save className="h-4 w-4" />}>ذخیره</Button>
        </Card>
        <Card title="تغییر رمز عبور" subtitle={user.role === "PATIENT" ? "می‌توانید علاوه بر کد پیامکی، با رمز عبور هم وارد شوید" : undefined}>
          <div className="space-y-3">
            <Field label="رمز عبور فعلی" hint="اگر تاکنون رمزی نداشته‌اید خالی بگذارید"><Input type="password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} dir="ltr" /></Field>
            <Field label="رمز عبور جدید"><Input type="password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} dir="ltr" /></Field>
            <Field label="تکرار رمز عبور جدید"><Input type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} dir="ltr" /></Field>
          </div>
          <Button className="mt-4" loading={l2} onClick={savePw} disabled={pw.newPassword.length < 6} icon={<KeyRound className="h-4 w-4" />}>تغییر رمز</Button>
        </Card>
      </div>
    </>
  );
}
