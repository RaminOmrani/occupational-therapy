import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, Users, UserPlus, CalendarDays, ClipboardList, Activity, TrendingUp, NotebookPen, Wallet, MessageSquareText, Cake, Newspaper, MessageSquareHeart, UserCog, Settings, FolderHeart, Dumbbell, UserCircle, CalendarCheck, Globe, MessageCircle, BarChart3, FileSignature } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: string[];
  group?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/panel", label: "داشبورد", icon: LayoutDashboard, roles: ["ADMIN", "SECRETARY", "THERAPIST", "PATIENT"] },
  // بیمار
  { href: "/panel/my/schedule", label: "برنامه جلسات", icon: CalendarCheck, roles: ["PATIENT"] },
  { href: "/panel/my/records", label: "پرونده درمانی", icon: FolderHeart, roles: ["PATIENT"] },
  { href: "/panel/my/home", label: "تمرین خانگی", icon: Dumbbell, roles: ["PATIENT"] },
  { href: "/panel/my/finance", label: "امور مالی", icon: Wallet, roles: ["PATIENT"] },
  { href: "/panel/my/messages", label: "پیام به درمانگر", icon: MessageCircle, roles: ["PATIENT"] },
  { href: "/panel/my/feedback", label: "انتقاد و پیشنهاد", icon: MessageSquareHeart, roles: ["PATIENT"] },
  { href: "/panel/my/consent", label: "رضایت‌نامه", icon: FileSignature, roles: ["PATIENT"] },
  { href: "/panel/my/profile", label: "پروفایل من", icon: UserCircle, roles: ["PATIENT"] },
  // کارکنان
  { href: "/panel/schedule", label: "برنامه روزانه", icon: CalendarDays, roles: ["ADMIN", "SECRETARY", "THERAPIST"], group: "کلینیک" },
  { href: "/panel/patients", label: "بیماران", icon: Users, roles: ["ADMIN", "SECRETARY", "THERAPIST"], group: "کلینیک" },
  { href: "/panel/bookings", label: "نوبت‌های آنلاین", icon: Globe, roles: ["ADMIN", "SECRETARY"], group: "کلینیک" },
  { href: "/panel/messages", label: "پیام‌ها", icon: MessageCircle, roles: ["ADMIN", "SECRETARY", "THERAPIST"], group: "کلینیک" },
  { href: "/panel/leads", label: "لیدها (CRM)", icon: UserPlus, roles: ["ADMIN", "SECRETARY"], group: "کلینیک" },
  { href: "/panel/crm/birthdays", label: "تولدها", icon: Cake, roles: ["ADMIN", "SECRETARY"], group: "کلینیک" },
  { href: "/panel/forms/intake", label: "شرح حال اولیه", icon: ClipboardList, roles: ["ADMIN", "THERAPIST", "SECRETARY"], group: "فرم‌های بالینی" },
  { href: "/panel/forms/assessments", label: "ارزیابی‌ها", icon: Activity, roles: ["ADMIN", "THERAPIST", "SECRETARY"], group: "فرم‌های بالینی" },
  { href: "/panel/forms/progress", label: "گزارش پیشرفت", icon: TrendingUp, roles: ["ADMIN", "THERAPIST", "SECRETARY"], group: "فرم‌های بالینی" },
  { href: "/panel/forms/daily", label: "عملکرد روزانه", icon: NotebookPen, roles: ["ADMIN", "THERAPIST"], group: "فرم‌های بالینی" },
  { href: "/panel/finance", label: "مالی", icon: Wallet, roles: ["ADMIN", "SECRETARY"], group: "مدیریت" },
  { href: "/panel/reports", label: "گزارش‌های مدیریتی", icon: BarChart3, roles: ["ADMIN", "SECRETARY"], group: "مدیریت" },
  { href: "/panel/sms", label: "پیامک", icon: MessageSquareText, roles: ["ADMIN", "SECRETARY"], group: "مدیریت" },
  { href: "/panel/feedback", label: "انتقادات و پیشنهادات", icon: MessageSquareHeart, roles: ["ADMIN", "SECRETARY"], group: "مدیریت" },
  { href: "/panel/articles", label: "مقالات سایت", icon: Newspaper, roles: ["ADMIN", "THERAPIST", "SECRETARY"], group: "مدیریت" },
  { href: "/panel/users", label: "کاربران و درمانگران", icon: UserCog, roles: ["ADMIN"], group: "مدیریت" },
  { href: "/panel/settings", label: "تنظیمات", icon: Settings, roles: ["ADMIN"], group: "مدیریت" },
];

export function navForRole(role: string) {
  return NAV_ITEMS.filter((n) => n.roles.includes(role));
}
