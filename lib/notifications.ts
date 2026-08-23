import type { ResumeModule } from "./preferences";
import type { EtatQuota } from "./quota";

/**
 * Les notifications de la cloche : tout est calculé sur l'appareil à partir de
 * ce qu'on sait déjà (échéances, question du jour, quota). Aucune requête, et
 * des identifiants stables par jour pour se souvenir de ce qui a été vu.
 */
export interface Notification {
  id: string;
  niveau: "attention" | "info" | "succes";
  titre: string;
  detail: string;
  lien: string;
}

export function construireNotifications(args: { resumes: ResumeModule[]; quota: EtatQuota | null; qdjFaite: boolean; aujourdhui: string }): Notification[] {
  const { resumes, quota, qdjFaite, aujourdhui } = args;
  const liste: Notification[] = [];

  for (const r of resumes) {
    if (r.jours === null) continue;
    if (r.jours === 0) {
      liste.push({ id: `jour-j:${r.id}:${aujourdhui}`, niveau: "attention", titre: `C'est aujourd'hui : ${r.nom.toLowerCase()}`, detail: "Respire. Tu as préparé — va relire ta routine du jour J.", lien: r.hub });
    } else if (r.jours > 0 && r.jours <= 14) {
      liste.push({
        id: `echeance:${r.id}:${aujourdhui}`,
        niveau: r.jours <= 3 ? "attention" : "info",
        titre: `J-${r.jours} · ${r.nom}`,
        detail: r.pourcent !== null ? `Prêt à ${r.pourcent} % — à faire : ${r.prochaineAction.titre}` : r.prochaineAction.titre,
        lien: r.prochaineAction.lien,
      });
    } else if (r.jours < 0 && r.jours >= -7) {
      liste.push({ id: `retour:${r.id}`, niveau: "succes", titre: "Comment s'est passé ton oral ?", detail: `${r.nom} : deux minutes pour raconter les vraies questions — ça aide tous les suivants.`, lien: r.hub });
    }
  }

  if (!qdjFaite) {
    liste.push({ id: `qdj:${aujourdhui}`, niveau: "info", titre: "La question du jour t'attend", detail: "Une question de ton jury, une minute au micro.", lien: "/app/question-du-jour" });
  }

  if (quota && quota.limite > 0) {
    const ratio = quota.appels / quota.limite;
    if (ratio >= 1) {
      liste.push({ id: `quota-plein:${quota.mois}`, niveau: "attention", titre: "Quota IA du mois atteint", detail: `${quota.appels}/${quota.limite} appels. Les mesures et la répétition restent illimitées.`, lien: "/app/forfaits" });
    } else if (ratio >= 0.75) {
      liste.push({ id: `quota-haut:${quota.mois}`, niveau: "info", titre: "Quota IA bientôt atteint", detail: `${quota.appels}/${quota.limite} appels ce mois.`, lien: "/app/forfaits" });
    }
  }

  const poids = { attention: 0, info: 1, succes: 2 } as const;
  const jours = (n: Notification) => (n.id.startsWith("jour-j:") ? -1 : Number(n.titre.match(/^J-(\d+)/)?.[1] ?? 999));
  return liste.sort((a, b) => poids[a.niveau] - poids[b.niveau] || jours(a) - jours(b));
}

const CLE_VUES = "sc.notifs.vues.v1";

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function lireVues(storage: StorageLike): Set<string> {
  try {
    const brut = storage.getItem(CLE_VUES);
    const liste = brut ? (JSON.parse(brut) as unknown) : [];
    return new Set(Array.isArray(liste) ? liste.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

/** Marque ces notifications comme vues ; ne garde que les 60 derniers identifiants. */
export function marquerVues(storage: StorageLike, ids: string[]): Set<string> {
  const vues = lireVues(storage);
  for (const id of ids) vues.add(id);
  const liste = [...vues].slice(-60);
  storage.setItem(CLE_VUES, JSON.stringify(liste));
  return new Set(liste);
}

export function nonVues(liste: Notification[], vues: Set<string>): number {
  return liste.filter((n) => !vues.has(n.id)).length;
}
