"use client";

import { useEffect, useState } from "react";
import { mesurerFenetre, PAS_ECHANTILLON_MS } from "@/lib/decoupe-voix";

/**
 * Le diagnostic de l'appareil : chaque circuit dont l'appel dépend, testé sur
 * place, avec un verdict lisible. Construit parce qu'un « ça ne marche pas »
 * sur un téléphone qu'on n'a pas en main ne se répare qu'avec des faits —
 * l'utilisateur lance, capture l'écran, et l'on sait exactement où frapper.
 */

type Verdict = { nom: string; ok: boolean | null; detail: string };

const VERSION_DIAG = "diag-2026-08-29-e";

/**
 * L'état de la mémoire de panne (sc.dictee.segments) : quand elle est posée,
 * TOUTES les pages écoutent par segments serveur. La montrer — et permettre
 * de la retirer — évite de chercher un bug là où il y a juste un drapeau.
 */
function BasculeDictee() {
  const [posee, setPosee] = useState(false);
  useEffect(() => {
    try {
      setPosee(window.localStorage.getItem("sc.dictee.segments") === "1");
    } catch {
      /* stockage indisponible */
    }
  }, []);
  if (!posee) return <p className="report-note a-gauche">Dictée du téléphone utilisée en direct (aucune bascule serveur mémorisée).</p>;
  return (
    <p className="report-note a-gauche">
      ⚠ Cet appareil est marqué « dictée en panne » : toutes les pages transcrivent PAR LE SERVEUR (texte par vagues de ~3 s).{" "}
      <button
        className="btn ghost"
        onClick={() => {
          try {
            window.localStorage.removeItem("sc.dictee.segments");
          } catch {
            /* stockage indisponible */
          }
          setPosee(false);
        }}
      >
        Re-tester la dictée du téléphone
      </button>
    </p>
  );
}

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

    // ── 3. Le repli d'enregistrement (segments transcrits par le serveur).
    const typeSupporte = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find(
      (t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t),
    );
    pousser({
      nom: "Enregistreur (repli serveur)",
      ok: Boolean(typeSupporte),
      detail: typeSupporte ? `disponible (${typeSupporte})` : "MediaRecorder indisponible",
    });

    // ── 3 bis. La chaîne de transcription serveur, DE BOUT EN BOUT — et
    //    AVANT la dictée native : sur Android, celle-ci garde le micro après
    //    son arrêt, et ce test mesurait le conflit (pic 0.000), pas le
    //    circuit. Chaque test prend désormais son micro en premier. On
    //    enregistre 4 s (parle !), on envoie à /api/transcrire, on montre le
    //    texte rendu. C'est le circuit qu'utilise le repli sur téléphone —
    //    si un maillon casse (deux enregistreurs, format, réseau, Groq),
    //    ce verdict le nomme.
    if (typeSupporte) {
      const verdictTr = await new Promise<Verdict>((res) => {
        void (async () => {
          let flux: MediaStream | null = null;
          let fermerNiveaux = () => {};
          const niveaux: number[] = [];
          try {
            flux = await navigator.mediaDevices.getUserMedia({ audio: true });
            // Les niveaux du micro pendant le test : c'est sur eux que la
            // découpe à la voix décide « parole » ou « silence » — les voir
            // sur la capture permet de régler les seuils pour CE micro.
            try {
              const ctxN = new AudioContext();
              const srcN = ctxN.createMediaStreamSource(flux);
              const anaN = ctxN.createAnalyser();
              anaN.fftSize = 1024;
              srcN.connect(anaN);
              const tamponN = new Float32Array(anaN.fftSize);
              const timerN = window.setInterval(() => {
                anaN.getFloatTimeDomainData(tamponN);
                let somme = 0;
                for (let i = 0; i < tamponN.length; i++) somme += tamponN[i]! * tamponN[i]!;
                niveaux.push(Math.sqrt(somme / tamponN.length));
              }, PAS_ECHANTILLON_MS);
              fermerNiveaux = () => {
                clearInterval(timerN);
                void ctxN.close().catch(() => {});
              };
            } catch {
              /* sans analyseur, le test de transcription garde sa valeur */
            }
            const enr = new MediaRecorder(flux, { mimeType: typeSupporte });
            const morceaux: Blob[] = [];
            enr.ondataavailable = (e) => {
              if (e.data.size > 0) morceaux.push(e.data);
            };
            enr.onstop = () => {
              void (async () => {
                fermerNiveaux();
                flux?.getTracks().forEach((t) => t.stop());
                const m = mesurerFenetre(niveaux);
                const micro = niveaux.length > 0 ? ` [micro : pic ${m.pic.toFixed(3)}, fond ${m.plancher.toFixed(3)}, seuil ${m.seuilParole.toFixed(3)} → ${m.parle ? "parole détectée" : "AUCUNE parole détectée"}]` : "";
                const blob = new Blob(morceaux, { type: typeSupporte });
                if (blob.size < 200) return res({ nom: "Transcription serveur", ok: false, detail: `enregistrement quasi vide (${blob.size} octets) — le micro capte-t-il ?${micro}` });
                const fd = new FormData();
                fd.append("audio", blob, "segment.webm");
                fd.append("langue", "fr");
                const debut = Date.now();
                try {
                  const r = await fetch("/api/transcrire", { method: "POST", body: fd, signal: AbortSignal.timeout(25_000) });
                  const j = (await r.json()) as { texte?: string; erreur?: string };
                  if (!r.ok) return res({ nom: "Transcription serveur", ok: false, detail: `réponse ${r.status} : ${j.erreur ?? "?"}` });
                  const texte = (j.texte ?? "").trim();
                  res(texte
                    ? { nom: "Transcription serveur", ok: true, detail: `en ${((Date.now() - debut) / 1000).toFixed(1)} s, il a entendu : « ${texte.slice(0, 70)} »${micro}` }
                    : { nom: "Transcription serveur", ok: false, detail: `le serveur a répondu en ${((Date.now() - debut) / 1000).toFixed(1)} s mais n'a rien entendu — as-tu parlé pendant les 4 s ?${micro}` });
                } catch (e) {
                  res({ nom: "Transcription serveur", ok: false, detail: `envoi impossible (${(e as Error).name})${micro}` });
                }
              })();
            };
            enr.start();
            window.setTimeout(() => {
              try {
                if (enr.state === "recording") enr.stop();
              } catch {
                /* déjà arrêté */
              }
            }, 4000);
          } catch (e) {
            flux?.getTracks().forEach((t) => t.stop());
            res({ nom: "Transcription serveur", ok: false, detail: `enregistreur impossible (${(e as Error).message})` });
          }
        })();
      });
      pousser(verdictTr);
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
        rec.onresult = (ev: SpeechRecognitionEvent) => {
          let entendu = "";
          for (let i = 0; i < ev.results.length; i++) entendu += ev.results[i]![0]!.transcript;
          if (entendu.trim()) fin(true, `elle entend : « ${entendu.trim().slice(0, 60)} »`);
        };
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
      // Le vrai statut du fournisseur voyage dans le corps : un 502 qui
      // enveloppe un 429 Google veut dire « minute saturée », pas « en panne ».
      let cause = "";
      if (!r.ok) {
        try {
          const j = (await r.json()) as { status?: number };
          if (j.status === 429) cause = " (minute saturée chez le fournisseur — réessaie dans une minute)";
          else if (j.status) cause = ` (fournisseur : ${j.status})`;
        } catch {
          /* corps illisible */
        }
      }
      pousser({ nom: "Voix du serveur (/api/voix)", ok: r.ok && octets > 1000, detail: r.ok ? `${Math.round(octets / 1024)} Ko d'audio reçus` : `réponse ${r.status}${r.status === 429 ? " — quota du mois épuisé" : cause}` });
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
        u.onerror = (ev) => fin(false, `erreur « ${ev.error} » — pas bloquant si la voix du serveur est ✅ : l\u2019appel l\u2019utilisera`);
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
      <BasculeDictee />

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
