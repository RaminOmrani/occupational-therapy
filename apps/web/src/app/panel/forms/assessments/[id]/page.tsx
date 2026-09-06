"use client";
import { useParams } from "next/navigation";
import { Activity } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { AssessmentEditor } from "@/components/forms/AssessmentEditor";
export default function Page() { const { id } = useParams<{ id: string }>(); return <><PageHeader title="ارزیابی" icon={<Activity className="h-5 w-5" />} /><AssessmentEditor id={id} /></>; }
