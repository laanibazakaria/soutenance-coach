/**
 * La voix du jury, côté navigateur : la synthèse vocale du système, sans
 * réseau ni compte. On choisit la meilleure voix disponible pour la langue
 * (les voix « naturelles » d'Edge/Chrome d'abord), et on promet la fin de
 * la phrase pour enchaîner sur l'écoute.
 */

export function voixDisponible(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

const PREFEREES_FR = ["Microsoft Vivienne", "Microsoft Denise", "Microsoft Henri", "Microsoft Paul", "Google français", "Thomas", "Amélie", "Audrey"];
const PREFEREES_EN = ["Microsoft Ava", "Microsoft Andrew", "Microsoft Emma", "Google US English", "Samantha", "Daniel"];

function listerVoix(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const v = window.speechSynthesis.getVoices();
    if (v.length > 0) return resolve(v);
    const t = setTimeout(() => resolve(window.speechSynthesis.getVoices()), 1500);
    window.speechSynthesis.onvoiceschanged = () => {
      clearTimeout(t);
      resolve(window.speechSynthesis.getVoices());
    };
  });
}

/** La voix la plus naturelle pour la langue, ou null s'il n'y en a aucune. */
export async function meilleureVoix(langue: "fr" | "en"): Promise<SpeechSynthesisVoice | null> {
  const voix = await listerVoix();
  const prefixe = langue === "en" ? "en" : "fr";
  const candidates = voix.filter((v) => v.lang.toLowerCase().startsWith(prefixe));
  if (candidates.length === 0) return null;
  const preferees = langue === "en" ? PREFEREES_EN : PREFEREES_FR;
  for (const p of preferees) {
    const trouvee = candidates.find((v) => v.name.includes(p));
    if (trouvee) return trouvee;
  }
  return candidates.find((v) => /natural|neural|online/i.test(v.name)) ?? candidates.find((v) => v.lang.toLowerCase() === (langue === "en" ? "en-us" : "fr-fr")) ?? candidates[0]!;
}

let enCours: SpeechSynthesisUtterance | null = null;

/** Dit le texte, et se résout quand c'est fini (ou interrompu). */
/**
 * Chrome sur Android coupe net une énonciation longue après une quinzaine de
 * secondes — une réplique de jury de 400 signes s'arrêtait en plein milieu.
 * Le correctif connu : découper en phrases et les enchaîner ; chaque
 * énonciation courte tient sous la limite.
 */
