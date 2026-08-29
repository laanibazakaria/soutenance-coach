import { extraireLexique, formaterLexique } from "./lexique";
import { lireCache, ecrireCache, empreinte } from "./ia-cache";
import type { StorageLike } from "./types";
import { listeDeckSauvegarde } from "./slides/persistance";
import { lireCandidature } from "./entretien/persistance";
import { estRapport } from "./rapport";

const CLE_RAPPORT = "rapport:texte";
const CLE_LEXIQUE = "lexique:v1";

/**
 * Le lexique des documents déposés sur CET appareil, prêt pour le prompt
 * Whisper. Extrait une fois par état du dossier (cache par empreinte) :
 * l'appel et l'entraînement le joignent à chaque segment envoyé en
 * transcription, pour que les sigles et noms propres du dossier survivent.
 */
export function lexiqueDepuisAppareil(storage: StorageLike): string {
  const deck = listeDeckSauvegarde(storage);
  const rapport = lireCache<unknown>(storage, CLE_RAPPORT);
  const candidature = lireCandidature(storage);
  const texte = [
    deck ? deck.slides.map((s) => s.texte).join("\n") : "",
    estRapport(rapport) ? rapport.texte : "",
    candidature ? `${candidature.poste} ${candidature.entreprise ?? ""} ${candidature.offre ?? ""} ${candidature.cvTexte ?? ""}` : "",
  ].join("\n");
  if (texte.trim().length < 40) return "";

  const emp = empreinte(texte);
  const connu = lireCache<{ emp: string; ligne: string }>(storage, CLE_LEXIQUE);
  if (connu && connu.emp === emp) return connu.ligne;

  const ligne = formaterLexique(extraireLexique(texte));
  ecrireCache(storage, CLE_LEXIQUE, { emp, ligne });
  return ligne;
}
