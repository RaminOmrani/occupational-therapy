import { QUESTIONNAIRES, type QuestionnaireType } from "@toranj/shared";
import { prisma } from "./prisma.js";
import { getSettingBool } from "./settings.js";
import { notifyRole, notifyUser } from "./notify.js";
import { sendTemplateSms } from "./sms/service.js";
import { ensurePatientAccount } from "../routes/patients.js";

export const DEFAULT_QUESTIONNAIRE: QuestionnaireType = "SENSORY_PROFILE_2";
const titleOf = (type: string) => QUESTIONNAIRES[type as QuestionnaireType]?.title ?? "پرسشنامه";

/** کاربرانی که به تحلیل آزمون دسترسی دارند (مدیر همیشه؛ بقیه با تیک «تحلیل آزمون‌ها») */
export async function analystUserIds() {
  const rows = await prisma.user.findMany({ where: { isActive: true, OR: [{ role: "ADMIN" }, { testAnalyst: true }] }, select: { id: true } });
  return rows.map((r) => r.id);
}

async function primaryTherapistUserId(patientId: string) {
  const p = await prisma.patient.findUnique({ where: { id: patientId }, select: { primaryTherapist: { select: { userId: true } } } });
  return p?.primaryTherapist?.userId ?? null;
}

/** اعلان به مدیر، منشی، درمانگر اصلی و تحلیلگران (هر کاربر فقط یک بار) */
async function notifyStaff(patientId: string | null, title: string, body: string, link: string) {
  const ids = new Set<string>();
  const roles = await prisma.user.findMany({ where: { isActive: true, role: { in: ["ADMIN", "SECRETARY"] } }, select: { id: true } });
  roles.forEach((u) => ids.add(u.id));
  (await analystUserIds()).forEach((id) => ids.add(id));
  if (patientId) { const t = await primaryTherapistUserId(patientId); if (t) ids.add(t); }
  await Promise.all([...ids].map((id) => notifyUser(id, title, body, link)));
}

/**
 * برای مراجع جدید یا جلسه ارزیابی: درخواست «پرسشنامه ارسال شود؟» در صف منشی ثبت می‌شود.
 * اگر برای این مراجع قبلاً پرسشنامه‌ای (با هر وضعیتی) وجود داشته باشد، دوباره پرسیده نمی‌شود.
 */
export async function requestQuestionnaire(patientId: string, source: "NEW_PATIENT" | "ASSESSMENT", requestedById?: string | null, type: QuestionnaireType = DEFAULT_QUESTIONNAIRE) {
  try {
    const settingKey = source === "NEW_PATIENT" ? "questionnaire.askOnNewPatient" : "questionnaire.askOnAssessment";
    if (!(await getSettingBool(settingKey, true))) return null;
    const exists = await prisma.questionnaireResponse.findFirst({ where: { patientId, type } });
    if (exists) return null;
    const p = await prisma.patient.findUnique({ where: { id: patientId }, select: { firstName: true, lastName: true, fileNumber: true } });
    if (!p) return null;
    const r = await prisma.questionnaireResponse.create({ data: { type, patientId, source, status: "PENDING_APPROVAL", requestedById: requestedById ?? null } });
    const why = source === "NEW_PATIENT" ? "مراجع جدید ثبت شد" : "جلسه ارزیابی ثبت شد";
    const body = `${why}: ${p.firstName} ${p.lastName} (${p.fileNumber}). «${titleOf(type)}» برای او ارسال شود؟`;
    await notifyRole("SECRETARY", "تأیید ارسال پرسشنامه", body, "/panel/questionnaires?tab=PENDING_APPROVAL");
    await notifyRole("ADMIN", "تأیید ارسال پرسشنامه", body, "/panel/questionnaires?tab=PENDING_APPROVAL");
    return r;
  } catch (e) {
    console.error("questionnaire request failed", e);
    return null;
  }
}

/** ارسال پرسشنامه برای مراجع: حساب کاربری ساخته می‌شود، پیامک (بدون لینک) و اعلان به همه طرف‌ها */
export async function assignQuestionnaire(id: string, byUserId: string) {
  const r = await prisma.questionnaireResponse.findUnique({ where: { id }, include: { patient: true } });
  if (!r || !r.patient) throw new Error("پرسشنامه یا مراجع یافت نشد");
  const updated = await prisma.questionnaireResponse.update({ where: { id }, data: { status: "ASSIGNED", approvedById: byUserId, approvedAt: new Date() } });
  const p = r.patient;
  const name = `${p.firstName} ${p.lastName}`;
  const title = titleOf(r.type);
  let userId = p.userId;
  if (!userId) userId = (await ensurePatientAccount(p.id).catch(() => null))?.id ?? null;
  await notifyUser(userId, "پرسشنامه جدید برای شما", `لطفاً «${title}» را از بخش پرسشنامه‌ها تکمیل کنید`, "/panel/my/questionnaires");
  if (await getSettingBool("sms.autoQuestionnaire", true)) {
    // خط خدماتی اشتراکی اجازه لینک نمی‌دهد؛ پیامک محل تکمیل را می‌گوید
    sendTemplateSms("questionnaire_assigned", p.phone, { name, title }, { related: { type: "patient", id: p.id } }).catch(console.error);
  }
  const by = await prisma.user.findUnique({ where: { id: byUserId }, select: { firstName: true, lastName: true } });
  await notifyStaff(p.id, "پرسشنامه برای مراجع ارسال شد", `«${title}» برای ${name} (${p.fileNumber}) ارسال شد${by ? ` — توسط ${by.firstName} ${by.lastName}` : ""}`, `/panel/questionnaires/${id}`);
  return updated;
}

/** پس از تکمیل پرسشنامه: اعلان به مدیر، منشی، درمانگر و تحلیلگران؛ و تأیید برای مراجع */
export async function notifySubmitted(id: string) {
  const r = await prisma.questionnaireResponse.findUnique({ where: { id }, include: { patient: true } });
  if (!r) return;
  const who = r.patient ? `${r.patient.firstName} ${r.patient.lastName} (${r.patient.fileNumber})` : `${r.subjectName ?? "بدون نام"}${r.respondentName ? ` — تکمیل‌کننده: ${r.respondentName}` : ""}${r.source === "PUBLIC" ? " (مهمان سایت)" : ""}`;
  await notifyStaff(r.patientId, "پرسشنامه تکمیل شد؛ آماده تحلیل", `«${titleOf(r.type)}» برای ${who} تکمیل شد`, `/panel/questionnaires/${id}`);
  if (r.patient?.userId) await notifyUser(r.patient.userId, "پرسشنامه شما ثبت شد", "پاسخ‌ها برای کاردرمانگر ارسال شد؛ پس از بررسی نتیجه اعلام می‌شود", "/panel/my/questionnaires");
}

export async function notifyAnalysisShared(id: string) {
  const r = await prisma.questionnaireResponse.findUnique({ where: { id }, include: { patient: true } });
  if (r?.patient?.userId) await notifyUser(r.patient.userId, "نتیجه پرسشنامه آماده است", `تحلیل «${titleOf(r.type)}» در بخش پرسشنامه‌ها قابل مشاهده است`, "/panel/my/questionnaires");
}
