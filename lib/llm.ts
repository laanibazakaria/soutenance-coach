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
  /** Quand l'URL dépend d'une variable (Cloudflare : l'identifiant de compte). */
  urlDynamique?: () => string;
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
  nvidia: {
    nom: "nvidia",
    url: "https://integrate.api.nvidia.com/v1/chat/completions",
    cle: () => process.env.NVIDIA_API_KEY,
    modele: () => process.env.NVIDIA_MODEL ?? "meta/llama-3.3-70b-instruct",
  },
  openrouter: {
    nom: "openrouter",
    url: "https://openrouter.ai/api/v1/chat/completions",
    cle: () => process.env.OPENROUTER_API_KEY,
    modele: () => process.env.OPENROUTER_MODEL ?? "meta-llama/llama-3.3-70b-instruct:free",
  },
  cerebras: {
    nom: "cerebras",
    url: "https://api.cerebras.ai/v1/chat/completions",
    cle: () => process.env.CEREBRAS_API_KEY,
    modele: () => process.env.CEREBRAS_MODEL ?? "llama3.3-70b",
  },
  zai: {
    nom: "zai",
    url: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    cle: () => process.env.ZAI_API_KEY,
    modele: () => process.env.ZAI_MODEL ?? "glm-4-flash",
  },
  ovh: {
    nom: "ovh",
    url: "https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/chat/completions",
    cle: () => process.env.OVH_API_KEY,
    modele: () => process.env.OVH_MODEL ?? "Meta-Llama-3_3-70B-Instruct",
  },
  huggingface: {
    nom: "huggingface",
    url: "https://router.huggingface.co/v1/chat/completions",
    cle: () => process.env.HF_API_KEY,
    modele: () => process.env.HF_MODEL ?? "meta-llama/Llama-3.1-8B-Instruct",
  },
  kilo: {
    nom: "kilo",
    url: "https://api.kilo.ai/api/gateway/v1/chat/completions",
    cle: () => process.env.KILO_API_KEY,
    modele: () => process.env.KILO_MODEL ?? "nvidia/nemotron-3-super-120b-a12b:free",
  },
  cloudflare: {
    nom: "cloudflare",
    url: "",
    cle: () => process.env.CLOUDFLARE_API_KEY,
    modele: () => process.env.CLOUDFLARE_MODEL ?? "@cf/meta/llama-4-scout-17b-16e-instruct",
    // L'URL porte l'identifiant de compte : elle se construit à l'appel.
    urlDynamique: () => {
      const compte = process.env.CLOUDFLARE_ACCOUNT_ID;
      return compte ? `https://api.cloudflare.com/client/v4/accounts/${compte}/ai/v1/chat/completions` : "";
    },
  },
  cohere: {
    nom: "cohere",
    url: "https://api.cohere.com/compatibility/v1/chat/completions",
    cle: () => process.env.COHERE_API_KEY,
    modele: () => process.env.COHERE_MODEL ?? "command-a-03-2025",
  },
};

const SECOURS = ["nvidia", "cerebras", "openrouter", "cloudflare", "zai", "cohere", "huggingface", "ovh", "kilo"];

/**
 * L'ordre d'essai. Les deux premiers sont ceux qu'on maîtrise (Mistral pour
 * le français, Groq pour la latence) ; Gemini ne voit jamais un document
 * confidentiel en premier ; le reste est du secours, essayé seulement si les
 * précédents tombent.
 */
const ORDRES: Record<NonNullable<OptionsIA["priorite"]>, string[]> = {
  qualite: ["mistral", "groq", "gemini", ...SECOURS],
  rapide: ["groq", "cerebras", "mistral", "gemini", ...SECOURS.filter((n) => n !== "cerebras")],
};

/** Les fournisseurs dont la clé est présente, dans l'ordre d'essai. */
export function fournisseursDisponibles(priorite: OptionsIA["priorite"] = "qualite"): string[] {
  return ORDRES[priorite].filter((n) => {
    if (n === "gemini") return geminiConfigure();
    const f = FOURNISSEURS[n];
    if (!f?.cle()) return false;
    return f.urlDynamique ? Boolean(f.urlDynamique()) : true;
  });
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
    const reponse = await fetch(f.urlDynamique ? f.urlDynamique() : f.url, {
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

export interface EtatFournisseur {
  nom: string;
  ok: boolean;
  msDelai: number;
  modele: string;
  detail?: string;
}

/**
 * Interroge un fournisseur avec une question minuscule pour savoir s'il
 * répond vraiment — une clé présente ne veut pas dire une clé valide.
 */
export async function testerFournisseur(nom: string): Promise<EtatFournisseur> {
  const debut = Date.now();
  const modele = nom === "gemini" ? (process.env.GEMINI_MODEL ?? "gemini-3.6-flash") : (FOURNISSEURS[nom]?.modele() ?? "?");
  const prompt = 'Réponds exactement ceci, sans rien ajouter : {"ok":true}';
  const r = nom === "gemini" ? await viaGemini(prompt, { maxOutputTokens: 60 }) : FOURNISSEURS[nom] ? await viaOpenAICompatible(FOURNISSEURS[nom], prompt, { maxOutputTokens: 60, timeoutMs: 20_000 }) : { ok: false as const, status: 503, code: "inconnu", erreur: "Fournisseur inconnu." };
  return { nom, ok: r.ok, msDelai: Date.now() - debut, modele, ...(r.ok ? {} : { detail: `${r.status} ${r.code}` }) };
}
