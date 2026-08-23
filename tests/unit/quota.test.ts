import { describe, it, expect } from "vitest";
import { limitePour, moisCourant, prochaineReinitialisation, etatQuota, empreinteIp, messageQuota, LIMITES_PAR_DEFAUT } from "../../lib/quota";

describe("quotas", () => {
  it("limites par défaut, surchargeables par l'environnement, robustes aux valeurs absurdes", () => {
    expect(limitePour("anonyme")).toBe(LIMITES_PAR_DEFAUT.anonyme);
    expect(limitePour("compte", { QUOTA_COMPTE: "150" })).toBe(150);
    expect(limitePour("compte", { QUOTA_COMPTE: "abc" })).toBe(LIMITES_PAR_DEFAUT.compte);
    expect(limitePour("anonyme", { QUOTA_ANONYME: "-3" })).toBe(LIMITES_PAR_DEFAUT.anonyme);
    expect(limitePour("anonyme", { QUOTA_ANONYME: "0" })).toBe(0);
  });

  it("mois civil en UTC et réinitialisation au premier du mois suivant", () => {
    const d = new Date("2026-08-31T23:30:00Z");
    expect(moisCourant(d)).toBe("2026-08");
    expect(prochaineReinitialisation(d)).toBe("2026-09-01");
    expect(prochaineReinitialisation(new Date("2026-12-15T00:00:00Z"))).toBe("2027-01-01");
  });

  it("état : reste jamais négatif", () => {
    const e = etatQuota("compte", 95, 80, new Date("2026-08-23T00:00:00Z"));
    expect(e.reste).toBe(0);
    expect(e.mois).toBe("2026-08");
    expect(etatQuota("anonyme", 3, 20).reste).toBe(17);
  });

  it("empreinte IP stable, dépendante du sel, sans l'adresse en clair", () => {
    const a = empreinteIp("41.140.1.2", "sel");
    expect(a).toBe(empreinteIp("41.140.1.2", "sel"));
    expect(a).not.toBe(empreinteIp("41.140.1.2", "autre"));
    expect(a).not.toContain("41.140");
  });

  it("messages : invitation à se connecter sans compte, date de renouvellement avec compte", () => {
    const sans = messageQuota(etatQuota("anonyme", 20, 20, new Date("2026-08-23T00:00:00Z")));
    expect(sans).toContain("Connecte-toi");
    expect(sans).toContain("1 septembre");
    const avec = messageQuota(etatQuota("compte", 80, 80, new Date("2026-08-23T00:00:00Z")));
    expect(avec).toContain("80 appels");
    expect(avec).toContain("offre Pro");
  });
});
