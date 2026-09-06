import { z } from "zod";
import { HttpError } from "./errors.js";

export function validate<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
    throw new HttpError(400, issues[0]?.message ? `${issues[0].path ? issues[0].path + ": " : ""}${issues[0].message}` : "اطلاعات ورودی نامعتبر است", issues);
  }
  return result.data;
}

export const zDate = z.preprocess((v) => {
  if (v === "" || v === null || v === undefined) return undefined;
  if (typeof v === "string" || typeof v === "number") {
    const d = new Date(v);
    return isNaN(d.getTime()) ? v : d;
  }
  return v;
}, z.date());

export const zOptionalDate = z.preprocess((v) => {
  if (v === "" || v === null || v === undefined) return null;
  if (typeof v === "string" || typeof v === "number") {
    const d = new Date(v);
    return isNaN(d.getTime()) ? v : d;
  }
  return v;
}, z.date().nullable());

export const zOptionalString = z.preprocess((v) => (v === "" ? null : v), z.string().nullable().optional());
export const zOptionalInt = z.preprocess((v) => (v === "" || v === null || v === undefined ? null : Number(v)), z.number().int().nullable().optional());
export const zInt = z.preprocess((v) => (typeof v === "string" ? Number(v) : v), z.number().int());
