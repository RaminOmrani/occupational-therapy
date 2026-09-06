"use client";
import { useParams } from "next/navigation";
import { TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { ProgressEditor } from "@/components/forms/ProgressEditor";
export default function Page() { const { id } = useParams<{ id: string }>(); return <><PageHeader title="گزارش پیشرفت" icon={<TrendingUp className="h-5 w-5" />} /><ProgressEditor id={id} /></>; }
