export const ROLES = ["ADMIN", "THERAPIST", "SECRETARY", "PATIENT"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "مدیریت",
  THERAPIST: "درمانگر",
  SECRETARY: "منشی",
  PATIENT: "بیمار",
};

/** نقش‌هایی که به بخش کارکنان کلینیک تعلق دارند */
export const STAFF_ROLES: Role[] = ["ADMIN", "THERAPIST", "SECRETARY"];

export function isStaff(role: string | null | undefined): boolean {
  return !!role && STAFF_ROLES.includes(role as Role);
}
