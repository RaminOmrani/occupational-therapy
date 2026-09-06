import { APPOINTMENT_STATUS_LABELS, LEAD_STATUS_LABELS, INVOICE_STATUS_LABELS, PATIENT_STATUS_LABELS, FEEDBACK_STATUS_LABELS, GOAL_STATUS_LABELS } from "@toranj/shared";
import { Badge } from "./index";

type Tone = "brand" | "coral" | "amber" | "sage" | "violet" | "slate" | "sky";
const MAP: Record<string, { label: string; tone: Tone }> = {
  // نوبت
  SCHEDULED: { label: APPOINTMENT_STATUS_LABELS.SCHEDULED, tone: "amber" },
  CONFIRMED: { label: APPOINTMENT_STATUS_LABELS.CONFIRMED, tone: "brand" },
  DONE: { label: APPOINTMENT_STATUS_LABELS.DONE, tone: "sage" },
  CANCELLED: { label: APPOINTMENT_STATUS_LABELS.CANCELLED, tone: "slate" },
  NO_SHOW: { label: APPOINTMENT_STATUS_LABELS.NO_SHOW, tone: "coral" },
  // لید
  NEW: { label: LEAD_STATUS_LABELS.NEW, tone: "sky" },
  CONTACTED: { label: LEAD_STATUS_LABELS.CONTACTED, tone: "amber" },
  INTERESTED: { label: LEAD_STATUS_LABELS.INTERESTED, tone: "violet" },
  CONVERTED: { label: LEAD_STATUS_LABELS.CONVERTED, tone: "sage" },
  LOST: { label: LEAD_STATUS_LABELS.LOST, tone: "slate" },
  // صورت‌حساب
  DRAFT: { label: INVOICE_STATUS_LABELS.DRAFT, tone: "slate" },
  ISSUED: { label: INVOICE_STATUS_LABELS.ISSUED, tone: "amber" },
  PARTIAL: { label: INVOICE_STATUS_LABELS.PARTIAL, tone: "violet" },
  PAID: { label: INVOICE_STATUS_LABELS.PAID, tone: "sage" },
  // بیمار
  ACTIVE: { label: PATIENT_STATUS_LABELS.ACTIVE, tone: "brand" },
  DISCHARGED: { label: PATIENT_STATUS_LABELS.DISCHARGED, tone: "sage" },
  ARCHIVED: { label: PATIENT_STATUS_LABELS.ARCHIVED, tone: "slate" },
  // بازخورد
  OPEN: { label: FEEDBACK_STATUS_LABELS.OPEN, tone: "coral" },
  REVIEWED: { label: FEEDBACK_STATUS_LABELS.REVIEWED, tone: "amber" },
  RESOLVED: { label: FEEDBACK_STATUS_LABELS.RESOLVED, tone: "sage" },
  // پیامک
  SENT: { label: "ارسال‌شده", tone: "sage" },
  FAILED: { label: "ناموفق", tone: "coral" },
  MOCK: { label: "آزمایشی", tone: "slate" },
  PENDING: { label: "در انتظار", tone: "amber" },
  // هدف
  ACHIEVED: { label: GOAL_STATUS_LABELS.ACHIEVED, tone: "sage" },
  PAUSED: { label: GOAL_STATUS_LABELS.PAUSED, tone: "amber" },
  DROPPED: { label: GOAL_STATUS_LABELS.DROPPED, tone: "slate" },
};

export function StatusBadge({ status }: { status: string }) {
  const m = MAP[status] ?? { label: status, tone: "slate" as Tone };
  return <Badge tone={m.tone}>{m.label}</Badge>;
}
