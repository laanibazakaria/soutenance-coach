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
export function parler(texte: string, langue: "fr" | "en", voix: SpeechSynthesisVoice | null, options: { debit?: number } = {}): Promise<void> {
  return new Promise((resolve) => {
    if (!voixDisponible()) return resolve();
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(texte);
    u.lang = langue === "en" ? "en-US" : "fr-FR";
    if (voix) u.voice = voix;
    u.rate = options.debit ?? 1;
    u.pitch = 1;
    let fini = false;
    const terminer = () => {
      if (fini) return;
      fini = true;
      enCours = null;
      resolve();
    };
    u.onend = terminer;
    u.onerror = terminer;
    enCours = u;
    window.speechSynthesis.speak(u);
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
