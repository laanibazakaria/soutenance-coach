import { NextResponse } from "next/server";
import { appelerGemini } from "@/lib/gemini";
import { MODULES, estProfilModule, construirePromptQuestionsModule } from "@/lib/modules";
import { parseQuestionsEntretien } from "@/lib/entretien";

/** Questions spécifiques d'un module d'oral, depuis le profil (texte seulement). */
export async function POST(request: Request) {
  let corps: unknown;
  try {
    corps = await request.json();
  } catch {
    return NextResponse.json({ erreur: "Requête illisible." }, { status: 400 });
  }
  const profil = (corps as { profil?: unknown })?.profil;
  if (!estProfilModule(profil)) return NextResponse.json({ erreur: "Profil manquant ou incomplet." }, { status: 400 });
  const m = MODULES[profil.module];
  if (!profil.documentTexte.trim() && !Object.values(profil.champs).some((v) => v.trim())) {
    return NextResponse.json({ erreur: "Décris ton projet ou dépose ton dossier pour personnaliser les questions." }, { status: 400 });
  }
  const resultat = await appelerGemini(construirePromptQuestionsModule(m, profil), { maxOutputTokens: 5000, temperature: 0.6 });
  if (!resultat.ok) {
    return NextResponse.json({ erreur: resultat.erreur, code: resultat.code }, { status: resultat.code === "cle_absente" ? 503 : 502 });
  }
  const questions = parseQuestionsEntretien(resultat.texte);
  if (!questions) return NextResponse.json({ erreur: "La liste renvoyée était inexploitable. Réessaie.", code: "format" }, { status: 502 });
  return NextResponse.json({ questions });
}
