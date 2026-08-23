"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Icone } from "@/app/components/Icone";
import { Marque } from "./Sidebar";

/**
 * La porte d'entrée : on crée un compte pour entrer, comme sur Propulsez.
 * Trois chemins : e-mail + mot de passe, Google, lien magique. Plein écran,
 * sans la coquille — c'est la première impression de l'application.
 */
export default function EcranConnexion({ lienDispo }: { lienDispo: boolean }) {
  const [mode, setMode] = useState<"creer" | "connexion">("creer");
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [mdp, setMdp] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [lienEnvoye, setLienEnvoye] = useState(false);

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setOccupe(true);
    setErreur(null);
    try {
      if (mode === "creer") {
        const r = await fetch("/api/auth/inscription", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ nom, email, mdp }) });
        const j = (await r.json()) as { erreur?: string };
        if (!r.ok) throw new Error(j.erreur ?? "Inscription impossible.");
      }
      const res = await signIn("credentials", { email, mdp, redirect: false });
      if (res?.error) throw new Error(mode === "creer" ? "Compte créé mais connexion impossible. Réessaie." : "Adresse ou mot de passe incorrect.");
      window.location.assign("/app");
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Ça n'a pas marché. Réessaie.");
    } finally {
      setOccupe(false);
    }
  }

  async function envoyerLien() {
    if (!email.includes("@")) {
      setErreur("Entre ton adresse e-mail d'abord.");
      return;
    }
    setOccupe(true);
    setErreur(null);
    try {
      const r = await signIn("resend", { email: email.trim(), callbackUrl: "/app", redirect: false });
      if (r?.error) throw new Error(r.error);
      setLienEnvoye(true);
    } catch {
      setErreur("L'e-mail n'est pas parti. Vérifie l'adresse, ou utilise Google.");
    } finally {
      setOccupe(false);
    }
  }

  return (
    <div className="porte">
      <div className="porte-formulaire">
        <div className="porte-marque">
          <Marque taille={26} />
        </div>
        <h1>{mode === "creer" ? "Crée ton compte" : "Content de te revoir"}</h1>
        <p className="porte-sous">
          {mode === "creer"
            ? "Ta préparation te suit sur tous tes appareils : sessions, mesures, appels avec le jury, débriefs."
            : "Reprends ta préparation là où tu l'as laissée."}
        </p>

        <button type="button" className="btn porte-google" onClick={() => void signIn("google", { callbackUrl: "/app" })}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.6 2.8c2.2-2 3.8-5 3.8-8.5z"/><path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2-3.2 0-5.9-2.1-6.9-5.1l-3.8 2.9C3.3 21.3 7.3 24 12 24z"/><path fill="#FBBC05" d="M5.1 14.3c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3L1.3 6.8C.5 8.4 0 10.1 0 12s.5 3.6 1.3 5.2l3.8-2.9z"/><path fill="#EA4335" d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.3 0 3.3 2.7 1.3 6.8l3.8 2.9c1-3 3.7-5 6.9-5z"/></svg>
          Continuer avec Google
        </button>

        <div className="connexion-ou">
          <span>ou par e-mail</span>
        </div>

        {lienEnvoye ? (
          <p className="forfait-ok">
            <Icone nom="valide" /> Lien envoyé à <b>{email}</b>. Ouvre ta boîte mail et clique sur « Me connecter ».
          </p>
        ) : (
          <form onSubmit={(e) => void soumettre(e)} className="porte-champs">
            {mode === "creer" && (
              <label className="champ">
                <span>Ton prénom</span>
                <input type="text" name="nom" autoComplete="given-name" required minLength={2} value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Zakaria" />
              </label>
            )}
            <label className="champ">
              <span>Adresse e-mail</span>
              <input type="email" name="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="prenom.nom@ecole.ma" />
            </label>
            <label className="champ">
              <span>Mot de passe {mode === "creer" && <small>(8 caractères minimum)</small>}</span>
              <input type="password" name="mdp" autoComplete={mode === "creer" ? "new-password" : "current-password"} required minLength={8} value={mdp} onChange={(e) => setMdp(e.target.value)} placeholder="••••••••" />
            </label>
            {erreur && (
              <p className="warn" role="alert">
                {erreur}
              </p>
            )}
            <button className="btn primary big" type="submit" disabled={occupe}>
              {occupe ? "Un instant…" : mode === "creer" ? "Créer mon compte" : "Me connecter"}
            </button>
          </form>
        )}

        <p className="porte-bascule">
          {mode === "creer" ? (
            <>
              Déjà un compte ?{" "}
              <button type="button" className="link-btn" onClick={() => setMode("connexion")}>
                Se connecter
              </button>
            </>
          ) : (
            <>
              Pas encore de compte ?{" "}
              <button type="button" className="link-btn" onClick={() => setMode("creer")}>
                Créer un compte
              </button>
              {lienDispo && !lienEnvoye && (
                <>
                  {" "}· Mot de passe oublié ?{" "}
                  <button type="button" className="link-btn" onClick={() => void envoyerLien()}>
                    Recevoir un lien de connexion
                  </button>
                </>
              )}
            </>
          )}
        </p>
        <p className="porte-legal">
          En continuant, tu acceptes la <Link href="/confidentialite">politique de confidentialité</Link>. Ton audio ne quitte jamais ton appareil.
        </p>
      </div>
      <div className="porte-visuel" aria-hidden="true">
        <div>
          <p className="porte-visuel-titre">Prépare ton oral comme un vrai.</p>
          <ul>
            <li><Icone nom="appel" /> L&apos;appel avec le jury IA : il parle, tu réponds, il rebondit.</li>
            <li><Icone nom="graphique" /> Des mesures honnêtes — jamais de note inventée.</li>
            <li><Icone nom="message" /> Un débrief de coach après chaque session.</li>
            <li><Icone nom="cadenas" /> Ton audio reste sur ton appareil.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
