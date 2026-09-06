/**
 * داده‌های نمونه برای شروع سریع. اجرا: pnpm db:seed
 * کاربران پیش‌فرض (رمزها را بعد از اولین ورود تغییر دهید):
 *   مدیر:     09120000001 / admin1234
 *   منشی:     09120000002 / admin1234
 *   درمانگر:  09120000003 / admin1234   و   09120000004 / admin1234
 *   بیمار:    09120000010 / OT-00001 (یا ورود با کد پیامکی)
 */
import { assessmentScore, ASSESSMENT_TEMPLATES, jalaliToDate, type AssessmentType } from "@toranj/shared";
import { prisma } from "./lib/prisma.js";
import { hashPassword } from "./lib/auth.js";
import { ensureDefaultSettings, setSetting } from "./lib/settings.js";
import { ensureDefaultTemplates } from "./lib/sms/service.js";
import { nextNumber } from "./lib/numbering.js";

const PASS = "admin1234";

async function upsertUser(phone: string, role: string, firstName: string, lastName: string, password = PASS) {
  return prisma.user.upsert({
    where: { phone },
    create: { phone, role, firstName, lastName, passwordHash: await hashPassword(password) },
    update: { role, firstName, lastName },
  });
}

async function main() {
  await ensureDefaultSettings();
  await ensureDefaultTemplates();

  const admin = await upsertUser("09120000001", "ADMIN", "رامین", "عمرانی");
  const secretary = await upsertUser("09120000002", "SECRETARY", "سارا", "احمدی");
  const t1User = await upsertUser("09120000003", "THERAPIST", "مریم", "محمدی");
  const t2User = await upsertUser("09120000004", "THERAPIST", "علی", "کریمی");

  const t1 = await prisma.therapist.upsert({
    where: { userId: t1User.id },
    create: { userId: t1User.id, specialty: "کاردرمانی کودکان و یکپارچگی حسی", bio: "کارشناس ارشد کاردرمانی با ۱۰ سال سابقه در حوزه کودکان با اختلالات رشدی و یکپارچگی حسی", licenseNo: "ک-۱۲۳۴", color: "#0F8B8D", sessionPrice: 550000, sortOrder: 1 },
    update: {},
  });
  const t2 = await prisma.therapist.upsert({
    where: { userId: t2User.id },
    create: { userId: t2User.id, specialty: "توانبخشی عصبی بزرگسالان", bio: "متخصص توانبخشی بیماران سکته مغزی، آسیب نخاعی و پارکینسون", licenseNo: "ک-۵۶۷۸", color: "#E76F51", sessionPrice: 600000, sortOrder: 2 },
    update: {},
  });

  const existing = await prisma.patient.count();
  if (existing === 0) {
    const samples = [
      { firstName: "امیرحسین", lastName: "رضایی", phone: "09120000010", birth: [1397, 6, 20], gender: "MALE", diagnosis: "اختلال پردازش حسی", guardianName: "زهرا رضایی", therapist: t1 },
      { firstName: "نازنین", lastName: "موسوی", phone: "09120000011", birth: [1395, 2, 5], gender: "FEMALE", diagnosis: "تأخیر رشدی حرکتی ظریف", guardianName: "مهدی موسوی", therapist: t1 },
      { firstName: "محمد", lastName: "حسینی", phone: "09120000012", birth: [1340, 11, 12], gender: "MALE", diagnosis: "همی‌پارزی راست پس از سکته مغزی", therapist: t2 },
      { firstName: "فاطمه", lastName: "نوری", phone: "09120000013", birth: [1362, 8, 25], gender: "FEMALE", diagnosis: "سندرم تونل کارپال دوطرفه", therapist: t2 },
      { firstName: "آرش", lastName: "قاسمی", phone: "09120000014", birth: [1399, 3, 1], gender: "MALE", diagnosis: "اختلال طیف اتیسم", guardianName: "نیلوفر قاسمی", therapist: t1 },
      { firstName: "لیلا", lastName: "صادقی", phone: "09120000015", birth: [1350, 1, 8], gender: "FEMALE", diagnosis: "پارکینسون", therapist: t2 },
    ];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let dayOffset = 0;
    for (const s of samples) {
      const fileNumber = await nextNumber("patient", "OT-");
      const birthDate = jalaliToDate(s.birth[0], s.birth[1], s.birth[2]);
      const user = await prisma.user.create({ data: { phone: s.phone, role: "PATIENT", firstName: s.firstName, lastName: s.lastName, passwordHash: await hashPassword(fileNumber) } });
      const p = await prisma.patient.create({
        data: { fileNumber, userId: user.id, firstName: s.firstName, lastName: s.lastName, phone: s.phone, birthDate, gender: s.gender, diagnosis: s.diagnosis, guardianName: s.guardianName ?? null, primaryTherapistId: s.therapist.id, referralSource: "معرفی پزشک", tags: JSON.stringify(s.therapist.id === t1.id ? ["کودک"] : ["بزرگسال"]) },
      });
      // شرح حال
      await prisma.intakeForm.create({
        data: { patientId: p.id, therapistId: s.therapist.id, chiefComplaint: `مراجعه به‌دلیل ${s.diagnosis}`, historyPresent: "علائم از حدود ۶ ماه پیش آغاز شده و به‌تدریج بر فعالیت‌های روزمره اثر گذاشته است.", medicalHistory: "سابقه بیماری خاص دیگری گزارش نشده است.", medications: "-", expectations: "بهبود استقلال در فعالیت‌های روزمره", plan: "۲ جلسه در هفته، ارزیابی مجدد پس از ۱۲ جلسه" },
      });
      // ارزیابی‌ها
      for (const type of Object.keys(ASSESSMENT_TEMPLATES) as AssessmentType[]) {
        const items = ASSESSMENT_TEMPLATES[type].sections.flatMap((sec) => sec.items.map((it) => ({ key: it.key, score: Math.floor(Math.random() * 3) + 1, note: "" })));
        const { score, max } = assessmentScore(type, items);
        await prisma.assessment.create({ data: { patientId: p.id, therapistId: s.therapist.id, type, items: JSON.stringify(items), score, maxScore: max, date: new Date(today.getTime() - 20 * 86400000), summary: "ارزیابی اولیه", recommendations: "ادامه درمان طبق برنامه" } });
      }
      // اهداف
      await prisma.treatmentGoal.create({ data: { patientId: p.id, therapistId: s.therapist.id, title: "بهبود مهارت‌های حرکتی ظریف", category: "PHYSICAL", progress: 40, targetDate: new Date(today.getTime() + 60 * 86400000) } });
      await prisma.treatmentGoal.create({ data: { patientId: p.id, therapistId: s.therapist.id, title: "افزایش توجه پایدار به ۱۵ دقیقه", category: "COGNITIVE", progress: 25 } });
      await prisma.homeProgram.create({ data: { patientId: p.id, therapistId: s.therapist.id, title: "تمرین گرفتن و رهاکردن اشیای کوچک", description: "روزانه ۱۰ دقیقه با گیره‌های لباس و مهره‌ها تمرین گرفتن با انگشت شست و اشاره.", frequency: "روزانه" } });
      // جلسات گذشته (انجام‌شده) و آینده
      for (let i = 4; i >= 1; i--) {
        const start = new Date(today.getTime() - i * 3 * 86400000);
        start.setHours(9 + (dayOffset % 6), (dayOffset % 2) * 30, 0, 0);
        const a = await prisma.appointment.create({ data: { patientId: p.id, therapistId: s.therapist.id, startAt: start, endAt: new Date(start.getTime() + 45 * 60000), status: "DONE", price: s.therapist.sessionPrice, createdById: secretary.id, fixedAt: start } });
        await prisma.progressNote.create({ data: { patientId: p.id, therapistId: s.therapist.id, appointmentId: a.id, date: start, sessionNumber: 5 - i, subjective: "مراجع با انگیزه در جلسه حاضر شد.", objective: "انجام تمرینات هماهنگی چشم و دست با موفقیت ۷۰٪", assessment: "روند پیشرفت مطلوب", plan: "افزایش سطح دشواری تمرینات", activities: "بازی با خمیر، نخ‌کردن مهره، تمرین تعادل", progressScore: 5 + (4 - i), cooperation: 4 } });
      }
      for (let i = 0; i <= 2; i++) {
        const start = new Date(today.getTime() + i * 2 * 86400000);
        start.setHours(10 + (dayOffset % 5), (dayOffset % 2) * 30, 0, 0);
        if (start < now) start.setDate(start.getDate() + 1);
        await prisma.appointment.create({ data: { patientId: p.id, therapistId: s.therapist.id, startAt: start, endAt: new Date(start.getTime() + 45 * 60000), status: i === 0 ? "CONFIRMED" : "SCHEDULED", price: s.therapist.sessionPrice, createdById: secretary.id } });
      }
      // مالی
      const sessions = await prisma.appointment.findMany({ where: { patientId: p.id, status: "DONE" } });
      const items = sessions.map(() => ({ title: "جلسه کاردرمانی", qty: 1, unitPrice: s.therapist.sessionPrice ?? 500000 }));
      const subtotal = items.reduce((a, b) => a + b.unitPrice, 0);
      const discount = dayOffset % 2 === 0 ? 100000 : 0;
      const inv = await prisma.invoice.create({ data: { number: await nextNumber("invoice", "INV-"), patientId: p.id, items: JSON.stringify(items), subtotal, discount, discountNote: discount ? "تخفیف معرفی" : null, total: subtotal - discount, dueDate: new Date(today.getTime() + 7 * 86400000) } });
      await prisma.appointment.updateMany({ where: { id: { in: sessions.map((x) => x.id) } }, data: { invoiceId: inv.id } });
      const paidAmount = dayOffset % 3 === 0 ? subtotal - discount : Math.round((subtotal - discount) / 2);
      await prisma.payment.create({ data: { patientId: p.id, invoiceId: inv.id, amount: paidAmount, method: dayOffset % 2 ? "CARD" : "CASH", receivedById: secretary.id } });
      await prisma.invoice.update({ where: { id: inv.id }, data: { paid: paidAmount, status: paidAmount >= subtotal - discount ? "PAID" : "PARTIAL" } });
      if (dayOffset === 1) await prisma.walletTransaction.create({ data: { patientId: p.id, amount: 300000, type: "DEPOSIT", description: "شارژ اولیه", createdById: secretary.id } });
      dayOffset += 1;
    }

    await prisma.feedback.create({ data: { patientId: (await prisma.patient.findFirst())!.id, type: "PRAISE", subject: "تشکر از تیم درمان", message: "پیشرفت فرزندم در این چند ماه واقعاً چشمگیر بوده. ممنون از صبر و حوصله درمانگر عزیز.", rating: 5 } });
    await prisma.feedback.create({ data: { patientId: (await prisma.patient.findFirst({ skip: 1 }))!.id, type: "SUGGESTION", subject: "زمان انتظار", message: "اگر امکان یادآوری زودتر نوبت باشد عالی می‌شود.", rating: 4 } });

    for (const l of [
      { firstName: "حسین", lastName: "پاکدل", phone: "09120000020", source: "WEBSITE", status: "NEW", interest: "کاردرمانی کودک ۴ ساله با تأخیر گفتاری" },
      { firstName: "مینا", lastName: "شریفی", phone: "09120000021", source: "INSTAGRAM", status: "CONTACTED", interest: "توانبخشی بعد از سکته پدر" },
      { firstName: "", lastName: "", phone: "09120000022", source: "PHONE", status: "NEW", interest: "" },
    ]) {
      await prisma.lead.create({ data: { ...l, firstName: l.firstName || "ناشناس", leadNumber: await nextNumber("lead", "L-"), assignedToId: secretary.id, followUpAt: new Date(today.getTime() + 86400000) } });
    }

    const articles = [
      { title: "کاردرمانی چیست و به چه کسانی کمک می‌کند؟", category: "آموزشی", excerpt: "کاردرمانی حرفه‌ای است که به افراد کمک می‌کند در فعالیت‌های معنادار زندگی روزمره مستقل‌تر عمل کنند.", content: "## کاردرمانی چیست؟\n\nکاردرمانی (Occupational Therapy) شاخه‌ای از علوم توانبخشی است که با استفاده از فعالیت‌های هدفمند، به افراد کمک می‌کند تا توانایی انجام فعالیت‌های روزمره زندگی، کار و اوقات فراغت را به‌دست آورند یا حفظ کنند.\n\n### چه کسانی از کاردرمانی بهره می‌برند؟\n\n- کودکان با تأخیر رشدی، اتیسم، فلج مغزی و اختلالات یادگیری\n- بزرگسالان پس از سکته مغزی یا آسیب‌های عصبی\n- سالمندان برای حفظ استقلال و پیشگیری از سقوط\n- افراد با آسیب‌های دست و اندام فوقانی\n\n### روند درمان در کلینیک ما\n\n1. **ارزیابی جامع**: پروفایل جسمی، مهارت‌های ادراکی-حرکتی و شناختی\n2. **تدوین اهداف درمانی** به همراه خانواده\n3. **جلسات درمانی منظم** و برنامه تمرین خانگی\n4. **پیگیری پیشرفت** با گزارش‌های دوره‌ای در پنل بیمار" },
      { title: "۵ نشانه اختلال پردازش حسی در کودکان", category: "کودکان", excerpt: "اگر کودک شما نسبت به صداها، بافت‌ها یا حرکت واکنش‌های شدید یا بی‌تفاوتی نشان می‌دهد، این مقاله را بخوانید.", content: "## اختلال پردازش حسی\n\nکودکان با اختلال پردازش حسی (SPD) اطلاعات دریافتی از حواس را متفاوت پردازش می‌کنند.\n\n### نشانه‌های شایع\n\n1. حساسیت شدید به صدا، نور یا لمس\n2. اجتناب از بازی‌های حرکتی یا برعکس، جستجوی بی‌وقفه حرکت\n3. مشکل در لباس پوشیدن به‌دلیل حساسیت به بافت پارچه\n4. بدغذایی و حساسیت به بافت غذاها\n5. دشواری در تمرکز در محیط‌های شلوغ\n\n**یکپارچگی حسی** یکی از مؤثرترین رویکردهای کاردرمانی برای این کودکان است." },
      { title: "توانبخشی دست پس از سکته مغزی: از کجا شروع کنیم؟", category: "بزرگسالان", excerpt: "بازتوانی دست فلج پس از سکته نیازمند شروع زودهنگام، تکرار و تمرین‌های هدفمند است.", content: "## اهمیت شروع زودهنگام\n\nمغز در ماه‌های اول پس از سکته بیشترین ظرفیت بازسازی (نوروپلاستیسیته) را دارد.\n\n### اصول کلیدی\n\n- **تکرار زیاد** حرکات هدفمند\n- **درمان با محدودیت اجباری (CIMT)** برای دست سالم\n- **آینه‌درمانی** برای تحریک قشر حرکتی\n- **تمرین فعالیت‌های واقعی** مانند غذا خوردن و نوشتن\n\nدر کلینیک ما برای هر مراجع، پروفایل جسمی دقیقی ثبت و روند پیشرفت به‌صورت نموداری در پنل بیمار نمایش داده می‌شود." },
    ];
    for (const a of articles) {
      await prisma.article.create({ data: { ...a, slug: a.title.replace(/\s+/g, "-").replace(/[؟?]/g, ""), tags: JSON.stringify([a.category]), published: true, publishedAt: new Date(), authorId: admin.id } });
    }
  }

  await setSetting("clinic.name", "کلینیک کاردرمانی ترنج");
  console.log("✅ Seed done.");
  console.log("   مدیر:    09120000001 / admin1234");
  console.log("   منشی:    09120000002 / admin1234");
  console.log("   درمانگر: 09120000003 / admin1234 , 09120000004 / admin1234");
  console.log("   بیمار:   09120000010 / OT-00001 (یا کد پیامکی)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
