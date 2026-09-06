export class HttpError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const notFound = (msg = "موردی یافت نشد") => new HttpError(404, msg);
export const badRequest = (msg = "درخواست نامعتبر است", details?: unknown) => new HttpError(400, msg, details);
export const unauthorized = (msg = "ابتدا وارد شوید") => new HttpError(401, msg);
export const forbidden = (msg = "دسترسی به این بخش مجاز نیست") => new HttpError(403, msg);
