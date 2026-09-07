import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { attachUser } from "./middleware/auth.js";
import { HttpError } from "./lib/errors.js";
import { authRouter } from "./routes/auth.js";
import { patientsRouter } from "./routes/patients.js";
import { leadsRouter } from "./routes/leads.js";
import { appointmentsRouter } from "./routes/appointments.js";
import { formsRouter } from "./routes/forms.js";
import { financeRouter } from "./routes/finance.js";
import { feedbackRouter } from "./routes/feedback.js";
import { articlesRouter } from "./routes/articles.js";
import { smsRouter } from "./routes/sms.js";
import { settingsRouter } from "./routes/settings.js";
import { usersRouter } from "./routes/users.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { notificationsRouter } from "./routes/notifications.js";
import { publicRouter } from "./routes/public.js";
import { uploadsRouter, documentsRouter, UPLOAD_DIR } from "./routes/uploads.js";
import { bookingsRouter, publicBookingRouter } from "./routes/bookings.js";
import { messagesRouter } from "./routes/messages.js";
import { surveysRouter, publicSurveyRouter } from "./routes/surveys.js";
import { consentsRouter } from "./routes/consents.js";
import { paymentsRouter } from "./routes/payments.js";
import { reportsRouter } from "./routes/reports.js";
import { backupsRouter } from "./routes/backups.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" }, contentSecurityPolicy: false }));
  const origins = (process.env.WEB_ORIGIN ?? "http://localhost:3000").split(",").map((s) => s.trim());
  app.use(cors({ origin: origins, credentials: true }));
  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());
  app.use(attachUser);

  app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: "7d" }));
  app.get("/api/health", (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

  app.use("/api/auth", authRouter);
  app.use("/api/public", publicRouter);
  app.use("/api/patients", patientsRouter);
  app.use("/api/leads", leadsRouter);
  app.use("/api/appointments", appointmentsRouter);
  app.use("/api/forms", formsRouter);
  app.use("/api/finance", financeRouter);
  app.use("/api/feedback", feedbackRouter);
  app.use("/api/articles", articlesRouter);
  app.use("/api/sms", smsRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api/uploads", uploadsRouter);
  app.use("/api/public/booking", publicBookingRouter);
  app.use("/api/public/survey", publicSurveyRouter);
  app.use("/api/bookings", bookingsRouter);
  app.use("/api/messages", messagesRouter);
  app.use("/api/surveys", surveysRouter);
  app.use("/api/consents", consentsRouter);
  app.use("/api/payments", paymentsRouter);
  app.use("/api/reports", reportsRouter);
  app.use("/api/backups", backupsRouter);
  app.use("/api", documentsRouter);

  app.use((_req, res) => res.status(404).json({ message: "مسیر یافت نشد" }));

  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message, details: err.details });
    if (err?.code === "P2002") return res.status(409).json({ message: "این مقدار تکراری است" });
    if (err?.code === "P2025") return res.status(404).json({ message: "موردی یافت نشد" });
    if (err?.name === "MulterError") return res.status(400).json({ message: err.code === "LIMIT_FILE_SIZE" ? "حجم فایل بیش از حد مجاز است" : err.message });
    console.error(err);
    res.status(500).json({ message: "خطای داخلی سرور" });
  });
  return app;
}
