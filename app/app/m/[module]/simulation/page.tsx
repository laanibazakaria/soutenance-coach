import { redirect } from "next/navigation";

/** L'ancienne simulation question-par-question est remplacée par l'appel avec le jury IA. */
export default async function Redirection({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  redirect(`/app/appel?mode=${module === "concours" ? "concours" : "pitch"}`);
}
