"use client";
import { useCallback, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { Extension, Node, mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TextStyleKit } from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";
import Image from "@tiptap/extension-image";
import Youtube from "@tiptap/extension-youtube";
import Highlight from "@tiptap/extension-highlight";
import { TableKit } from "@tiptap/extension-table";
import { Placeholder } from "@tiptap/extensions";
import { toast } from "sonner";
import {
  Bold, Italic, Underline, Strikethrough, AlignRight, AlignCenter, AlignLeft, AlignJustify, List, ListOrdered, Quote, Minus, Link2, Link2Off, ImagePlus, Video, Music, Table2, Undo2, Redo2, Eraser, Pilcrow, Heading1, Heading2, Heading3, Highlighter, Palette, Loader2,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

/** جهت متن (راست‌چین/چپ‌چین) روی پاراگراف و تیترها */
const Direction = Extension.create({
  name: "direction",
  addGlobalAttributes() {
    return [{ types: ["paragraph", "heading", "listItem", "blockquote", "tableCell", "tableHeader"], attributes: { dir: { default: null, parseHTML: (el) => el.getAttribute("dir"), renderHTML: (attrs) => (attrs.dir ? { dir: attrs.dir } : {}) } } }];
  },
});

/** ویدیوی آپارات یا هر iframe مجاز */
const Iframe = Node.create({
  name: "iframe", group: "block", atom: true, draggable: true,
  addAttributes() { return { src: { default: null }, title: { default: "ویدیو" } }; },
  parseHTML() { return [{ tag: "iframe" }]; },
  renderHTML({ HTMLAttributes }) { return ["div", { class: "media-embed" }, ["iframe", mergeAttributes(HTMLAttributes, { allowfullscreen: "true", allow: "autoplay; fullscreen; picture-in-picture", frameborder: "0" })]]; },
});
/** فایل ویدیویی آپلودشده */
const VideoNode = Node.create({
  name: "video", group: "block", atom: true, draggable: true,
  addAttributes() { return { src: { default: null } }; },
  parseHTML() { return [{ tag: "video" }]; },
  renderHTML({ HTMLAttributes }) { return ["video", mergeAttributes(HTMLAttributes, { controls: "true", playsinline: "true", preload: "metadata", style: "width:100%;border-radius:16px" })]; },
});
/** فایل صوتی آپلودشده */
const AudioNode = Node.create({
  name: "audio", group: "block", atom: true, draggable: true,
  addAttributes() { return { src: { default: null } }; },
  parseHTML() { return [{ tag: "audio" }]; },
  renderHTML({ HTMLAttributes }) { return ["audio", mergeAttributes(HTMLAttributes, { controls: "true", preload: "metadata", style: "width:100%" })]; },
});

const FONTS = [
  { label: "وزیرمتن (پیش‌فرض)", value: "" },
  { label: "تاهوما", value: "Tahoma, sans-serif" },
  { label: "ایران‌سنس / سیستم", value: "IRANSans, 'Segoe UI', sans-serif" },
  { label: "نازنین / سریف", value: "'B Nazanin', 'Times New Roman', serif" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Courier (تک‌عرض)", value: "'Courier New', monospace" },
];
const SIZES = ["12px", "14px", "16px", "18px", "20px", "24px", "28px", "32px", "40px", "48px"];
const COLORS = ["#0f172a", "#178a6e", "#0c5443", "#e76f51", "#f4a261", "#8b5cf6", "#2563eb", "#dc2626", "#64748b", "#ffffff"];

export function toEmbed(url: string): string | null {
  const u = url.trim();
  let m = u.match(/aparat\.com\/v\/([A-Za-z0-9]+)/) || u.match(/videohash\/([A-Za-z0-9]+)/);
  if (m) return `https://www.aparat.com/video/video/embed/videohash/${m[1]}/vt/frame`;
  m = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  if (m) return `https://www.youtube-nocookie.com/embed/${m[1]}`;
  return null;
}

function Btn({ on, active, title, children, disabled }: { on: () => void; active?: boolean; title: string; children: React.ReactNode; disabled?: boolean }) {
  return <button type="button" title={title} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={on} className={cn("grid h-8 w-8 place-items-center rounded-lg text-slate-600 transition hover:bg-sand-200 disabled:opacity-40", active && "bg-brand-100 text-brand-800")}>{children}</button>;
}

/** ویرایشگر متن غنی (شبیه Word): فونت، اندازه، رنگ، تراز، لیست، لینک، تصویر، ویدیو، صوت، جدول */
export function RichEditor({ value, onChange, placeholder = "متن را اینجا بنویسید…", minHeight = 420 }: { value: string; onChange: (html: string) => void; placeholder?: string; minHeight?: number }) {
  const [busy, setBusy] = useState<string | null>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const vidRef = useRef<HTMLInputElement>(null);
  const audRef = useRef<HTMLInputElement>(null);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: false, autolink: true, defaultProtocol: "https" } }),
      TextStyleKit, TextAlign.configure({ types: ["heading", "paragraph"], alignments: ["right", "center", "left", "justify"], defaultAlignment: "right" }),
      Image.configure({ inline: false, allowBase64: false, HTMLAttributes: { class: "rounded-2xl" } }),
      Youtube.configure({ nocookie: true, width: 640, height: 360 }),
      Highlight.configure({ multicolor: true }),
      TableKit.configure({ table: { resizable: true } }),
      Placeholder.configure({ placeholder }),
      Direction, Iframe, VideoNode, AudioNode,
    ],
    content: value || "",
    editorProps: { attributes: { class: "prose-fa rich-editor focus:outline-none", dir: "rtl", style: `min-height:${minHeight}px` } },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  const uploadFile = useCallback(async (f: File, endpoint: string, kind: string) => {
    setBusy(kind);
    try { const fd = new FormData(); fd.append("file", f); const r = await api.post<{ url: string }>(endpoint, fd); return r.url; } catch (e: any) { toast.error(e.message); return null; } finally { setBusy(null); }
  }, []);
  if (!editor) return <div className="min-h-[200px] rounded-2xl bg-sand-100" />;

  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("آدرس لینک را وارد کنید:", prev ?? "https://");
    if (url === null) return;
    if (!url.trim()) { editor.chain().focus().extendMarkRange("link").unsetLink().run(); return; }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim(), target: "_blank" }).run();
  };
  const insertVideoUrl = () => {
    const url = window.prompt("لینک ویدیو (آپارات یا یوتیوب):", "https://www.aparat.com/v/");
    if (!url) return;
    const src = toEmbed(url);
    if (!src) return toast.error("لینک باید از آپارات یا یوتیوب باشد");
    editor.chain().focus().insertContent({ type: "iframe", attrs: { src } }).run();
  };
  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; const url = await uploadFile(f, "/uploads", "image"); if (url) editor.chain().focus().setImage({ src: url, alt: f.name }).run(); };
  const onPickVideo = async (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; const url = await uploadFile(f, "/uploads/media", "video"); if (url) editor.chain().focus().insertContent({ type: "video", attrs: { src: url } }).run(); };
  const onPickAudio = async (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; const url = await uploadFile(f, "/uploads/media", "audio"); if (url) editor.chain().focus().insertContent({ type: "audio", attrs: { src: url } }).run(); };
  const curFontSize = (editor.getAttributes("textStyle").fontSize as string) || "";
  const curFont = (editor.getAttributes("textStyle").fontFamily as string) || "";
  const curColor = (editor.getAttributes("textStyle").color as string) || "#0f172a";
  const heading = editor.isActive("heading", { level: 1 }) ? "h1" : editor.isActive("heading", { level: 2 }) ? "h2" : editor.isActive("heading", { level: 3 }) ? "h3" : "p";

  return (
    <div className="overflow-hidden rounded-2xl border border-sand-300 bg-white">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-1 border-b border-sand-200 bg-sand-50 p-2">
        <select value={heading} onChange={(e) => { const v = e.target.value; v === "p" ? editor.chain().focus().setParagraph().run() : editor.chain().focus().toggleHeading({ level: Number(v[1]) as 1 | 2 | 3 }).run(); }} className="h-8 rounded-lg border border-sand-300 bg-white px-2 text-xs" title="سبک پاراگراف">
          <option value="p">متن عادی</option><option value="h1">تیتر ۱</option><option value="h2">تیتر ۲</option><option value="h3">تیتر ۳</option>
        </select>
        <select value={curFont} onChange={(e) => (e.target.value ? editor.chain().focus().setFontFamily(e.target.value).run() : editor.chain().focus().unsetFontFamily().run())} className="h-8 max-w-[150px] rounded-lg border border-sand-300 bg-white px-2 text-xs" title="فونت">
          {FONTS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <select value={curFontSize} onChange={(e) => (e.target.value ? editor.chain().focus().setFontSize(e.target.value).run() : editor.chain().focus().unsetFontSize().run())} className="num h-8 rounded-lg border border-sand-300 bg-white px-2 text-xs" title="اندازه قلم">
          <option value="">اندازه</option>{SIZES.map((s) => <option key={s} value={s}>{s.replace("px", "")}</option>)}
        </select>
        <span className="mx-1 h-6 w-px bg-sand-300" />
        <Btn title="پررنگ" active={editor.isActive("bold")} on={() => editor.chain().focus().toggleBold().run()}><Bold className="h-4 w-4" /></Btn>
        <Btn title="مورب" active={editor.isActive("italic")} on={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-4 w-4" /></Btn>
        <Btn title="زیرخط" active={editor.isActive("underline")} on={() => editor.chain().focus().toggleUnderline().run()}><Underline className="h-4 w-4" /></Btn>
        <Btn title="خط‌خورده" active={editor.isActive("strike")} on={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className="h-4 w-4" /></Btn>
        <label className="relative grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-slate-600 hover:bg-sand-200" title="رنگ متن">
          <Palette className="h-4 w-4" style={{ color: curColor }} />
          <input type="color" value={curColor} onChange={(e) => editor.chain().focus().setColor(e.target.value).run()} className="absolute inset-0 cursor-pointer opacity-0" />
        </label>
        <div className="flex items-center gap-0.5">{COLORS.slice(0, 6).map((c) => <button key={c} type="button" title={c} onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().setColor(c).run()} className="h-4 w-4 rounded-full border border-sand-300" style={{ background: c }} />)}</div>
        <Btn title="هایلایت" active={editor.isActive("highlight")} on={() => editor.chain().focus().toggleHighlight({ color: "#fde68a" }).run()}><Highlighter className="h-4 w-4" /></Btn>
        <span className="mx-1 h-6 w-px bg-sand-300" />
        <Btn title="راست‌چین" active={editor.isActive({ textAlign: "right" })} on={() => editor.chain().focus().setTextAlign("right").run()}><AlignRight className="h-4 w-4" /></Btn>
        <Btn title="وسط‌چین" active={editor.isActive({ textAlign: "center" })} on={() => editor.chain().focus().setTextAlign("center").run()}><AlignCenter className="h-4 w-4" /></Btn>
        <Btn title="چپ‌چین" active={editor.isActive({ textAlign: "left" })} on={() => editor.chain().focus().setTextAlign("left").run()}><AlignLeft className="h-4 w-4" /></Btn>
        <Btn title="تراز دوطرفه" active={editor.isActive({ textAlign: "justify" })} on={() => editor.chain().focus().setTextAlign("justify").run()}><AlignJustify className="h-4 w-4" /></Btn>
        <Btn title="جهت متن: راست‌به‌چپ / چپ‌به‌راست" on={() => { const cur = editor.getAttributes("paragraph").dir || editor.getAttributes("heading").dir; editor.chain().focus().updateAttributes("paragraph", { dir: cur === "ltr" ? null : "ltr" }).updateAttributes("heading", { dir: cur === "ltr" ? null : "ltr" }).run(); }}><Pilcrow className="h-4 w-4" /></Btn>
        <span className="mx-1 h-6 w-px bg-sand-300" />
        <Btn title="تیتر ۱" active={editor.isActive("heading", { level: 1 })} on={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 className="h-4 w-4" /></Btn>
        <Btn title="تیتر ۲" active={editor.isActive("heading", { level: 2 })} on={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="h-4 w-4" /></Btn>
        <Btn title="تیتر ۳" active={editor.isActive("heading", { level: 3 })} on={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 className="h-4 w-4" /></Btn>
        <Btn title="لیست" active={editor.isActive("bulletList")} on={() => editor.chain().focus().toggleBulletList().run()}><List className="h-4 w-4" /></Btn>
        <Btn title="لیست شماره‌دار" active={editor.isActive("orderedList")} on={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></Btn>
        <Btn title="نقل‌قول" active={editor.isActive("blockquote")} on={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="h-4 w-4" /></Btn>
        <Btn title="خط جداکننده" on={() => editor.chain().focus().setHorizontalRule().run()}><Minus className="h-4 w-4" /></Btn>
        <span className="mx-1 h-6 w-px bg-sand-300" />
        <Btn title="لینک" active={editor.isActive("link")} on={setLink}><Link2 className="h-4 w-4" /></Btn>
        {editor.isActive("link") && <Btn title="حذف لینک" on={() => editor.chain().focus().unsetLink().run()}><Link2Off className="h-4 w-4" /></Btn>}
        <Btn title="درج تصویر (آپلود)" on={() => imgRef.current?.click()}>{busy === "image" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}</Btn>
        <Btn title="درج ویدیو از آپارات / یوتیوب" on={insertVideoUrl}><Video className="h-4 w-4" /></Btn>
        <Btn title="آپلود فایل ویدیو" on={() => vidRef.current?.click()}>{busy === "video" ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="text-[10px] font-bold">MP4</span>}</Btn>
        <Btn title="آپلود فایل صوتی" on={() => audRef.current?.click()}>{busy === "audio" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Music className="h-4 w-4" />}</Btn>
        <Btn title="درج جدول ۳×۳" on={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Table2 className="h-4 w-4" /></Btn>
        {editor.isActive("table") && (
          <div className="flex items-center gap-0.5 rounded-lg bg-white px-1 text-[11px]">
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().addRowAfter().run()} className="rounded px-1.5 py-1 hover:bg-sand-200">+سطر</button>
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().addColumnAfter().run()} className="rounded px-1.5 py-1 hover:bg-sand-200">+ستون</button>
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().deleteRow().run()} className="rounded px-1.5 py-1 hover:bg-sand-200">−سطر</button>
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().deleteColumn().run()} className="rounded px-1.5 py-1 hover:bg-sand-200">−ستون</button>
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().deleteTable().run()} className="rounded px-1.5 py-1 text-coral-600 hover:bg-coral-50">حذف جدول</button>
          </div>
        )}
        <span className="mx-1 h-6 w-px bg-sand-300" />
        <Btn title="پاک‌کردن قالب‌بندی" on={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}><Eraser className="h-4 w-4" /></Btn>
        <Btn title="واگرد" on={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}><Undo2 className="h-4 w-4" /></Btn>
        <Btn title="از نو" on={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}><Redo2 className="h-4 w-4" /></Btn>
        <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />
        <input ref={vidRef} type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" onChange={onPickVideo} />
        <input ref={audRef} type="file" accept="audio/*" className="hidden" onChange={onPickAudio} />
      </div>
      <EditorContent editor={editor} className="p-4" />
    </div>
  );
}
