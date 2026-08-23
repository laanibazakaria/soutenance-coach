/**
 * Quotas d'appels IA — la partie pure. Un palier gratuit partagé (Gemini)
 * ne survit pas à un seul utilisateur enthousiaste : chaque compte, et
 * chaque adresse sans compte, a un nombre d'appels par mois civil.
 */

export type TypeQuota = "anonyme" | "compte";

/** Limites par mois civil. Surchargeables par QUOTA_ANONYME / QUOTA_COMPTE. */
export const LIMITES_PAR_DEFAUT: Record<TypeQuota, number> = { anonyme: 20, compte: 80 };

export function limitePour(type: TypeQuota, env: Record<string, string | undefined> = {}): number {
  const brut = type === "anonyme" ? env.QUOTA_ANONYME : env.QUOTA_COMPTE;
  const n = Number(brut);
  return Number.isFinite(n) && n >= 0 && brut !== undefined && brut !== "" ? Math.floor(n) : LIMITES_PAR_DEFAUT[type];
}

/** Le mois civil, YYYY-MM, en UTC — le même pour tous les serveurs. */
export function moisCourant(maintenant: Date = new Date()): string {
  return `${maintenant.getUTCFullYear()}-${String(maintenant.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Premier jour du mois suivant, YYYY-MM-DD — la date de réinitialisation. */
export function prochaineReinitialisation(maintenant: Date = new Date()): string {
  const d = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth() + 1, 1));
  return d.toISOString().slice(0, 10);
}

export interface EtatQuota {
  type: TypeQuota;
  appels: number;
  limite: number;
  reste: number;
  mois: string;
  reinitialisation: string;
}

export function etatQuota(type: TypeQuota, appels: number, limite: number, maintenant: Date = new Date()): EtatQuota {
  return { type, appels, limite, reste: Math.max(0, limite - appels), mois: moisCourant(maintenant), reinitialisation: prochaineReinitialisation(maintenant) };
}

/** Empreinte stable d'une adresse IP : on ne stocke jamais l'adresse elle-même. */
export function empreinteIp(ip: string, sel: string): string {
  let h = 5381;
  const s = `${sel}|${ip}`;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  let h2 = 52711;
  for (let i = s.length - 1; i >= 0; i--) h2 = ((h2 << 5) + h2 + s.charCodeAt(i)) | 0;
  return `${(h >>> 0).toString(36)}${(h2 >>> 0).toString(36)}`;
}

/** Message montré à l'utilisateur quand la limite est atteinte. */
export function messageQuota(e: EtatQuota): string {
  const quand = new Date(e.reinitialisation + "T00:00:00Z").toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
  return e.type === "anonyme"
    ? `Tu as utilisé les ${e.limite} appels IA gratuits de ce mois sans compte. Connecte-toi pour en avoir ${LIMITES_PAR_DEFAUT.compte} par mois — ou reviens le ${quand}. Tout le reste (mesures, fiches déjà générées, guides) fonctionne.`
    : `Tu as utilisé tes ${e.limite} appels IA de ce mois. Ils se renouvellent le ${quand}. Tout le reste fonctionne, et une offre Pro arrive.`;
}
