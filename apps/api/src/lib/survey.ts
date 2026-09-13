import { randomBytes } from "node:crypto";
import { prisma } from "./prisma.js";
import { getSetting, getSettingBool, getSettingNumber } from "./settings.js";
import { sendTemplateSms } from "./sms/service.js";

/**
 * پس از تغییر وضعیت یک نوبت به «انجام‌شده» فراخوانی می‌شود؛ اگر تعداد جلسات انجام‌شده
 * مضربی از تنظیم survey.everySessions باشد، لینک رضایت‌سنجی پیامک می‌شود.
 */
export async function maybeSendSurvey(patientId: string) {
  try {
    if (!(await getSettingBool("survey.enabled", true))) return;
    const every = Math.max(1, await getSettingNumber("survey.everySessions", 5));
    const done = await prisma.appointment.count({ where: { patientId, status: "DONE" } });
    if (done === 0 || done % every !== 0) return;
    const already = await prisma.surveyToken.findFirst({ where: { patientId, sessionCount: done } });
    if (already) return;
    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) return;
    const token = randomBytes(12).toString("base64url");
    await prisma.surveyToken.create({ data: { token, patientId, sessionCount: done } });
    const base = (await getSetting("site.baseUrl", "http://localhost:3000")).replace(/\/$/, "");
    await sendTemplateSms("survey", patient.phone, { name: `${patient.firstName} ${patient.lastName}`, link: `${base}/survey/${token}`, token }, { related: { type: "patient", id: patientId } });
  } catch (e) {
    console.error("survey failed", e);
  }
}
