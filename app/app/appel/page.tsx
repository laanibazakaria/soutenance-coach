"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Icone, IconeBadge } from "@/app/components/Icone";
import { useToast } from "@/app/components/Toast";
import { PERSONAS, DUREES_APPEL, MEMBRES, membreParId, assemblerContexte, paroleCandidat, type ModeAppel, type Message, type Debrief } from "@/lib/appel";
import { listeDeckSauvegarde } from "@/lib/slides/persistance";
import { lireCache, ecrireCache } from "@/lib/ia-cache";
import { lireCandidature } from "@/lib/entretien/persistance";
import { lireProfil } from "@/lib/modules/persistance";
import { MODULES, estModuleId } from "@/lib/modules";
import { estRapport } from "@/lib/rapport";
import { lireLangue, courte, type LangueCourte } from "@/lib/langue";
import { lireProfilEtudiant, ligneContexteEtudiant } from "@/lib/etudiant";
import { lireModulesActifs } from "@/lib/preferences";
import { saveSession, countWords } from "@/lib/storage";
import { pousserTout, signalerSynchronisation } from "@/lib/sync/client";
import { signalerAppelIa } from "@/lib/usage-client";
import { voixDisponible, meilleureVoix, parler, taire, voixNavigateurExcellente, parlerNaturel, taireNaturel } from "@/lib/voix";
import { CLE_RAPPORT } from "../components/RapportView";
import { useEcouteSegments } from "../hooks/useEcouteSegments";
import { useCamera } from "../hooks/useCamera";
import ConstatsCamera from "@/app/components/ConstatsCamera";
import { ligneContexteCamera, type BilanCamera } from "@/lib/camera";
import { passagesPour } from "@/lib/memoire/client";
import type { Evaluation } from "@/lib/grille";
import DebriefAppel from "./DebriefAppel";

type Phase = "idle" | "jury-reflechit" | "jury-parle" | "ecoute" | "debrief" | "fini";

const MODES: ModeAppel[] = ["soutenance", "entretien", "pitch", "concours"];
const SILENCE_MS = 2600;
const REPONSE_MAX_MS = 150_000;

function getRecognitionCtor(): (new () => SpeechRecognition) | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

/** Lit tout ce qu'on sait du candidat pour ce type d'oral. */
function contexteDepuisAppareil(mode: ModeAppel): string {
  const st = window.localStorage;
  const etudiant = ligneContexteEtudiant(lireProfilEtudiant(st));
  const avec = (contexte: string) => (etudiant ? (contexte ? `${etudiant}\n\n${contexte}` : etudiant) : contexte);
  if (mode === "soutenance") {
    const deck = listeDeckSauvegarde(st);
    const rapport = lireCache<unknown>(st, CLE_RAPPORT);
    return avec(assemblerContexte([
      { titre: "Slides de la soutenance", texte: deck ? deck.slides.map((s, i) => `[${i + 1}] ${s.texte}`).join("\n") : null },
      { titre: "Extrait du mémoire", texte: estRapport(rapport) ? rapport.texte : null },
    ]));
  }
  if (mode === "entretien") {
    const c = lireCandidature(st);
    return avec(c ? assemblerContexte([{ titre: `Poste visé : ${c.poste}${c.entreprise ? ` chez ${c.entreprise}` : ""}`, texte: c.offre }, { titre: "CV du candidat", texte: c.cvTexte }]) : "");
  }
  if (estModuleId(mode)) {
    const p = lireProfil(st, mode);
    if (!p) return avec("");
    const m = MODULES[mode];
    return avec(assemblerContexte([
      ...m.champs.map((ch) => ({ titre: ch.titreContexte, texte: p.champs[ch.id] })),
      { titre: "Dossier", texte: p.documentTexte },
    ]));
  }
  return "";
}

export default function AppelPage() {
  return (
    <Suspense fallback={null}>
      <AppelInner />
    </Suspense>
  );
}

