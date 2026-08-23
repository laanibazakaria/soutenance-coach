import { redirect } from "next/navigation";

/** L'ancienne simulation question-par-question est remplacée par l'appel avec le jury IA. */
export default function Redirection() {
  redirect("/app/appel?mode=soutenance");
}
