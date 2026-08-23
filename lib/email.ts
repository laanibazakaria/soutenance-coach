import "server-only";

/**
 * Les e-mails sortants, via Resend. Tant qu'aucun domaine n'est vérifié,
 * Resend n'autorise l'expéditeur `onboarding@resend.dev` qu'à écrire au
 * propriétaire du compte : parfait pour tester, pas pour les étudiants.
 * Dès que le domaine est vérifié, il suffit de poser EMAIL_FROM.
 */
export function emailConfigure(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export function expediteur(): string {
  return process.env.EMAIL_FROM ?? "SoutenanceCoach <onboarding@resend.dev>";
}

export async function envoyerEmail(args: { a: string; sujet: string; html: string; texte: string }): Promise<{ ok: true } | { ok: false; erreur: string }> {
  const cle = process.env.RESEND_API_KEY;
  if (!cle) return { ok: false, erreur: "E-mail non configuré." };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${cle}` },
      body: JSON.stringify({ from: expediteur(), to: [args.a], subject: args.sujet, html: args.html, text: args.texte }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { message?: string };
      return { ok: false, erreur: j.message ?? `Resend ${r.status}` };
    }
    return { ok: true };
  } catch {
    return { ok: false, erreur: "Resend injoignable." };
  }
}

/** Le gabarit commun : sobre, lisible dans tous les clients mail. */
export function gabarit(titre: string, corps: string, bouton?: { libelle: string; url: string }): string {
  const btn = bouton
    ? `<p style="margin:24px 0"><a href="${bouton.url}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px">${bouton.libelle}</a></p>`
    : "";
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#f6faf9;font-family:Segoe UI,system-ui,sans-serif;color:#1b2a2e">
<div style="max-width:560px;margin:0 auto;padding:32px 20px">
  <p style="font-weight:800;font-size:18px;margin:0 0 20px">Soutenance<span style="color:#0f766e">Coach</span></p>
  <div style="background:#ffffff;border:1px solid #d9e6e2;border-radius:14px;padding:26px 28px">
    <h1 style="font-size:20px;margin:0 0 12px">${titre}</h1>
    <div style="font-size:16px;line-height:1.6">${corps}</div>
    ${btn}
  </div>
  <p style="font-size:12px;color:#7a8c91;margin-top:18px">Tu reçois cet e-mail parce qu'une action a été demandée sur SoutenanceCoach. Si ce n'était pas toi, ignore-le.</p>
</div></body></html>`;
}

/** L'e-mail du lien de connexion (Auth.js). */
export async function envoyerLienConnexion(a: string, url: string): Promise<void> {
  const u = new URL(url);
  // Les messageries pré-ouvrent les liens : on passe par une page qui n'utilise
  // le jeton qu'au clic, sinon il est consommé avant la personne.
  const confirmation = `${u.origin}/app/connexion/confirmer?u=${encodeURIComponent(url)}`;
  const r = await envoyerEmail({
    a,
    sujet: "Ton lien de connexion à SoutenanceCoach",
    html: gabarit("Connexion à SoutenanceCoach", `<p>Clique sur le bouton pour te connecter sur <b>${u.host}</b>. Le lien est valable 24 heures et ne sert qu'une fois.</p>`, { libelle: "Me connecter", url: confirmation }),
    texte: `Connexion à SoutenanceCoach\n\nOuvre ce lien pour te connecter (valable 24 h) :\n${confirmation}\n\nSi tu n'as rien demandé, ignore cet e-mail.`,
  });
  if (!r.ok) throw new Error(r.erreur);
}

/** L'e-mail du code de vérification à l'inscription. */
export async function envoyerCodeVerification(a: string, code: string): Promise<{ ok: true } | { ok: false; erreur: string }> {
  const chiffres = `<p style="font-size:34px;font-weight:800;letter-spacing:10px;font-variant-numeric:tabular-nums;margin:18px 0;color:#0f766e">${code}</p>`;
  return envoyerEmail({
    a,
    sujet: `${code} — ton code SoutenanceCoach`,
    html: gabarit("Vérifie ton adresse", `<p>Voici ton code de vérification. Il est valable 15 minutes.</p>${chiffres}<p>Entre-le sur la page d'inscription pour activer ton compte.</p>`),
    texte: `Ton code de vérification SoutenanceCoach : ${code}\nIl est valable 15 minutes.`,
  });
}
