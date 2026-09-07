import cron from "node-cron";
import { formatTime, formatJalaliLong, startOfDay, endOfDay, addDays } from "@toranj/shared";
import { prisma } from "../lib/prisma.js";
import { getSettingBool, getSettingNumber } from "../lib/settings.js";
import { sendTemplateSms } from "../lib/sms/service.js";
import { notifyRole, notifyUser } from "../lib/notify.js";
import { scheduledBackup } from "../lib/backup.js";

/**
 * یادآوری جلسات: هر دقیقه بررسی می‌کند کدام نوبت‌های قطعی‌شده در بازه‌ی
 * «N ساعت بعد» قرار دارند و هنوز پیامک یادآوری نگرفته‌اند.
 */
async function sendReminders() {
  if (!(await getSettingBool("sms.autoReminder", true))) return;
  const hours = await getSettingNumber("schedule.reminderHoursBefore", 2);
  const now = new Date();
  const windowStart = now;
  const windowEnd = new Date(now.getTime() + hours * 3600000);
  const due = await prisma.appointment.findMany({
    where: { status: { in: ["CONFIRMED", "SCHEDULED"] }, smsReminderSentAt: null, startAt: { gte: windowStart, lte: windowEnd } },
    include: { patient: true, therapist: { include: { user: true } } },
  });
  for (const a of due) {
    try {
      await sendTemplateSms(
        "appointment_reminder",
        a.patient.phone,
        { name: `${a.patient.firstName} ${a.patient.lastName}`, therapist: `${a.therapist.user.firstName} ${a.therapist.user.lastName}`, time: formatTime(a.startAt), date: formatJalaliLong(a.startAt) },
        { related: { type: "appointment", id: a.id } },
      );
      await prisma.appointment.update({ where: { id: a.id }, data: { smsReminderSentAt: new Date() } });
      await notifyUser(a.patient.userId, "یادآوری جلسه", `جلسه شما امروز ساعت ${formatTime(a.startAt)} برگزار می‌شود`, "/panel/my/schedule");
    } catch (e) {
      console.error("reminder failed", a.id, e);
    }
  }
}

/** تبریک تولد (در صورت فعال‌بودن) و اعلان به مدیریت درباره تولدهای نزدیک */
async function birthdayJob() {
  const today = new Date();
  const all = await prisma.patient.findMany({ where: { birthDate: { not: null }, status: { not: "ARCHIVED" } } });
  const todays = all.filter((p) => p.birthDate!.getMonth() === today.getMonth() && p.birthDate!.getDate() === today.getDate());
  if (await getSettingBool("crm.birthdaySmsEnabled", false)) {
    for (const p of todays) {
      const already = await prisma.smsLog.findFirst({ where: { relatedType: "patient", relatedId: p.id, templateKey: "birthday", createdAt: { gte: startOfDay(today) } } });
      if (already) continue;
      await sendTemplateSms("birthday", p.phone, { name: `${p.firstName} ${p.lastName}` }, { related: { type: "patient", id: p.id } }).catch(console.error);
    }
  }
  if (todays.length) await notifyRole("ADMIN", "تولد امروز", todays.map((p) => `${p.firstName} ${p.lastName}`).join("، "), "/panel/crm/birthdays");
}

/** یادآوری پیگیری لیدها و برنامه‌ی فردا که هنوز قطعی نشده */
async function morningJob() {
  const dueLeads = await prisma.lead.count({ where: { followUpAt: { lte: new Date() }, status: { in: ["NEW", "CONTACTED", "INTERESTED"] } } });
  if (dueLeads) {
    await notifyRole("ADMIN", "لیدهای نیازمند پیگیری", `${dueLeads} لید موعد پیگیری‌شان رسیده است`, "/panel/leads?followUpDue=1");
    await notifyRole("SECRETARY", "لیدهای نیازمند پیگیری", `${dueLeads} لید موعد پیگیری‌شان رسیده است`, "/panel/leads?followUpDue=1");
  }
  const tomorrow = addDays(new Date(), 1);
  const unfixed = await prisma.appointment.count({ where: { startAt: { gte: startOfDay(tomorrow), lte: endOfDay(tomorrow) }, status: "SCHEDULED" } });
  if (unfixed) await notifyRole("SECRETARY", "برنامه فردا قطعی نشده", `${unfixed} نوبت فردا هنوز قطعی و پیامک نشده است`, "/panel/schedule");
}

/** علامت‌گذاری خودکار نوبت‌های گذشته‌ی بدون تعیین وضعیت به «غیبت» بعد از ۲۴ ساعت غیرفعال است؛ فقط اعلان می‌دهد */
export function startScheduler() {
  cron.schedule("* * * * *", () => sendReminders().catch(console.error));
  cron.schedule("0 8 * * *", () => birthdayJob().catch(console.error));
  cron.schedule("30 8 * * *", () => morningJob().catch(console.error));
  cron.schedule("0 18 * * *", () => morningJob().catch(console.error));
  cron.schedule("0 3 * * *", () => scheduledBackup().catch(console.error));
  console.log("⏰ scheduler started (reminders every minute, birthdays 08:00, follow-ups 08:30/18:00, backup 03:00)");
}
