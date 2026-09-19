import { redirect } from "next/navigation";
export default async function ArticleRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/media/${encodeURIComponent(slug)}`);
}
