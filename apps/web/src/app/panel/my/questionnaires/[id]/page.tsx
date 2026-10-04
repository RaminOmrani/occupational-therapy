"use client";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck } from "lucide-react";
import { SENSORY_PROFILE_2 } from "@toranj/shared";
import { PageHeader } from "@/components/ui";
import { QuestionnaireForm } from "@/components/questionnaire/QuestionnaireForm";

export default function FillQuestionnairePage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  return (
    <>
      <PageHeader title={SENSORY_PROFILE_2.title} subtitle={SENSORY_PROFILE_2.intro} icon={<ClipboardCheck className="h-5 w-5" />} />
      <div className="mx-auto max-w-4xl">
        <QuestionnaireForm def={SENSORY_PROFILE_2} responseId={id === "new" ? undefined : id} onDone={() => qc.invalidateQueries({ queryKey: ["my-questionnaires"] })} />
      </div>
    </>
  );
}
