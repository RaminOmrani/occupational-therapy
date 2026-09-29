import type { Config } from "tailwindcss";

/**
 * تم توان‌بخشی: سبز جنگلی لوگوی «ذهن سبز» + طلایی گرم (رشد و اعتماد)، مرجانی برای هشدار
 * روی زمینه‌ی شنی ملایم؛ گوشه‌های گرد و سایه‌های نرم برای حس دوستانه و انسانی.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}", "../../packages/shared/src/**/*.ts"],
  // کلاس‌های رنگی که به‌صورت پویا ساخته می‌شوند (نوع ارزیابی، وضعیت‌ها)
  safelist: [{ pattern: /(text|bg|border)-(brand|amber|violet|coral|sage|gold)-(100|400|500|600|700)/ }],
  theme: {
    extend: {
      fontFamily: { sans: ["Vazirmatn", "system-ui", "sans-serif"] },
      colors: {
        // سبز جنگلی لوگو (#0b5e2e) + طلایی (#c18a26)
        brand: { 50: "#eef8ef", 100: "#d8efdb", 200: "#b3dfb9", 300: "#84c78f", 400: "#4fa862", 500: "#2f8a44", 600: "#1f6f36", 700: "#0b5e2e", 800: "#0a4b26", 900: "#093d21", 950: "#04271a" },
        gold: { 50: "#fdf7e7", 100: "#f8ebc4", 200: "#f0d78f", 300: "#e6c15e", 400: "#d8a73a", 500: "#c18a26", 600: "#a9741d", 700: "#875b17", 800: "#6b4813", 900: "#573b12" },
        coral: { 50: "#fef4f0", 100: "#fde6dd", 200: "#fbc9b9", 300: "#f7a58b", 400: "#f07a5a", 500: "#e76f51", 600: "#d4502f", 700: "#b13f25", 800: "#913622", 900: "#763120" },
        sand: { 50: "#fbfaf7", 100: "#f7f5f0", 200: "#efeae0", 300: "#e2dbcc", 400: "#cfc4ad" },
        sage: { 100: "#e8f1e6", 300: "#b9d3b3", 500: "#7ba874", 700: "#4f7a49" },
        amber: { 400: "#f4a261", 500: "#e8944f" },
      },
      boxShadow: {
        soft: "0 1px 2px rgba(19,73,75,0.04), 0 8px 24px -12px rgba(19,73,75,0.18)",
        card: "0 1px 3px rgba(19,73,75,0.06), 0 12px 32px -16px rgba(19,73,75,0.22)",
        glow: "0 0 0 4px rgba(11,94,46,0.15)",
      },
      borderRadius: { xl: "0.9rem", "2xl": "1.25rem", "3xl": "1.75rem" },
      keyframes: {
        "fade-up": { "0%": { opacity: "0", transform: "translateY(8px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-10px)" } },
        "pulse-soft": { "0%,100%": { opacity: "1" }, "50%": { opacity: "0.6" } },
      },
      animation: { "fade-up": "fade-up .45s ease-out both", float: "float 6s ease-in-out infinite", "pulse-soft": "pulse-soft 2s ease-in-out infinite" },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
export default config;
