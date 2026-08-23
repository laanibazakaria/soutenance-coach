import { createHash, randomInt } from "crypto";

/**
 * La vérification d'adresse à l'inscription : un code à 6 chiffres envoyé
 * par e-mail, valable 15 minutes. On ne stocke que son empreinte — la table
 * VerificationToken d'Auth.js sert de rangement (identifier = e-mail).
 */
export const VALIDITE_CODE_MIN = 15;
export const PREFIXE_CODE = "code:";

export function genererCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function empreinteCode(email: string, code: string): string {
  return PREFIXE_CODE + createHash("sha256").update(`${email.toLowerCase()}|${code}`).digest("hex");
}

export function codePlausible(code: unknown): code is string {
  return typeof code === "string" && /^\d{6}$/.test(code.trim());
}

export function expirationCode(maintenant: Date = new Date()): Date {
  return new Date(maintenant.getTime() + VALIDITE_CODE_MIN * 60_000);
}
