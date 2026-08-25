/**
 * Le fil conducteur : quatre étapes, une seule chose à faire à la fois.
 *
 * La plateforme avait toutes les pièces — le dépôt, la relecture, le pitch,
 * l'appel, la progression — mais dispersées sur six écrans, sans ordre. Un
 * étudiant qui arrivait ne savait pas par où commencer. Ici, on lit l'état
 * réel de l'appareil et on lui dit : tu en es là, voilà la prochaine chose.
 *
 * Aucune donnée nouvelle : chaque étape se détecte dans ce que les
 * fonctionnalités existantes écrivent déjà.
 */

import type { StorageLike } from "./types";
import { listeDeckSauvegarde } from "./slides/persistance";
import { lireCache } from "./ia-cache";
import { estRapport } from "./rapport";

export type EtatEtape = "faite" | "a-faire" | "verrouillee";

export interface Etape {
  numero: 1 | 2 | 3 | 4;
  titre: string;
  /** Ce qu'on y fait, en une phrase — ou ce qui y a déjà été fait. */
  detail: string;
  etat: EtatEtape;
  /** Où cliquer. Absent quand l'étape est verrouillée. */
  lien: string | null;
  /** Le libellé du bouton, à l'impératif. */
  action: string | null;
}

export interface ParcoursSimple {
  etapes: Etape[];
  /** La première étape non faite : celle qu'on met en avant. */
  courante: 1 | 2 | 3 | 4;
}

const CLE_RAPPORT = "rapport:texte";

/** Compte les entrées d'un préfixe de cache — l'empreinte varie, pas l'usage. */
function compteSous(storage: StorageLike, usage: string): number {
  const prefixe = `sc.ia.v1:${usage}:`;
  const st = storage as unknown as { length?: number; key?: (i: number) => string | null };
  if (typeof st.length !== "number" || typeof st.key !== "function") return 0;
  let n = 0;
  for (let i = 0; i < st.length; i++) {
    const k = st.key(i);
    if (k && k.startsWith(prefixe)) n++;
  }
  return n;
}

/** Lit où en est l'étudiant, depuis ce que l'appareil sait déjà. */
export function lireParcoursSimple(storage: StorageLike): ParcoursSimple {
  const deck = listeDeckSauvegarde(storage);
  const rapport = estRapport(lireCache<unknown>(storage, CLE_RAPPORT));
  const documentsPrets = deck !== null && rapport;

  const relectures = compteSous(storage, "relecture");
  const appels = compteSous(storage, "appel");

  const etape1: Etape = {
    numero: 1,
    titre: "Dépose tes documents",
    detail: documentsPrets
      ? "Présentation et rapport déposés — le jury a de quoi lire."
      : deck
        ? "Ta présentation est là. Il manque ton rapport (PDF)."
        : rapport
          ? "Ton rapport est là. Il manque ta présentation (PDF ou PowerPoint)."
          : "Ton rapport et ta présentation. Tout est lu sur ton appareil.",
    etat: documentsPrets ? "faite" : "a-faire",
    lien: "/app/documents",
    action: documentsPrets ? "Revoir mes documents" : "Déposer",
  };

  const etape2: Etape = {
    numero: 2,
    titre: "Fais-les relire",
    detail: !documentsPrets
      ? "La plateforme lit tout : ce qu'elle a compris, ce qui ne concorde pas, les mots à dire sur chaque diapositive."
      : relectures > 0
        ? "Relecture faite : le rapporteur a confronté tes deux documents."
        : "La plateforme lit tout : ce qu'elle a compris, ce qui ne concorde pas, les mots à dire sur chaque diapositive.",
    etat: !documentsPrets ? "verrouillee" : relectures > 0 ? "faite" : "a-faire",
    lien: documentsPrets ? "/app/documents" : null,
    action: !documentsPrets ? null : relectures > 0 ? "Relire l'analyse" : "Faire relire mon dossier",
  };

  const etape3: Etape = {
    numero: 3,
    titre: "Entraîne-toi avec le jury",
    detail: !documentsPrets
      ? "Trois membres du jury t'appellent et t'interrogent sur TON dossier — autant de fois que tu veux."
      : appels > 0
        ? `${appels} appel${appels > 1 ? "s" : ""} déjà passé${appels > 1 ? "s" : ""}. Chaque appel change de questions.`
        : "Trois membres du jury t'appellent et t'interrogent sur TON dossier. Ils rebondissent sur tes réponses.",
    etat: !documentsPrets ? "verrouillee" : appels > 0 ? "faite" : "a-faire",
    lien: documentsPrets ? "/app/appel?mode=soutenance" : null,
    action: !documentsPrets ? null : appels > 0 ? "Refaire un appel" : "Passer mon premier appel",
  };

  const etape4: Etape = {
    numero: 4,
    titre: "Regarde ta progression",
    detail:
      appels >= 2
        ? "D'un appel à l'autre : ce qui monte, ce qui stagne, ce qu'il faut travailler autrement."
        : "À partir de deux appels : ce qui monte, ce qui stagne, ce qu'il faut travailler autrement.",
    etat: appels >= 2 ? "a-faire" : "verrouillee",
    lien: appels >= 2 ? "/app/bilan" : null,
    action: appels >= 2 ? "Voir mon bilan" : null,
  };

  const etapes = [etape1, etape2, etape3, etape4];
  const premiere = etapes.find((e) => e.etat === "a-faire");
  return { etapes, courante: (premiere?.numero ?? 4) as 1 | 2 | 3 | 4 };
}