function decouperEnPhrases(texte: string): string[] {
  const morceaux = texte.match(/[^.!?…]+[.!?…]+["»']?\s*|[^.!?…]+$/g) ?? [texte];
  // Regrouper les phrases très courtes pour garder un débit naturel.
  const phrases: string[] = [];
  for (const m of morceaux) {
    const dernier = phrases[phrases.length - 1];
    if (dernier !== undefined && dernier.length + m.length < 140) phrases[phrases.length - 1] = dernier + m;
    else phrases.push(m);
  }
  return phrases.map((ph) => ph.trim()).filter(Boolean);
}

/**
 * Résout `true` si au moins une phrase a été réellement prononcée. Sur certains
 * Android, speechSynthesis échoue (« synthesis-failed ») sur chaque énonciation
 * alors même que l'appareil annonce des voix françaises — sans ce verdict,
 * l'échec était avalé et le jury restait muet sans recours.
 */
export function parler(texte: string, langue: "fr" | "en", voix: SpeechSynthesisVoice | null, options: { debit?: number; hauteur?: number } = {}): Promise<boolean> {
  return new Promise((resolve) => {
    if (!voixDisponible()) return resolve(false);
    window.speechSynthesis.cancel();
    const phrases = decouperEnPhrases(texte);
    let fini = false;
    let prononce = false;
    const terminer = () => {
      if (fini) return;
      fini = true;
      enCours = null;
      resolve(prononce);
    };
    let index = 0;
    const suivante = () => {
      if (fini) return;
      if (index >= phrases.length) return terminer();
      const u = new SpeechSynthesisUtterance(phrases[index]!);
      index += 1;
      u.lang = langue === "en" ? "en-US" : "fr-FR";
      if (voix) u.voice = voix;
      u.rate = options.debit ?? 1;
      u.pitch = options.hauteur ?? 1;
      u.onend = () => {
        prononce = true;
        suivante();
      };
      u.onerror = suivante;
      enCours = u;
      window.speechSynthesis.speak(u);
    };
    suivante();
    // Filet : certains navigateurs n'émettent jamais onend si la synthèse est coupée.
    const estimeMs = Math.min(60_000, 1500 + texte.length * 70);
    setTimeout(terminer, estimeMs + 3000);
  });
}

export function taire(): void {
  if (voixDisponible()) window.speechSynthesis.cancel();
  enCours = null;
}

export function parleEnCours(): boolean {
  return enCours !== null;
}

/**
 * Une voix du navigateur « excellente » (Edge en ligne, voix neuronales) vaut
 * mieux qu'un aller-retour serveur de 4 s : on ne demande la voix naturelle
 * à l'API que si le navigateur n'a rien de bon.
 */
export function voixNavigateurExcellente(voix: SpeechSynthesisVoice | null): boolean {
  if (!voix) return false;
  return /natural|online|neural/i.test(voix.name) || /^Microsoft (Denise|Henri|Vivienne|Remy|Ava|Andrew|Emma)/.test(voix.name);
}

let contexteAudio: AudioContext | null = null;
let lectureEnCours: { arreter: () => void } | null = null;

/**
 * À appeler DANS le geste utilisateur (le clic qui lance l'appel), avant tout
 * await : les navigateurs mobiles gardent le contexte audio suspendu tant
 * qu'un resume() n'a pas eu lieu pendant un geste. Le nôtre arrivait au tour
 * du jury, trop tard — d'où des voix muettes sur téléphone.
 */
export function deverrouillerAudio(): void {
  try {
    const ctx = obtenirContexte();
    if (ctx.state === "suspended") void ctx.resume();
    // Une frame de silence scelle le déverrouillage sur iOS.
    const tampon = ctx.createBuffer(1, 1, ctx.sampleRate);
    const source = ctx.createBufferSource();
    source.buffer = tampon;
    source.connect(ctx.destination);
    source.start(0);
  } catch {
    // Sans Web Audio, les voix du navigateur prendront le relais.
  }
}

function obtenirContexte(): AudioContext {
  contexteAudio ??= new AudioContext();
  return contexteAudio;
}

/**
 * Joue la réplique avec la voix naturelle de l'API, en STREAMING : les
 * morceaux PCM sont joués au fil de leur arrivée (premier son ~1,7 s).
 * Résout `false` si ça échoue (→ repli sur la voix du navigateur).
 */
export type Timbre = "grave" | "claire" | "vive" | "posee";

export async function parlerNaturel(texte: string, langue: "fr" | "en", voix: Timbre = "grave"): Promise<boolean> {
  let annule = false;
  try {
    const ctx = obtenirContexte();
    if (ctx.state === "suspended") await ctx.resume();
    const r = await fetch("/api/voix", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ texte, langue, voix }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!r.ok || !r.body) return false;
    const rate = Number(r.headers.get("x-voix-rate") ?? 24_000) || 24_000;
    const lecteur = r.body.getReader();
    lectureEnCours = {
      arreter: () => {
        annule = true;
        void lecteur.cancel();
      },
    };

    // Planification bout à bout : chaque morceau démarre là où le précédent finit.
    let prochainDepart = ctx.currentTime + 0.08;
    let reste: Uint8Array | null = null;
    let recu = false;
    const jouer = (octets: Uint8Array) => {
      // PCM 16 bits little-endian mono → Float32.
      const utile = octets.length - (octets.length % 2);
      if (utile === 0) return;
      const vue = new DataView(octets.buffer, octets.byteOffset, utile);
      const flottants = new Float32Array(utile / 2);
      for (let i = 0; i < flottants.length; i++) flottants[i] = vue.getInt16(i * 2, true) / 32768;
      const tamponAudio = ctx.createBuffer(1, flottants.length, rate);
      tamponAudio.getChannelData(0).set(flottants);
      const source = ctx.createBufferSource();
      source.buffer = tamponAudio;
      source.connect(ctx.destination);
      const depart = Math.max(prochainDepart, ctx.currentTime + 0.02);
      source.start(depart);
      prochainDepart = depart + tamponAudio.duration;
      recu = true;
    };

    for (;;) {
      const { done, value } = await lecteur.read();
      if (done || annule) break;
      let octets = value;
      if (reste && reste.length > 0) {
        const fusion = new Uint8Array(reste.length + value.length);
        fusion.set(reste);
        fusion.set(value, reste.length);
        octets = fusion;
      }
      const impair = octets.length % 2;
      reste = impair ? octets.slice(octets.length - impair) : null;
      jouer(impair ? octets.slice(0, octets.length - impair) : octets);
    }
    if (annule) return true;
    if (!recu) return false;
    // Attendre la fin de la lecture planifiée.
    const resteS = Math.max(0, prochainDepart - ctx.currentTime);
    await new Promise((r2) => setTimeout(r2, resteS * 1000 + 60));
    return true;
  } catch {
    return false;
  } finally {
    lectureEnCours = null;
  }
}

export function taireNaturel(): void {
  lectureEnCours?.arreter();
  if (contexteAudio) {
    // Coupe net ce qui est déjà planifié.
    void contexteAudio.close().catch(() => {});
    contexteAudio = null;
  }
}

/**
 * Un timbre par membre du jury. Deux leviers, parce qu'un seul ne suffit
 * pas : une voix différente quand le navigateur en a plusieurs (Edge en a
 * treize en français), et une hauteur propre — qui, elle, s'entend même
 * quand une seule voix est installée.
 */
const TIMBRES: Record<Timbre, { fr: string[]; en: string[]; hauteur: number; debit: number }> = {
  grave: { fr: ["Henri", "Remy", "Jérôme", "Alain", "Claude", "Paul"], en: ["Andrew", "Guy", "Christopher"], hauteur: 0.82, debit: 0.98 },
  claire: { fr: ["Denise", "Vivienne", "Éloise", "Julie", "Céline"], en: ["Ava", "Emma", "Jenny"], hauteur: 1.12, debit: 1.04 },
  vive: { fr: ["Josephine", "Brigitte", "Amélie", "Charline"], en: ["Aria", "Michelle"], hauteur: 1.2, debit: 1.1 },
  posee: { fr: ["Maurice", "Yves", "Thomas", "Antoine"], en: ["Brian", "Eric"], hauteur: 0.94, debit: 0.95 },
};

export interface VoixMembre {
  voix: SpeechSynthesisVoice | null;
  hauteur: number;
  debit: number;
}

/**
 * Attribue une voix distincte à chaque timbre : on ne réutilise jamais la
 * même tant qu'il en reste une libre, sinon deux membres du jury auraient la
 * même voix et la mise en scène tomberait à plat.
 */
export async function voixParTimbre(langue: "fr" | "en"): Promise<Record<Timbre, VoixMembre>> {
  const toutes = await listerVoix();
  const prefixe = langue === "en" ? "en" : "fr";
  const candidates = toutes.filter((v) => v.lang.toLowerCase().startsWith(prefixe));
  const prises = new Set<string>();
  const sortie = {} as Record<Timbre, VoixMembre>;

  for (const timbre of Object.keys(TIMBRES) as Timbre[]) {
    const t = TIMBRES[timbre];
    const noms = langue === "en" ? t.en : t.fr;
    const choisie =
      noms.map((n) => candidates.find((v) => v.name.includes(n) && !prises.has(v.name))).find(Boolean) ??
      candidates.find((v) => /natural|neural|online/i.test(v.name) && !prises.has(v.name)) ??
      candidates.find((v) => !prises.has(v.name)) ??
      candidates[0] ??
      null;
    if (choisie) prises.add(choisie.name);
    sortie[timbre] = { voix: choisie ?? null, hauteur: t.hauteur, debit: t.debit };
  }
  return sortie;
}