function AppelInner() {
  const params = useSearchParams();
  const toast = useToast();
  const [actifs, setActifs] = useState<ModeAppel[]>([]);
  const [mode, setMode] = useState<ModeAppel>("soutenance");
  const [dureeMin, setDureeMin] = useState<number>(10);
  const [langue, setLangue] = useState<LangueCourte>("fr");
  const [phase, setPhase] = useState<Phase>("idle");
  const [historique, setHistorique] = useState<Message[]>([]);
  const [interim, setInterim] = useState("");
  const [ecouleS, setEcouleS] = useState(0);
  const [supporte, setSupporte] = useState({ micro: true, voix: true });
  const [contexte, setContexte] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [debrief, setDebrief] = useState<Debrief | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  /** Voix naturelle de l'API quand le navigateur n'a rien de bon (décidé au lancement). */
  const [voixNaturelle, setVoixNaturelle] = useState(false);
  const [cameraVoulue, setCameraVoulue] = useState(true);
  const [bilanCamera, setBilanCamera] = useState<BilanCamera | null>(null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const evaluationRef = useRef<Evaluation | null>(null);

  const voixRef = useRef<SpeechSynthesisVoice | null>(null);
  const recRef = useRef<SpeechRecognition | null>(null);
  const finalRef = useRef("");
  const silenceRef = useRef<number | null>(null);
  const maxRef = useRef<number | null>(null);
  const debutRef = useRef(0);
  const arreteRef = useRef(false);
  const historiqueRef = useRef<Message[]>([]);
  const finirReponseRef = useRef<() => void>(() => {});
  const segments = useEcouteSegments();
  const camera = useCamera();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  /** Questions posées lors des appels précédents : le jury ne se répète pas d un appel à l autre. */
  const dejaPoseesRef = useRef<string[]>([]);

  useEffect(() => {
    const a = (lireModulesActifs(window.localStorage) ?? ["soutenance"]) as ModeAppel[];
    setActifs(a.filter((m): m is ModeAppel => MODES.includes(m)));
    const demande = params.get("mode");
    const initial = demande && MODES.includes(demande as ModeAppel) ? (demande as ModeAppel) : a[0] && MODES.includes(a[0]) ? a[0] : "soutenance";
    setMode(initial);
    setLangue(courte(lireLangue(window.localStorage)));
    setSupporte({ micro: getRecognitionCtor() !== null || segments.disponible(), voix: voixDisponible() });
    dejaPoseesRef.current = lireCache<string[]>(window.localStorage, "appel:questions-posees") ?? [];
  }, [params]);

  useEffect(() => {
    setContexte(contexteDepuisAppareil(mode));
  }, [mode]);

  useEffect(() => {
    if (phase === "idle" || phase === "fini" || phase === "debrief") return;
    const t = setInterval(() => setEcouleS(Math.round((Date.now() - debutRef.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const nettoyerEcoute = useCallback(() => {
    segments.arreter();
    if (silenceRef.current) window.clearTimeout(silenceRef.current);
    if (maxRef.current) window.clearTimeout(maxRef.current);
    silenceRef.current = null;
    maxRef.current = null;
    const rec = recRef.current;
    recRef.current = null;
    if (rec) {
      rec.onresult = null;
      rec.onend = null;
      rec.onerror = null;
      try {
        rec.stop();
      } catch {
        /* déjà arrêté */
      }
    }
  }, []);

  const terminerAppel = useCallback(
    async (hist: Message[]) => {
      arreteRef.current = true;
      nettoyerEcoute();
      segments.arreter();
      taire();
      taireNaturel();
      const reponses = hist.filter((m) => m.role === "user");
      if (reponses.length === 0) {
        setPhase("idle");
        setHistorique([]);
        toast.info("Appel terminé sans réponse : rien à débriefer.");
        return;
      }
      // Ce que le jury vient de demander rejoint la mémoire des appels.
      const posees = hist.filter((m) => m.role === "assistant").map((m) => m.content);
      dejaPoseesRef.current = [...posees, ...dejaPoseesRef.current].slice(0, 40);
      ecrireCache(window.localStorage, "appel:questions-posees", dejaPoseesRef.current);
      const vuCamera = camera.recolter();
      camera.eteindre();
      setBilanCamera(vuCamera);
      setPhase("debrief");
      const dureeMs = Date.now() - debutRef.current;
      const id = crypto.randomUUID();
      const parole = paroleCandidat(hist);
      saveSession(window.localStorage, { id, startedAt: new Date(debutRef.current).toISOString(), durationMs: dureeMs, transcript: parole, wordCount: countWords(parole), mode });
      setSessionId(id);
      // La grille part en parallèle du débrief : deux regards, une seule attente.
      const echange = hist.map((m) => `${m.role === "assistant" ? "JURY" : "CANDIDAT"} : ${m.content}`).join("\n\n");
      const grillePromise = fetch("/api/grille", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ oral: mode, echange, contexte: contexte.slice(0, 4000), mesures: ligneContexteCamera(vuCamera) ?? undefined, dureeMin }),
      })
        .then((r) => (r.ok ? (r.json() as Promise<{ evaluation?: Evaluation }>) : null))
        .then((j) => {
          evaluationRef.current = j?.evaluation ?? null;
          setEvaluation(evaluationRef.current);
        })
        .catch(() => {
          evaluationRef.current = null;
          setEvaluation(null);
        });
      try {
        const r = await fetch("/api/appel/debrief", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode, contexte: [contexte, ligneContexteCamera(vuCamera)].filter(Boolean).join("\n\n"), langue, dureeMin, historique: hist }) });
        const j = (await r.json()) as { debrief?: Debrief; erreur?: string };
        if (!r.ok || !j.debrief) throw new Error(j.erreur ?? "Débrief indisponible.");
        signalerAppelIa();
        await grillePromise;
        ecrireCache(window.localStorage, `appel:${id}`, { mode, dureeMin, dialogue: hist, debrief: j.debrief, camera: vuCamera, grille: evaluationRef.current, date: new Date().toISOString() });
        setDebrief(j.debrief);
      } catch (e) {
        await grillePromise;
        ecrireCache(window.localStorage, `appel:${id}`, { mode, dureeMin, dialogue: hist, debrief: null, camera: vuCamera, grille: evaluationRef.current, date: new Date().toISOString() });
        setErreur(e instanceof Error ? e.message : "Débrief indisponible.");
      }
      signalerSynchronisation();
      void pousserTout();
      setPhase("fini");
    },
    [camera, contexte, dureeMin, langue, mode, nettoyerEcoute, toast],
  );

  const tourDuJury = useCallback(
    async (hist: Message[]) => {
      if (arreteRef.current) return;
      setPhase("jury-reflechit");
      let replique = "";
      let membre = MEMBRES[mode][0]!.id;
      let fin = false;
      // Les passages du mémoire les plus proches de la dernière réponse : le
      // jury interroge sur le document déposé, pas sur des généralités.
      const derniere = [...hist].reverse().find((m) => m.role === "user")?.content ?? "";
      const extraits = mode === "soutenance" ? await passagesPour(derniere || contexte.slice(0, 800)).catch(() => null) : null;
      const contexteComplet = extraits ? `${contexte}\n\n${extraits}` : contexte;
      try {
        const r = await fetch("/api/appel/tour", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode, contexte: contexteComplet, langue, dureeMin, ecouleS: Math.round((Date.now() - debutRef.current) / 1000), historique: hist, dejaPosees: dejaPoseesRef.current }) });
        const j = (await r.json()) as { replique?: string; fin?: boolean; membre?: string; erreur?: string };
        if (!r.ok || !j.replique) throw new Error(j.erreur ?? "Le jury ne répond pas.");
        replique = j.replique;
        membre = j.membre ?? membre;
        fin = j.fin === true;
        if (hist.length === 0) signalerAppelIa();
      } catch (e) {
        setErreur(e instanceof Error ? e.message : "Le jury ne répond pas.");
        if (hist.length === 0) {
          setPhase("idle");
          arreteRef.current = true;
          return;
        }
        await terminerAppel(hist);
        return;
      }
      if (arreteRef.current) return;
      const nouveau: Message[] = [...hist, { role: "assistant", content: replique, membre }];
      historiqueRef.current = nouveau;
      setHistorique(nouveau);
      setPhase("jury-parle");
      let dit = false;
      if (voixNaturelle) dit = await parlerNaturel(replique, langue, membreParId(mode, membre).voix);
      if (!dit && !arreteRef.current) {
        if (supporte.voix) await parler(replique, langue, voixRef.current, { debit: 1.02 });
        else await new Promise((r) => setTimeout(r, Math.min(8000, 800 + replique.length * 45)));
      }
      if (arreteRef.current) return;
      if (fin) {
        await terminerAppel(nouveau);
        return;
      }
      ecouter(nouveau);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, contexte, langue, dureeMin, supporte.voix, voixNaturelle, terminerAppel],
  );

  function ecouter(hist: Message[]) {
    const Ctor = getRecognitionCtor();
    setPhase("ecoute");
    finalRef.current = "";
    setInterim("");
    if (!Ctor) {
      // Pas de reconnaissance vocale (Firefox, Safari, mobiles) : segments de
      // 3,5 s transcrits par Whisper. Fin de réponse : deux segments muets.
      const finirSegments = () => {
        segments.arreter();
        if (maxRef.current) window.clearTimeout(maxRef.current);
        const texte = finalRef.current.trim();
        const nouveau: Message[] = [...hist, { role: "user", content: texte || "(silence)" }];
        historiqueRef.current = nouveau;
        setHistorique(nouveau);
        void tourDuJury(nouveau);
      };
      finirReponseRef.current = finirSegments;
      maxRef.current = window.setTimeout(finirSegments, REPONSE_MAX_MS);
      void segments
        .demarrer({
          langue,
          surTexte: (t) => {
            finalRef.current += `${t} `;
            setInterim("");
            setHistorique((h) => [...h]); // rafraîchit la bulle en cours
          },
          surFin: finirSegments,
        })
        .then((ok) => {
          if (!ok) {
            setErreur("Le micro est refusé ou absent. Autorise-le pour répondre au jury.");
            void terminerAppel(hist);
          }
        });
      return;
    }
    const rec = new Ctor();
    rec.lang = langue === "en" ? "en-US" : "fr-FR";
    rec.continuous = true;
    rec.interimResults = true;
    recRef.current = rec;

    const finir = () => {
      if (recRef.current !== rec) return;
      nettoyerEcoute();
      const texte = finalRef.current.trim();
      setInterim("");
      const nouveau: Message[] = texte ? [...hist, { role: "user", content: texte }] : [...hist, { role: "user", content: langue === "en" ? "(silence)" : "(silence)" }];
      historiqueRef.current = nouveau;
      setHistorique(nouveau);
      void tourDuJury(nouveau);
    };
    finirReponseRef.current = finir;

    const relancerSilence = () => {
      if (silenceRef.current) window.clearTimeout(silenceRef.current);
      silenceRef.current = window.setTimeout(finir, SILENCE_MS);
    };

    rec.onresult = (ev: SpeechRecognitionEvent) => {
      let inter = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i]!;
        if (r.isFinal) finalRef.current += `${r[0]!.transcript} `;
        else inter += r[0]!.transcript;
      }
      setInterim(inter);
      if (finalRef.current.trim() !== "" && inter.trim() === "") relancerSilence();
      else if (silenceRef.current) {
        window.clearTimeout(silenceRef.current);
        silenceRef.current = null;
      }
    };
    rec.onend = () => {
      // Chrome coupe la reconnaissance après un silence : on relance tant que la réponse n'est pas finie.
      if (recRef.current === rec && !arreteRef.current) {
        try {
          rec.start();
        } catch {
          /* ignore */
        }
      }
    };
    rec.onerror = (ev: SpeechRecognitionErrorEvent) => {
      if (ev.error === "not-allowed" || ev.error === "audio-capture") {
        setErreur("Le micro est refusé ou absent. Autorise-le pour répondre au jury.");
        void terminerAppel(hist);
      }
    };
    maxRef.current = window.setTimeout(finir, REPONSE_MAX_MS);
    try {
      rec.start();
    } catch {
      /* double start */
    }
  }

  async function demarrer() {
    setErreur(null);
    setDebrief(null);
    setSessionId(null);
    setHistorique([]);
    historiqueRef.current = [];
    arreteRef.current = false;
    debutRef.current = Date.now();
    setEcouleS(0);
    // La caméra démarre en parallèle : un modèle lent ne doit jamais retarder le jury.
    if (cameraVoulue && videoRef.current) void camera.allumer(videoRef.current);
    if (supporte.voix) voixRef.current = await meilleureVoix(langue);
    setVoixNaturelle(!voixNavigateurExcellente(voixRef.current));
    // Un premier « parler » vide débloque la synthèse vocale sur mobile (geste utilisateur requis).
    if (supporte.voix) await parler(" ", langue, voixRef.current);
    await tourDuJury([]);
  }

  useEffect(() => () => {
    arreteRef.current = true;
    nettoyerEcoute();
    taire();
    taireNaturel();
  }, [nettoyerEcoute]);

  const p = PERSONAS[mode];
  // Un seul élément vidéo pour toute la page : deux <video> partageant une même
  // référence détachaient le flux au changement d'écran.
  const enAppelApercu = phase === "jury-reflechit" || phase === "jury-parle" || phase === "ecoute";
  const apercu = (
    <div className={`appel-video${camera.etat === "active" ? " visible" : ""}${enAppelApercu ? "" : " appel-video-lanceur"}`}>
      <video
        ref={(el) => {
          videoRef.current = el;
          camera.attacher(el);
        }}
        muted
        playsInline
        aria-label="Aperçu de ta caméra"
      />
      <span className="appel-video-etat">{camera.etat === "chargement" ? "Caméra…" : "Sur ton appareil"}</span>
    </div>
  );
  const mm = Math.floor(ecouleS / 60);
  const ss = String(ecouleS % 60).padStart(2, "0");
  const enAppel = phase === "jury-reflechit" || phase === "jury-parle" || phase === "ecoute";

  if (phase === "fini" || phase === "debrief") {
    return <DebriefAppel phase={phase} debrief={debrief} erreur={erreur} historique={historique} persona={p} dureeS={ecouleS} sessionId={sessionId} camera={bilanCamera} grille={evaluation} onRecommencer={() => setPhase("idle")} />;
  }

  if (!enAppel) {
    return (
      <div className="card lanceur appel-lanceur">
        {apercu}
        {!supporte.micro && (
          <div className="warn" role="alert">
            La reconnaissance vocale n&apos;est pas disponible dans ce navigateur. Utilise Chrome ou Edge pour parler au jury.
          </div>
        )}
        {erreur && (
          <div className="warn" role="alert">
            {erreur}
          </div>
        )}
        {actifs.length > 1 && (
          <fieldset className="formats">
            <legend>
              <Icone nom="fiches" taille={14} /> Quel oral ?
            </legend>
            {actifs.map((m) => (
              <button key={m} type="button" className={`format-btn${mode === m ? " active" : ""}`} aria-pressed={mode === m} onClick={() => setMode(m)}>
                <Icone nom={m} /> {PERSONAS[m].nom}
              </button>
            ))}
          </fieldset>
        )}
        <fieldset className="formats">
          <legend>
            <Icone nom="horloge" taille={14} /> Durée de l&apos;appel
          </legend>
          {DUREES_APPEL.map((d) => (
            <button key={d} type="button" className={`format-btn${dureeMin === d ? " active" : ""}`} aria-pressed={dureeMin === d} onClick={() => setDureeMin(d)}>
              {d} min
            </button>
          ))}
        </fieldset>
        <fieldset className="formats">
          <legend>
            <Icone nom="parole" taille={14} /> Langue
          </legend>
          {(["fr", "en"] as const).map((l) => (
            <button key={l} type="button" className={`format-btn${langue === l ? " active" : ""}`} aria-pressed={langue === l} onClick={() => setLangue(l)}>
              {l === "fr" ? "Français" : "English"}
            </button>
          ))}
        </fieldset>
        <label className="appel-camera-choix">
          <input type="checkbox" checked={cameraVoulue} onChange={(e) => setCameraVoulue(e.target.checked)} />
          <span>
            <b>Allumer la caméra</b>
            <small>Regard, tenue de tête, visage ouvert — analysés sur ton appareil. L&apos;image n&apos;est ni envoyée, ni enregistrée.</small>
          </span>
        </label>
        <div className="appel-contexte">
          <IconeBadge nom={contexte ? "valide" : "alerte"} teinte={contexte ? "vert" : "or"} taille={32} />
          <span>
            {contexte ? (
              <>
                <b>Le {p.nom.toLowerCase()} connaît ton dossier</b>
                <small>{Math.round(contexte.length / 1000)} k caractères : il posera des questions précises sur ce que tu as déposé.</small>
              </>
            ) : (
              <>
                <b>Aucun dossier pour cet oral</b>
                <small>Il posera des questions générales. Dépose tes slides, ton CV ou ton dossier dans le module pour des questions sur ton projet.</small>
              </>
            )}
          </span>
        </div>
        <button className="btn primary big lanceur-btn" onClick={() => void demarrer()} disabled={!supporte.micro}>
          <Icone nom="micro" /> Lancer l&apos;appel avec le {p.nom.toLowerCase()}
        </button>
        <p className="lanceur-note">
          Il parle, tu réponds, il rebondit. Quand tu as fini de répondre, tais-toi deux secondes — ou appuie sur « J&apos;ai fini ». Un appel compte pour un seul appel IA sur ton quota, plus un pour le débrief.
        </p>
      </div>
    );
  }

  return (
    <div className="appel">
      <div className={`card appel-ecran appel-${phase}`}>
        <div className="appel-tete">
          <span className="appel-chrono">
            <span className="rec-dot" aria-hidden="true" /> {mm}:{ss} <small>/ {dureeMin}:00</small>
          </span>
          <span className="session-meta">{p.nom} · en direct</span>
        </div>
        {apercu}
        <div className="appel-avatar-zone">
          <div className={`appel-avatar${phase === "jury-parle" ? " parle" : phase === "jury-reflechit" ? " reflechit" : ""}`}>
            <Icone nom={mode} taille={40} />
          </div>
          <p className="appel-etat" aria-live="polite">
            {phase === "jury-reflechit" && "Le jury réfléchit…"}
            {phase === "jury-parle" && "Le jury parle — écoute."}
            {phase === "ecoute" && "À toi. Il t'écoute."}
          </p>
        </div>
        <div className="appel-dialogue" aria-label="Échange">
          {historique.slice(-6).map((m, i) => (
            <p key={i} className={`appel-bulle appel-bulle-${m.role}`}>
              {m.role === "assistant" && m.membre && <span className="appel-qui">{membreParId(mode, m.membre).nom}</span>}
              {m.content}
            </p>
          ))}
          {phase === "ecoute" && (interim || finalRef.current) && (
            <p className="appel-bulle appel-bulle-user appel-bulle-interim">
              {finalRef.current} <i>{interim}</i>
            </p>
          )}
        </div>
        <div className="actions appel-actions">
          {phase === "ecoute" && (
            <button className="btn primary" onClick={() => finirReponseRef.current()}>
              <Icone nom="check" /> J&apos;ai fini ma réponse
            </button>
          )}
          <button className="btn danger" onClick={() => void terminerAppel(historiqueRef.current)}>
            <Icone nom="stop" /> Raccrocher
          </button>
        </div>
        {erreur && <p className="warn">{erreur}</p>}
      </div>
      <p className="report-note">
        Rien n&apos;est enregistré en audio. Le texte de l&apos;échange est envoyé à l&apos;IA pour que le jury te réponde, puis pour le débrief.{" "}
        <Link href="/confidentialite">Confidentialité</Link>
      </p>
    </div>
  );
}
