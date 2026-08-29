"use client";

import { useEffect, useState } from "react";

/**
 * Le diagnostic de l'appareil : chaque circuit dont l'appel dépend, testé sur
 * place, avec un verdict lisible. Construit parce qu'un « ça ne marche pas »
 * sur un téléphone qu'on n'a pas en main ne se répare qu'avec des faits —
 * l'utilisateur lance, capture l'écran, et l'on sait exactement où frapper.
 */

type Verdict = { nom: string; ok: boolean | null; detail: string };

const VERSION_DIAG = "diag-2026-08-28-b";

export default function DiagnosticPage() {
  const [verdicts, setVerdicts] = useState<Verdict[]>([]);
  const [enCours, setEnCours] = useState(false);
  const [fini, setFini] = useState(false);
  const [sw, setSw] = useState<string>("");

  // Les vieux service workers (l'époque des notifications push) survivent à
  // leur suppression du code : ils peuvent servir une version périmée de
  // l'app pour toujours. On les désinscrit, et on le dit.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      setSw("aucun service worker possible sur ce navigateur");
      return;
    }
    navigator.serviceWorker
      .getRegistrations()
      .then(async (regs) => {
        if (regs.length === 0) {
          setSw("aucun ancien service worker — la page est fraîche");
          return;
        }
        await Promise.all(regs.map((r) => r.unregister()));
        setSw(`${regs.length} ancien(s) service worker(s) désinscrit(s) — RECHARGE la page puis relance le diagnostic`);
      })
      .catch(() => setSw("service workers illisibles"));
  }, []);

  const pousser = (v: Verdict) => setVerdicts((l) => [...l, v]);

  async function lancer() {
    setVerdicts([]);
    setFini(false);
    setEnCours(true);

    // ── 1. Le micro.
    try {
      const flux = await navigator.mediaDevices.getUserMedia({ audio: true });
      flux.getTracks().forEach((t) => t.stop());
      pousser({ nom: "Micro", ok: true, detail: "autorisé et capté" });
    } catch (e) {
      pousser({ nom: "Micro", ok: false, detail: `refusé ou absent (${(e as Error).name})` });
    }

    // ── 2. La dictée du navigateur — on la lance vraiment et on écoute ses
    //      événements pendant six secondes : sur certains téléphones elle
    //      « existe » mais échoue à l'exécution.
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
    if (!Ctor) {
      pousser({ nom: "Dictée du navigateur", ok: false, detail: "absente — le repli serveur prendra la suite" });
    } else {
      const resultat = await new Promise<Verdict>((res) => {
        const rec = new Ctor();
        rec.lang = "fr-FR";
        rec.interimResults = true;
        let vivante = false;
        const fin = (ok: boolean, detail: string) => {
          try {
            rec.abort();
          } catch {
            /* déjà arrêtée */
          }
          res({ nom: "Dictée du navigateur", ok, detail });
        };
        rec.addEventListener("audiostart", () => {
          vivante = true;
        });
        rec.onresult = () => fin(true, "elle transcrit — dis un mot pour la voir");
        rec.onerror = (ev: SpeechRecognitionErrorEvent) => fin(false, `erreur « ${ev.error} » — le repli serveur prendra la suite`);
        window.setTimeout(() => fin(vivante, vivante ? "démarrée et à l'écoute (parle pour vérifier la transcription)" : "ne démarre jamais — le repli serveur prendra la suite"), 6000);
        try {
          rec.start();
        } catch (e) {
          fin(false, `démarrage impossible (${(e as Error).message})`);
        }
      });
      pousser(resultat);
    }

    // ── 3. Le repli d'enregistrement (segments transcrits par le serveur).
    const typeSupporte = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find(
      (t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t),
    );
    pousser({
      nom: "Enregistreur (repli serveur)",
      ok: Boolean(typeSupporte),
      detail: typeSupporte ? `disponible (${typeSupporte})` : "MediaRecorder indisponible",
    });

    // ── 4. Le contexte audio — déverrouillé ici même, dans le geste du bouton.
    try {
      const ctx = new AudioContext();
      if (ctx.state === "suspended") await ctx.resume();
      const etat = ctx.state;
      // Un bip franc d'un quart de seconde : si tu l'entends, la sortie audio marche.
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0.12;
      osc.frequency.value = 660;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
      await new Promise((r) => setTimeout(r, 400));
      pousser({ nom: "Sortie audio (Web Audio)", ok: etat === "running", detail: etat === "running" ? "contexte actif — tu as dû entendre un bip" : `contexte « ${etat} »` });
      void ctx.close();
    } catch (e) {
      pousser({ nom: "Sortie audio (Web Audio)", ok: false, detail: (e as Error).message });
    }

    // ── 5. La voix naturelle du serveur.
    try {
      const r = await fetch("/api/voix", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ texte: "Test.", langue: "fr", voix: "grave" }),
        signal: AbortSignal.timeout(20_000),
      });
      const octets = r.ok ? (await r.arrayBuffer()).byteLength : 0;
      pousser({ nom: "Voix du serveur (/api/voix)", ok: r.ok && octets > 1000, detail: r.ok ? `${Math.round(octets / 1024)} Ko d'audio reçus` : `réponse ${r.status}${r.status === 429 ? " — quota du mois épuisé" : ""}` });
    } catch (e) {
      pousser({ nom: "Voix du serveur (/api/voix)", ok: false, detail: (e as Error).name });
    }

    // ── 6. La voix du navigateur — une phrase entière, à entendre.
    if (!("speechSynthesis" in window)) {
      pousser({ nom: "Voix du navigateur", ok: false, detail: "speechSynthesis absent" });
    } else {
      const verdict = await new Promise<Verdict>((res) => {
        const u = new SpeechSynthesisUtterance("Si tu entends cette phrase, la voix du navigateur fonctionne.");
        u.lang = "fr-FR";
        let fini2 = false;
        const fin = (ok: boolean, detail: string) => {
          if (fini2) return;
          fini2 = true;
          res({ nom: "Voix du navigateur", ok, detail });
        };
        u.onend = () => fin(true, "phrase prononcée jusqu'au bout");
        u.onerror = (ev) => fin(false, `erreur « ${ev.error} »`);
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
        window.setTimeout(() => fin(false, "aucun son en 12 s — synthèse muette"), 12_000);
      });
      pousser(verdict);
    }

    setEnCours(false);
    setFini(true);
  }

  return (
    <div className="diagnostic">
      <p className="session-meta" style={{ maxWidth: "62ch" }}>
        Ce diagnostic teste chaque circuit dont l&apos;appel dépend, sur CET appareil. Lance-le,
        monte le volume média, autorise le micro si on te le demande — puis{" "}
        <b>envoie une capture d&apos;écran du résultat</b>.
      </p>
      <p className="report-note a-gauche">{sw}</p>

      <button className="btn primary big" onClick={() => void lancer()} disabled={enCours}>
        {enCours ? "Diagnostic en cours… (écoute le bip et la phrase)" : "Lancer le diagnostic"}
      </button>

      {verdicts.length > 0 && (
        <ul className="diag-liste">
          {verdicts.map((v, i) => (
            <li key={i} className={v.ok === null ? "" : v.ok ? "diag-ok" : "diag-ko"}>
              <b>
                {v.ok === null ? "…" : v.ok ? "✅" : "❌"} {v.nom}
              </b>
              <small>{v.detail}</small>
            </li>
          ))}
        </ul>
      )}

      {fini && (
        <p className="report-note a-gauche">
          Version {VERSION_DIAG} · {typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 80) : ""}
        </p>
      )}
    </div>
  );
}
