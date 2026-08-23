/**
 * L'IA côté serveur, en cascade : plusieurs fournisseurs gratuits, un seul
 * point d'entrée. Chaque appel choisit l'ordre selon le besoin (qualité en
 * français, ou vitesse pour le temps réel) et bascule au suivant quand un
 * quota est atteint ou qu'un service tombe. Les clés ne quittent jamais ce
 * fichier ; aucune n'est obligatoire — on utilise ce qui est configuré.
 */

import "server-only";
import { appelerGemini, cleConfiguree as geminiConfigure, type ResultatGemini } from "./gemini";

export type ResultatIA = ResultatGemini & { fournisseur?: string };

export type Message = { role: "system" | "user" | "assistant"; content: string };

export interface OptionsIA {
  maxOutputTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  /** `qualite` (défaut) : le meilleur en français d'abord. `rapide` : la latence d'abord (jury en direct). */
  priorite?: "qualite" | "rapide";
  /** Réponse JSON attendue (défaut : oui — tous nos prompts parlent JSON). */
  json?: boolean;
  /** Pour un dialogue : l'historique complet. Sinon `prompt` suffit. */
  messages?: Message[];
}

interface Fournisseur {
  nom: string;
  url: string;
  cle: () => string | undefined;
  modele: () => string;
}

const FOURNISSEURS: Record<string, Fournisseur> = {
  mistral: {
    nom: "mistral",
    url: "https://api.mistral.ai/v1/chat/completions",
    cle: () => process.env.MISTRAL_API_KEY,
    modele: () => process.env.MISTRAL_MODEL ?? "mistral-medium-latest",
  },
  groq: {
    nom: "groq",
    url: "https://api.groq.com/openai/v1/chat/completions",
    cle: () => process.env.GROQ_API_KEY,
    modele: () => process.env.GROQ_MODEL ?? "openai/gpt-oss-120b",
  },
};

const ORDRES: Record<NonNullable<OptionsIA["priorite"]>, string[]> = {
  qualite: ["mistral", "groq", "gemini"],
  rapide: ["groq", "mistral", "gemini"],
};

/** Les fournisseurs dont la clé est présente, dans l'ordre d'essai. */
export function fournisseursDisponibles(priorite: OptionsIA["priorite"] = "qualite"): string[] {
  return ORDRES[priorite].filter((n) => (n === "gemini" ? geminiConfigure() : Boolean(FOURNISSEURS[n]?.cle())));
}

export function iaConfiguree(): boolean {
  return fournisseursDisponibles().length > 0;
}

const MESSAGES: Record<number, [code: string, message: string]> = {
  429: ["quota", "Le quota gratuit de l'IA est atteint pour le moment. Réessaie dans quelques minutes."],
  503: ["surcharge", "L'IA est très demandée en ce moment. Réessaie dans un instant."],
  401: ["cle_invalide", "La clé d'un fournisseur IA est refusée."],
  402: ["paiement", "Ce fournisseur IA demande un paiement."],
  403: ["cle_invalide", "La clé d'un fournisseur IA est refusée."],
};

/** On passe au fournisseur suivant sur quota, panne ou réseau — pas sur une requête mal formée. */
function basculable(r: ResultatIA): boolean {
  return !r.ok && (r.status === 429 || r.status === 402 || r.status >= 500 || r.code === "vide" || r.code === "cle_invalide" || r.code === "modele");
}

/**
 * Appelle l'IA. `prompt` seul pour une génération ; `messages` pour un
 * dialogue (le `prompt` devient alors le message système).
 */
export async function appelerIA(prompt: string, options: OptionsIA = {}): Promise<ResultatIA> {
  const ordre = fournisseursDisponibles(options.priorite ?? "qualite");
  if (ordre.length === 0) {
    return { ok: false, status: 503, code: "cle_absente", erreur: "L'IA n'est pas configurée sur ce déploiement." };
  }
  let dernier: ResultatIA | null = null;
  for (const nom of ordre) {
    const r = nom === "gemini" ? await viaGemini(prompt, options) : await viaOpenAICompatible(FOURNISSEURS[nom]!, prompt, options);
    if (r.ok) return { ...r, fournisseur: nom };
    dernier = { ...r, fournisseur: nom };
    if (!basculable(r)) return dernier;
    console.warn(`[ia] ${nom} → ${r.status} ${r.code}, bascule`);
  }
  return dernier ?? { ok: false, status: 503, code: "amont", erreur: "Aucun fournisseur IA n'a répondu." };
}

async function viaGemini(prompt: string, options: OptionsIA): Promise<ResultatIA> {
  const texte = options.messages ? [prompt, ...options.messages.map((m) => `${m.role === "assistant" ? "JURY" : m.role === "user" ? "CANDIDAT" : "CONSIGNE"} : ${m.content}`)].join("\n\n") : prompt;
  return appelerGemini(texte, { maxOutputTokens: options.maxOutputTokens, temperature: options.temperature, timeoutMs: options.timeoutMs });
}

async function viaOpenAICompatible(f: Fournisseur, prompt: string, options: OptionsIA): Promise<ResultatIA> {
  const cle = f.cle();
  if (!cle) return { ok: false, status: 503, code: "cle_absente", erreur: "Fournisseur non configuré." };
  const messages: Message[] = options.messages ? [{ role: "system", content: prompt }, ...options.messages] : [{ role: "user", content: prompt }];
  const json = options.json ?? true;
  try {
    const reponse = await fetch(f.url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${cle}` },
      body: JSON.stringify({
        model: f.modele(),
        messages,
        temperature: options.temperature ?? 0.5,
        max_tokens: options.maxOutputTokens ?? 4000,
        ...(json ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: AbortSignal.timeout(options.timeoutMs ?? 45_000),
    });
    if (!reponse.ok) {
      const [code, message] = MESSAGES[reponse.status] ?? (reponse.status === 404 || reponse.status === 400 ? ["modele", "Le modèle configuré n'est pas accepté par ce fournisseur."] : ["amont", "Le service IA n'a pas répondu correctement."]);
      return { ok: false, status: reponse.status, code, erreur: message };
    }
    const data = (await reponse.json()) as { choices?: Array<{ message?: { content?: string | Array<{ text?: string }> }; finish_reason?: string }> };
    const choix = data.choices?.[0];
    const brut = choix?.message?.content;
    const texte = typeof brut === "string" ? brut : Array.isArray(brut) ? brut.map((p) => p.text ?? "").join("") : "";
    if (texte.trim() === "") {
      return { ok: false, status: 502, code: choix?.finish_reason === "length" ? "tronque" : "vide", erreur: "Le modèle a renvoyé une réponse vide. Réessaie." };
    }
    return { ok: true, texte };
  } catch {
    return { ok: false, status: 504, code: "reseau", erreur: "L'IA a pris trop de temps ou est injoignable. Réessaie." };
  }
}
