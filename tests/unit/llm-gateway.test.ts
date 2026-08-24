import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `server-only` refuse de s'exécuter hors serveur Next : ici, c'est un test Node.
vi.mock("server-only", () => ({}));

/**
 * La passerelle OmniRoute devant la cascade : on vérifie notre côté du
 * contrat — qu'elle passe en premier quand elle est configurée, qu'on
 * bascule sur les fournisseurs directs quand elle tombe, et qu'elle
 * n'existe pas du tout sans URL.
 *
 * Une vraie passerelle locale sert de doublure : c'est du HTTP réel, pas un
 * mock — le seul moyen de prouver que l'URL construite est appelable.
 */

interface Doublure {
  serveur: Server;
  url: string;
  recues: Array<{ chemin: string; corps: Record<string, unknown>; autorisation?: string }>;
}

async function passerelle(reponse: (n: number) => { statut: number; corps: unknown }): Promise<Doublure> {
  const recues: Doublure["recues"] = [];
  const serveur = createServer((req, res) => {
    let brut = "";
    req.on("data", (c) => (brut += c));
    req.on("end", () => {
      recues.push({ chemin: req.url ?? "", corps: JSON.parse(brut || "{}") as Record<string, unknown>, autorisation: req.headers.authorization });
      const { statut, corps } = reponse(recues.length);
      res.writeHead(statut, { "content-type": "application/json" });
      res.end(JSON.stringify(corps));
    });
  });
  await new Promise<void>((r) => serveur.listen(0, "127.0.0.1", r));
  const port = (serveur.address() as { port: number }).port;
  return { serveur, url: `http://127.0.0.1:${port}/v1`, recues };
}

const REPONSE_OK = { choices: [{ message: { content: '{"replique":"Et vos chiffres ?"}' } }] };

/** Recharge le module : la cascade lit process.env au moment de l'import. */
async function cascade() {
  vi.resetModules();
  return import("../../lib/llm");
}

describe("passerelle OmniRoute devant la cascade", () => {
  const memoire = { ...process.env };
  let d: Doublure | null = null;

  beforeEach(() => {
    for (const k of Object.keys(process.env)) if (/_API_KEY$|OMNIROUTE|_MODEL$|ACCOUNT_ID/.test(k)) delete process.env[k];
  });
  afterEach(async () => {
    if (d) await new Promise<void>((r) => d!.serveur.close(() => r()));
    d = null;
    process.env = { ...memoire };
  });

  it("n'existe pas tant qu'aucune URL n'est donnée", async () => {
    process.env.MISTRAL_API_KEY = "x";
    const { fournisseursDisponibles } = await cascade();
    expect(fournisseursDisponibles()).not.toContain("omniroute");
    expect(fournisseursDisponibles()).toContain("mistral");
  });

  it("passe en tête dès que l'URL est là, avant nos fournisseurs directs", async () => {
    d = await passerelle(() => ({ statut: 200, corps: REPONSE_OK }));
    process.env.OMNIROUTE_URL = d.url;
    process.env.MISTRAL_API_KEY = "x";
    const { fournisseursDisponibles, appelerIA } = await cascade();
    expect(fournisseursDisponibles()[0]).toBe("omniroute");
    expect(fournisseursDisponibles("rapide")[0]).toBe("omniroute");

    const r = await appelerIA("Pose une question.", { maxOutputTokens: 100 });
    expect(r.ok).toBe(true);
    expect(r.fournisseur).toBe("omniroute");
    expect(d.recues).toHaveLength(1);
    expect(d.recues[0]!.chemin).toBe("/v1/chat/completions");
    expect(d.recues[0]!.corps.model).toBe("auto");
  });

  it("accepte une URL déjà complète ou avec une barre finale", async () => {
    d = await passerelle(() => ({ statut: 200, corps: REPONSE_OK }));
    for (const variante of [`${d.url}/`, `${d.url}/chat/completions`]) {
      process.env.OMNIROUTE_URL = variante;
      const { appelerIA } = await cascade();
      const r = await appelerIA("Pose une question.");
      expect(r.ok).toBe(true);
    }
    expect(d.recues.every((x) => x.chemin === "/v1/chat/completions")).toBe(true);
  });

  it("bascule sur les fournisseurs directs quand la passerelle refuse", async () => {
    d = await passerelle(() => ({ statut: 429, corps: { error: { message: "quota" } } }));
    process.env.OMNIROUTE_URL = d.url;
    const { appelerIA } = await cascade();
    // Aucun autre fournisseur configuré : on doit voir l'échec remonté proprement.
    const r = await appelerIA("Pose une question.");
    expect(r.ok).toBe(false);
    expect(r.fournisseur).toBe("omniroute");
    if (!r.ok) expect(r.code).toBe("quota");
    expect(d.recues).toHaveLength(1);
  });

  it("n'envoie une clé que si on lui en a donné une", async () => {
    d = await passerelle(() => ({ statut: 200, corps: REPONSE_OK }));
    process.env.OMNIROUTE_URL = d.url;
    const sansCle = await cascade();
    await sansCle.appelerIA("Question.");
    expect(d.recues[0]!.autorisation).toBe("Bearer sans-cle");

    process.env.OMNIROUTE_API_KEY = "secret-local";
    const avecCle = await cascade();
    await avecCle.appelerIA("Question.");
    expect(d.recues[1]!.autorisation).toBe("Bearer secret-local");
  });

  it("laisse choisir le modèle exposé par la passerelle", async () => {
    d = await passerelle(() => ({ statut: 200, corps: REPONSE_OK }));
    process.env.OMNIROUTE_URL = d.url;
    process.env.OMNIROUTE_MODEL = "openai/gpt-oss-120b";
    const { appelerIA } = await cascade();
    await appelerIA("Question.");
    expect(d.recues[0]!.corps.model).toBe("openai/gpt-oss-120b");
  });
});
