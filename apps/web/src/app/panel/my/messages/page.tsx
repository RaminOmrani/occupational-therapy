"use client";
import { MessageCircle } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { MessageThread } from "@/components/messages/Thread";
export default function MyMessagesPage() {
  return <><PageHeader title="پیام به درمانگر" subtitle="سؤالات خود درباره تمرین‌ها و روند درمان را اینجا بپرسید؛ تیم درمان پاسخ می‌دهد" icon={<MessageCircle className="h-5 w-5" />} /><MessageThread patientId="mine" /></>;
}
