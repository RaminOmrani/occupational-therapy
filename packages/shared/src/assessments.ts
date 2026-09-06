/**
 * سه فرم ارزیابی استاندارد کاردرمانی که هر درمانگر برای هر بیمار تکمیل می‌کند.
 * هر آیتم امتیاز ۰ تا ۴ دارد (۰ = ناتوان / نیازمند کمک کامل، ۴ = مستقل و طبیعی).
 */
export const ASSESSMENT_TYPES = ["PHYSICAL", "PERCEPTUAL_MOTOR", "COGNITIVE"] as const;
export type AssessmentType = (typeof ASSESSMENT_TYPES)[number];

export interface AssessmentItemDef {
  key: string;
  label: string;
  hint?: string;
}

export interface AssessmentTemplate {
  type: AssessmentType;
  title: string;
  shortTitle: string;
  description: string;
  color: string;
  sections: { title: string; items: AssessmentItemDef[] }[];
}

export const SCORE_LABELS: Record<number, string> = {
  0: "ناتوان / وابسته کامل",
  1: "ضعیف / نیاز به کمک زیاد",
  2: "متوسط / نیاز به کمک جزئی",
  3: "خوب / نیاز به نظارت",
  4: "طبیعی / مستقل",
};

export const ASSESSMENT_TEMPLATES: Record<AssessmentType, AssessmentTemplate> = {
  PHYSICAL: {
    type: "PHYSICAL",
    title: "پروفایل جسمی",
    shortTitle: "جسمی",
    description: "ارزیابی وضعیت عضلانی-اسکلتی، دامنه حرکتی، تون، تعادل و مهارت‌های حرکتی",
    color: "teal",
    sections: [
      {
        title: "اندام فوقانی",
        items: [
          { key: "rom_shoulder", label: "دامنه حرکتی شانه", hint: "فلکشن، ابداکشن، روتیشن" },
          { key: "rom_elbow", label: "دامنه حرکتی آرنج و ساعد" },
          { key: "rom_wrist", label: "دامنه حرکتی مچ و انگشتان" },
          { key: "strength_upper", label: "قدرت عضلانی اندام فوقانی (MMT)" },
          { key: "grip", label: "قدرت گرفتن (Grip)", hint: "دینامومتر / مشاهده‌ای" },
          { key: "pinch", label: "قدرت پینچ (Pinch)" },
        ],
      },
      {
        title: "اندام تحتانی و تنه",
        items: [
          { key: "rom_lower", label: "دامنه حرکتی اندام تحتانی" },
          { key: "strength_lower", label: "قدرت عضلانی اندام تحتانی" },
          { key: "trunk_control", label: "کنترل تنه" },
          { key: "posture", label: "وضعیت بدنی (Posture)" },
        ],
      },
      {
        title: "تون، تعادل و حرکت",
        items: [
          { key: "tone", label: "تون عضلانی", hint: "اسپاستیسیته / هایپوتونی" },
          { key: "balance_static", label: "تعادل ایستا" },
          { key: "balance_dynamic", label: "تعادل پویا" },
          { key: "gross_motor", label: "مهارت‌های حرکتی درشت" },
          { key: "fine_motor", label: "مهارت‌های حرکتی ظریف" },
          { key: "endurance", label: "تحمل و استقامت فعالیت" },
          { key: "pain", label: "درد (معکوس: ۴ = بدون درد)" },
        ],
      },
      {
        title: "فعالیت‌های روزمره (ADL)",
        items: [
          { key: "adl_feeding", label: "غذا خوردن" },
          { key: "adl_dressing", label: "لباس پوشیدن" },
          { key: "adl_hygiene", label: "بهداشت فردی" },
          { key: "adl_transfer", label: "جابه‌جایی و انتقال" },
        ],
      },
    ],
  },
  PERCEPTUAL_MOTOR: {
    type: "PERCEPTUAL_MOTOR",
    title: "مهارت‌های ادراکی-حرکتی",
    shortTitle: "ادراکی-حرکتی",
    description: "ارزیابی ادراک بینایی، یکپارچگی بینایی-حرکتی، طرح‌واره بدنی و برنامه‌ریزی حرکتی",
    color: "amber",
    sections: [
      {
        title: "ادراک بینایی",
        items: [
          { key: "visual_discrimination", label: "تمایز بینایی" },
          { key: "figure_ground", label: "شکل و زمینه" },
          { key: "spatial_relations", label: "روابط فضایی" },
          { key: "visual_closure", label: "تکمیل بینایی (Visual Closure)" },
          { key: "form_constancy", label: "ثبات شکل" },
          { key: "visual_memory", label: "حافظه بینایی" },
        ],
      },
      {
        title: "یکپارچگی و هماهنگی",
        items: [
          { key: "eye_hand", label: "هماهنگی چشم و دست" },
          { key: "visual_motor", label: "یکپارچگی بینایی-حرکتی (VMI)" },
          { key: "bilateral", label: "هماهنگی دوطرفه" },
          { key: "crossing_midline", label: "عبور از خط میانی" },
          { key: "laterality", label: "جانبی‌شدن (Laterality)" },
        ],
      },
      {
        title: "طرح‌واره بدنی و پراکسی",
        items: [
          { key: "body_scheme", label: "طرح‌واره بدنی" },
          { key: "motor_planning", label: "برنامه‌ریزی حرکتی (Praxis)" },
          { key: "imitation", label: "تقلید حرکات" },
          { key: "sequencing_motor", label: "توالی حرکتی" },
          { key: "vestibular", label: "پردازش وستیبولار" },
          { key: "proprioception", label: "حس عمقی" },
          { key: "tactile", label: "پردازش لمسی" },
        ],
      },
    ],
  },
  COGNITIVE: {
    type: "COGNITIVE",
    title: "مهارت‌های شناختی",
    shortTitle: "شناختی",
    description: "ارزیابی توجه، حافظه، جهت‌یابی، کارکردهای اجرایی و مهارت‌های ارتباطی",
    color: "violet",
    sections: [
      {
        title: "توجه و جهت‌یابی",
        items: [
          { key: "orientation", label: "جهت‌یابی (زمان، مکان، شخص)" },
          { key: "sustained_attention", label: "توجه پایدار" },
          { key: "selective_attention", label: "توجه انتخابی" },
          { key: "divided_attention", label: "توجه تقسیم‌شده" },
        ],
      },
      {
        title: "حافظه",
        items: [
          { key: "short_term_memory", label: "حافظه کوتاه‌مدت" },
          { key: "working_memory", label: "حافظه کاری" },
          { key: "long_term_memory", label: "حافظه بلندمدت" },
          { key: "prospective_memory", label: "حافظه آینده‌نگر" },
        ],
      },
      {
        title: "کارکردهای اجرایی",
        items: [
          { key: "problem_solving", label: "حل مسئله" },
          { key: "planning", label: "برنامه‌ریزی و سازماندهی" },
          { key: "sequencing", label: "توالی‌بندی" },
          { key: "inhibition", label: "بازداری پاسخ" },
          { key: "flexibility", label: "انعطاف‌پذیری شناختی" },
          { key: "processing_speed", label: "سرعت پردازش" },
          { key: "insight", label: "بینش و خودآگاهی" },
        ],
      },
      {
        title: "زبان و اجتماعی",
        items: [
          { key: "comprehension", label: "درک دستورات" },
          { key: "expression", label: "بیان و ارتباط" },
          { key: "social_cognition", label: "شناخت اجتماعی" },
          { key: "safety_judgement", label: "قضاوت و ایمنی" },
        ],
      },
    ],
  },
};

export const ASSESSMENT_TYPE_LABELS: Record<AssessmentType, string> = {
  PHYSICAL: ASSESSMENT_TEMPLATES.PHYSICAL.title,
  PERCEPTUAL_MOTOR: ASSESSMENT_TEMPLATES.PERCEPTUAL_MOTOR.title,
  COGNITIVE: ASSESSMENT_TEMPLATES.COGNITIVE.title,
};

export interface AssessmentItemValue {
  key: string;
  score: number | null;
  note?: string;
}

export function assessmentMaxScore(type: AssessmentType): number {
  return ASSESSMENT_TEMPLATES[type].sections.reduce((s, sec) => s + sec.items.length * 4, 0);
}

export function assessmentScore(type: AssessmentType, items: AssessmentItemValue[]): { score: number; max: number; percent: number } {
  const max = assessmentMaxScore(type);
  const score = items.reduce((s, it) => s + (typeof it.score === "number" ? it.score : 0), 0);
  return { score, max, percent: max ? Math.round((score / max) * 100) : 0 };
}
