"use client";
import { useParams } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { IntakeEditor } from "@/components/forms/IntakeEditor";
export default function Page() { const { id } = useParams<{ id: string }>(); return <><PageHeader title="شرح حال اولیه" icon={<ClipboardList className="h-5 w-5" />} /><IntakeEditor id={id} /></>; }
