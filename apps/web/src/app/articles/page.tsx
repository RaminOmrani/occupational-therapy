import { redirect } from "next/navigation";
export default async function ArticlesRedirect({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const p = new URLSearchParams({ ...sp, type: "ARTICLE" }).toString();
  redirect(`/media?${p}`);
}
