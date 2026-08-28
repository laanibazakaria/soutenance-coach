import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Le seul garde-fou de la contrainte « N appels IA par mois » — et il n'avait
 * aucun test, alors que 55 lignes le séparent d'un quota illimité. L'audit
 * l'avait classé bombe silencieuse : sans DATABASE_URL, tout s'ouvrait sans
 * une ligne de log. Ces tests figent les trois comportements qui comptent.
 */

const etatMock = { session: null as { user?: { id?: string; email?: string } } | null, base: true };
const usage = { findUnique: vi.fn(), upsert: vi.fn() };

vi.mock("server-only", () => ({}));
vi.mock("@/auth", () => ({ auth: () => Promise.resolve(etatMock.session) }));
vi.mock("@/lib/prisma", () => ({
  prisma: { usage },
  baseConfiguree: () => etatMock.base,
}));

const requete = () => new Request("http://test", { headers: { "x-forwarded-for": "203.0.113.7" } });

const { verifierQuota } = await import("@/lib/quota-serveur");

describe("le garde-fou du quota", () => {
  beforeEach(() => {
    etatMock.session = null;
    etatMock.base = true;
    usage.findUnique.mockReset();
    usage.upsert.mockReset();
  });

  it("refuse à la limite, avec le message qui dit quand ça revient", async () => {
    usage.findUnique.mockResolvedValue({ appels: 20 });
    const r = await verifierQuota(requete());
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reponse.status).toBe(429);
      const corps = (await r.reponse.json()) as { code: string; erreur: string };
      expect(corps.code).toBe("quota");
      expect(corps.erreur).toContain("Connecte-toi");
    }
  });

  it("ne consomme rien tant que confirmer() n'est pas appelé", async () => {
    // C'est le contrat : un fournisseur qui échoue ne coûte rien à l'étudiant.
    usage.findUnique.mockResolvedValue({ appels: 3 });
    const r = await verifierQuota(requete());
    expect(r.ok).toBe(true);
    expect(usage.upsert).not.toHaveBeenCalled();
    if (r.ok) await r.confirmer();
    expect(usage.upsert).toHaveBeenCalledTimes(1);
    const args = usage.upsert.mock.calls[0]![0] as { update: unknown };
    expect(args.update).toEqual({ appels: { increment: 1 } });
  });

  it("sans base : ouvre, mais en le criant dans les logs", async () => {
    // Voulu pour un déploiement local — jamais en silence : une DATABASE_URL
    // perdue en production ouvrirait toutes les routes IA sans une trace.
    etatMock.base = false;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = await verifierQuota(requete());
    expect(r.ok).toBe(true);
    expect(usage.findUnique).not.toHaveBeenCalled();
    expect(warn.mock.calls.flat().join(" ")).toContain("DÉSACTIVÉS");
    warn.mockRestore();
  });

  it("distingue le compte de l'anonyme par sa limite", async () => {
    usage.findUnique.mockResolvedValue({ appels: 30 });
    // 30 appels : au-dessus de la limite anonyme (20), sous celle d'un compte (80).
    const anonyme = await verifierQuota(requete());
    expect(anonyme.ok).toBe(false);
    etatMock.session = { user: { id: "u1", email: "e@x.fr" } };
    const compte = await verifierQuota(requete());
    expect(compte.ok).toBe(true);
  });
});
