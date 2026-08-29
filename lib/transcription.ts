/**
 * Le nettoyage des hallucinations de Whisper. Sur un segment silencieux ou
 * bruité, le modèle invente des phrases apprises sur des vidéos sous-titrées —
 * « Sous-titrage Société Radio-Canada » en français, « Thanks for watching »
 * en anglais. Vu en vrai le 29/08/2026 sur le Samsung de Zakaria : sept
 * « Sous-titrage Société Radio-Canada » d'affilée dans une réponse au jury.
 * L'ancien filtre ne jugeait que le texte ENTIER ; celui-ci retire les
 * phrases inventées où qu'elles soient, et garde ce que l'utilisateur a dit.
 */
const HALLUCINATIONS: RegExp[] = [
  // « Sous-titrage Société Radio-Canada », « Sous-titrage ST' 501 »…
  /sous[-\s]?titrage(?:\s+(?:société|st\S*|par)[^,.!?\n]*)?/gi,
  /société radio[-\s]?canada/gi,
  // « Sous-titres réalisés par la communauté d'Amara.org » — le domaine
  // d'abord, sinon la phrase s'arrête à son point et laisse « .org ».
  /amara\.org/gi,
  /sous[-\s]?titres?\s+(?:faits?|réalisés?|par)[^,.!?\n]*/gi,
  // « Merci d'avoir regardé cette vidéo », « Thanks for watching »
  /(?:merci d'avoir regardé|merci de (?:votre|vous être) abonn\S*|thanks? for watching|thank you for watching)[^,.!?\n]*/gi,
  // « Abonnez-vous », « N'hésitez pas à vous abonner / liker la vidéo »
  /abonnez[-\s]vous[^,.!?\n]*/gi,
  /n'hésitez pas à (?:vous abonner|liker|mettre un pouce)[^,.!?\n]*/gi,
];

/** Un texte entier qui n'est qu'un remerciement de fin de vidéo. */
const QUE_DU_BRUIT = /^\s*(?:merci|thank you|thanks|au revoir|à bientôt|[\s.,!?…—-])*$/i;

export function nettoyerTranscription(brut: string): string {
  let t = brut;
  for (const re of HALLUCINATIONS) t = t.replace(re, " ");
  t = t.replace(/\s+/g, " ").trim();
  // Ce qui reste n'est que ponctuation ou formule de fin : rien n'a été dit.
  if (QUE_DU_BRUIT.test(t)) return "";
  return t;
}
