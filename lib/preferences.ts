/**
 * Les préférences : quels oraux l'étudiant prépare. Elles décident de ce que
 * la navigation montre — un étudiant en PFA ne voit pas « Oral de concours ».
 * Stockées dans le cache IA synchronisé (clé `preferences:modules`) : même
 * mécanique que les résultats IA, sans table supplémentaire.
 */

import type { StorageLike, SessionRecord } from "./types";
import { lireCache, ecrireCache } from "./ia-cache";
import { lireParcours, detecterContexte, type StorageEnumerable } from "./parcours/persistance";
import { construirePlan, dateDuJour, joursEntre, LIBELLES } from "./parcours";
import { lireCandidature, cleQuestionsEntretien } from "./entretien/persistance";
import { etapesEntretien } from "./entretien";
import { lireProfil, cleQuestionsModule } from "./modules/persistance";
import { MODULES, etapesModule, type ModuleId } from "./modules";

export type ModuleActif = "soutenance" | "entretien" | ModuleId;

export const TOUS_LES_MODULES: ReadonlyArray<{ id: ModuleActif; nom: string; emoji: string; description: string; hub: string }> = [
  { id: "soutenance", nom: "Soutenance", emoji: "🎓", description: "PFA, PFE, mémoire, thèse — devant un jury académique.", hub: "/app/soutenance" },
  { id: "entretien", nom: "Entretien d'embauche", emoji: "💼", description: "Stage, alternance, premier emploi — RH et technique.", hub: "/app/entretien" },
  { id: "pitch", nom: "Pitch de projet", emoji: "🚀", description: "Concours d'innovation, startup, hackathon — jury d'innovation.", hub: "/app/m/pitch" },
  { id: "concours", nom: "Oral de concours", emoji: "🏛️", description: "Admission en école ou master, bourse — jury d'admission.", hub: "/app/m/concours" },
];

const CLE = "preferences:modules";
const IDS = new Set<string>(TOUS_LES_MODULES.map((m) => m.id));

/** Les modules choisis, ou null si l'étudiant n'a pas encore choisi. */
export function lireModulesActifs(storage: StorageLike): ModuleActif[] | null {
  const v = lireCache<unknown>(storage, CLE);
  if (!Array.isArray(v)) return null;
  const actifs = v.filter((x): x is ModuleActif => typeof x === "string" && IDS.has(x));
  return actifs.length > 0 ? actifs : null;
}

export function sauverModulesActifs(storage: StorageLike, actifs: ModuleActif[]): void {
  ecrireCache(storage, CLE, actifs.filter((a) => IDS.has(a)));
}

/** Ce que l'accueil montre pour un module : où on en est, et quoi faire maintenant. */
export interface ResumeModule {
  id: ModuleActif;
  nom: string;
  emoji: string;
  hub: string;
  /** Jours restants avant la date, ou null si aucune date. */
  jours: number | null;
  /** Progression 0..100, ou null si le module n'est pas commencé. */
  pourcent: number | null;
  /** Libellé court de l'échéance (« PFE · 15 min », « Ingénieur IA · Propulsez »). */
  sousTitre: string;
  prochaineAction: { titre: string; lien: string };
}

export function resumerModules(storage: StorageEnumerable, sessions: SessionRecord[], actifs: ModuleActif[], aujourdhui: string = dateDuJour()): ResumeModule[] {
  return actifs.map((id): ResumeModule => {
    const base = TOUS_LES_MODULES.find((m) => m.id === id)!;
    if (id === "soutenance") {
      const p = lireParcours(storage);
      if (!p) return { ...base, jours: null, pourcent: null, sousTitre: "Pas encore de date", prochaineAction: { titre: "Donne ta date de soutenance", lien: "/app/soutenance" } };
      const plan = construirePlan(p, detecterContexte(storage, sessions), aujourdhui);
      const suivante = plan.aFaire[0] ?? plan.prochaine;
      return {
        ...base,
        jours: plan.joursRestants,
        pourcent: plan.progression.pourcent,
        sousTitre: `${LIBELLES[p.type]} · ${p.dureeMin} min`,
        prochaineAction: suivante ? { titre: suivante.titre, lien: suivante.lien } : { titre: "Tout est fait — respire", lien: "/app/soutenance" },
      };
    }
    if (id === "entretien") {
      const c = lireCandidature(storage);
      if (!c) return { ...base, jours: null, pourcent: null, sousTitre: "Pas encore de profil", prochaineAction: { titre: "Renseigne le poste, l'offre et ton CV", lien: "/app/entretien" } };
      const etapes = etapesEntretien({ candidature: c, sessions, questionsGenerees: lireCache(storage, cleQuestionsEntretien(c)) !== null });
      const suivante = etapes.find((e) => !e.faite);
      return {
        ...base,
        jours: c.dateEntretien ? joursEntre(aujourdhui, c.dateEntretien) : null,
        pourcent: Math.round((etapes.filter((e) => e.faite).length / etapes.length) * 100),
        sousTitre: [c.poste, c.entreprise].filter(Boolean).join(" · ") || "Entretien",
        prochaineAction: suivante ? { titre: suivante.titre, lien: suivante.lien } : { titre: "Tout est fait — respire", lien: "/app/entretien" },
      };
    }
    const m = MODULES[id];
    const p = lireProfil(storage, id);
    if (!p) return { ...base, jours: null, pourcent: null, sousTitre: "Pas encore de profil", prochaineAction: { titre: "Décris ton projet et dépose ton dossier", lien: `/app/m/${id}` } };
    const etapes = etapesModule(m, { profil: p, sessions, questionsGenerees: lireCache(storage, cleQuestionsModule(p)) !== null });
    const suivante = etapes.find((e) => !e.faite);
    const titre = m.champs.filter((c) => c.type === "text").map((c) => p.champs[c.id]).filter(Boolean).join(" · ");
    return {
      ...base,
      jours: p.date ? joursEntre(aujourdhui, p.date) : null,
      pourcent: Math.round((etapes.filter((e) => e.faite).length / etapes.length) * 100),
      sousTitre: titre || m.nom,
      prochaineAction: suivante ? { titre: suivante.titre, lien: suivante.href } : { titre: "Tout est fait — respire", lien: `/app/m/${id}` },
    };
  });
}
