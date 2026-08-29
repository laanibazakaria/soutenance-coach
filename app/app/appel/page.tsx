"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Icone, IconeBadge } from "@/app/components/Icone";
import { useToast } from "@/app/components/Toast";
import { PERSONAS, DUREES_APPEL, MEMBRES, membreParId, assemblerContexte, paroleCandidat, type ModeAppel, type Message, type Debrief } from "@/lib/appel";
import { listeDeckSauvegarde } from "@/lib/slides/persistance";
import { lireCache, ecrireCache, empreinte } from "@/lib/ia-cache";
import { lireCandidature } from "@/lib/entretien/persistance";
import { estRapport } from "@/lib/rapport";
import { lireLangue, courte, type LangueCourte } from "@/lib/langue";
import { lireProfilEtudiant, ligneContexteEtudiant } from "@/lib/etudiant";
import { lireModulesActifs } from "@/lib/preferences";
import { saveSession, countWords } from "@/lib/storage";
import { pousserTout, signalerSynchronisation } from "@/lib/sync/client";
import { signalerAppelIa } from "@/lib/usage-client";
import { voixDisponible, meilleureVoix, voixParTimbre, parler, taire, voixNavigateurExcellente, parlerNaturel, taireNaturel, deverrouillerAudio, type VoixMembre } from "@/lib/voix";
import { segmentsPreferes, noterSegmentsPreferes } from "@/lib/dictee";
import { CLE_RAPPORT } from "../components/RapportView";
import { useEcouteSegments } from "../hooks/useEcouteSegments";
import { passagesPour } from "@/lib/memoire/client";
import { contexteFiche, dossierSuffisant, DOSSIER_MAX, type FicheLecture } from "@/lib/appel/lecture";
import { derniereRelecture, formaterPourJury } from "@/lib/dossier/pour-jury";
import { lireSouvenirs, formaterSouvenirs, type Souvenirs } from "@/lib/appel/souvenirs";
import type { Evaluation } from "@/lib/grille";
import { mesuresPourGrille } from "@/lib/grille/mesures";
import DebriefAppel from "./DebriefAppel";

/** Une fiche de lecture par dossier : si le dossier change, le jury relit. */
function cleFiche(mode: ModeAppel, dossier: string): string {
  return `appel-lecture:${mode}:${empreinte(dossier)}`;
}

type Phase = "idle" | "jury-reflechit" | "jury-parle" | "ecoute" | "debrief" | "fini";

const MODES: ModeAppel[] = ["soutenance", "entretien"];
const SILENCE_MS = 2600;
/** Deux réponses vides d'affilée : on propose une sortie, sans présumer pourquoi. */
const SILENCES_AVANT_ALERTE = 2;
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
      // Les notes du rapporteur : la relecture croisée entre dans ce que le jury
      // sait. Il attaque là où le dossier est faible, au lieu de le redécouvrir.
      { titre: "Notes du rapporteur", texte: formaterPourJury(derniereRelecture(st)) || null },
    ]));
  }
  if (mode === "entretien") {
    const c = lireCandidature(st);
    return avec(c ? assemblerContexte([{ titre: `Poste visé : ${c.poste}${c.entreprise ? ` chez ${c.entreprise}` : ""}`, texte: c.offre }, { titre: "CV du candidat", texte: c.cvTexte }]) : "");
  }
  return "";
}

/**
 * Dire la taille d'un dossier en pages, pas en caractères : « environ 42 pages »
 * parle à qui a déposé un mémoire ; « 96 k caractères » ne parle à personne.
 * Deux mille signes la page, la mesure courante d'un texte académique.
 */
function mesurerDossier(dossier: string): string {
  const pages = Math.max(1, Math.round(dossier.length / 2000));
  return `Environ ${pages} page${pages > 1 ? "s" : ""}`;
}

/**
 * Le dossier complet, pour la lecture : les diapositives en entier et le
 * mémoire jusqu à 60 000 caractères. Le contexte des tours reste court (la
 * latence compte à chaque question) ; la lecture, elle, a le temps.
 */
function dossierCompletPourLecture(mode: ModeAppel): string {
  const st = window.localStorage;
  if (mode === "soutenance") {
    const deck = listeDeckSauvegarde(st);
    const rapport = lireCache<unknown>(st, CLE_RAPPORT);
    return assemblerContexte(
      [
        { titre: "Diapositives de la soutenance", texte: deck ? deck.slides.map((x, i) => `[${i + 1}] ${x.texte}`).join("\n") : null },
        { titre: "Mémoire déposé", texte: estRapport(rapport) ? rapport.texte : null },
        { titre: "Notes du rapporteur (relecture croisée)", texte: formaterPourJury(derniereRelecture(st)) || null },
      ],
      DOSSIER_MAX,
    );
  }
  if (mode === "entretien") {
    const c = lireCandidature(st);
    return c
      ? assemblerContexte(
          [
            { titre: `Poste visé : ${c.poste}${c.entreprise ? ` chez ${c.entreprise}` : ""}`, texte: c.offre },
            { titre: "CV du candidat", texte: c.cvTexte },
          ],
          DOSSIER_MAX,
        )
      : "";
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

  // On marque le document plutôt que de faire descendre un drapeau jusqu'au
  // bandeau, qui vit dans la mise en page et ne connaît pas cette page.
  useEffect(() => {
    const enCours = phase !== "idle" && phase !== "debrief";
    document.body.classList.toggle("appel-en-cours", enCours);
    return () => document.body.classList.remove("appel-en-cours");
  }, [phase]);
  const [historique, setHistorique] = useState<Message[]>([]);
  const dernierMembre = [...historique].reverse().find((m) => m.role === "assistant" && m.membre)?.membre;
  const membreCourant = dernierMembre ? membreParId(mode, dernierMembre) : null;
  const [interim, setInterim] = useState("");
  const [ecouleS, setEcouleS] = useState(0);
  const [supporte, setSupporte] = useState({ micro: true, voix: true });
  const [contexte, setContexte] = useState("");
  const [tailleDossier, setTailleDossier] = useState("");
  /** La mémoire du jury : ce qu'il retient des appels précédents de ce candidat. */
  const [souvenirs, setSouvenirs] = useState<Souvenirs | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [debrief, setDebrief] = useState<Debrief | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  /** Voix naturelle de l'API quand le navigateur n'a rien de bon (décidé au lancement). */
  const [voixNaturelle, setVoixNaturelle] = useState(false);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  /** Ce que le jury a compris du dossier : lu une fois, gardé tant que le dossier ne change pas. */
  const [fiche, setFiche] = useState<FicheLecture | null>(null);
  const [lecture, setLecture] = useState(false);
  /** Ce que le jury a réellement lu : on le montre, plutôt que de le laisser croire. */
  const [lu, setLu] = useState<{ passes: number; total: number; caracteres: number } | null>(null);
  const evaluationRef = useRef<Evaluation | null>(null);

  const voixRef = useRef<SpeechSynthesisVoice | null>(null);
  /** Une voix par membre du jury : sinon tout le monde parle pareil. */
  const voixMembresRef = useRef<Record<string, VoixMembre> | null>(null);
  const recRef = useRef<SpeechRecognition | null>(null);
  const finalRef = useRef("");
  const silenceRef = useRef<number | null>(null);
  const silencesRef = useRef(0);
  /** Les deux voix muettes : on prévient une seule fois, l'appel continue par écrit. */
  const voixMuettesRef = useRef(false);
  /** Reconnaissance native en échec (iPhone, WebView) : on force le repli Whisper. */
  const segmentsForcesRef = useRef(false);
  const redemarragesRef = useRef(0);
  const [muet, setMuet] = useState(false);
  const maxRef = useRef<number | null>(null);
  const debutRef = useRef(0);
  const arreteRef = useRef(false);
  const historiqueRef = useRef<Message[]>([]);
  const finirReponseRef = useRef<() => void>(() => {});
  const segments = useEcouteSegments();
  /** Questions posées lors des appels précédents : le jury ne se répète pas d un appel à l autre. */
  const dejaPoseesRef = useRef<string[]>([]);
  const ficheRef = useRef<FicheLecture | null>(null);

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
    const c = contexteDepuisAppareil(mode);
    setTailleDossier(mesurerDossier(dossierCompletPourLecture(mode)));
    setContexte(c);
    setFiche(c ? lireCache<FicheLecture>(window.localStorage, cleFiche(mode, c)) : null);
    setSouvenirs(lireSouvenirs(window.localStorage, mode));
  }, [mode]);

  useEffect(() => {
    ficheRef.current = fiche;
  }, [fiche]);

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
      setPhase("debrief");
      const dureeMs = Date.now() - debutRef.current;
      const id = crypto.randomUUID();
      const parole = paroleCandidat(hist);
      saveSession(window.localStorage, { id, startedAt: new Date(debutRef.current).toISOString(), durationMs: dureeMs, transcript: parole, wordCount: countWords(parole), mode });
      setSessionId(id);
      try {
        const r = await fetch("/api/appel/debrief", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ mode, contexte, langue, dureeMin, historique: hist, mesures: mesuresPourGrille(parole, dureeMs), souvenirs: formaterSouvenirs(souvenirs) || undefined }),
        });
        const j = (await r.json()) as { debrief?: Debrief; evaluation?: Evaluation | null; erreur?: string };
        if (!r.ok || !j.debrief) throw new Error(j.erreur ?? "Débrief indisponible.");
        signalerAppelIa();
        evaluationRef.current = j.evaluation ?? null;
        setEvaluation(evaluationRef.current);
        ecrireCache(window.localStorage, `appel:${id}`, { mode, dureeMin, dialogue: hist, debrief: j.debrief, grille: evaluationRef.current, date: new Date().toISOString() });
        setDebrief(j.debrief);
      } catch (e) {
        ecrireCache(window.localStorage, `appel:${id}`, { mode, dureeMin, dialogue: hist, debrief: null, grille: null, date: new Date().toISOString() });
        setErreur(e instanceof Error ? e.message : "Débrief indisponible.");
      }
      signalerSynchronisation();
      void pousserTout();
      setPhase("fini");
    },
    [contexte, dureeMin, langue, mode, nettoyerEcoute, toast],
  );

  /** Le jury lit le dossier — une fois par dossier, mis en cache. */
  const lireDossier = useCallback(async (): Promise<FicheLecture | null> => {
    const deja = lireCache<FicheLecture>(window.localStorage, cleFiche(mode, contexte));
    if (deja) {
      setFiche(deja);
      return deja;
    }
    setLecture(true);
    setErreur(null);
    try {
      const r = await fetch("/api/appel/lecture", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode, dossier: dossierCompletPourLecture(mode) || contexte }) });
      const j = (await r.json()) as { fiche?: FicheLecture; passes?: number; surTotal?: number; caracteres?: number; erreur?: string };
      if (!r.ok || !j.fiche) throw new Error(j.erreur ?? "La lecture n'a rien donné.");
      ecrireCache(window.localStorage, cleFiche(mode, contexte), j.fiche);
      signalerAppelIa();
      setFiche(j.fiche);
      if (typeof j.passes === "number" && typeof j.surTotal === "number") {
        setLu({ passes: j.passes, total: j.surTotal, caracteres: j.caracteres ?? 0 });
      }
      return j.fiche;
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "La lecture du dossier a échoué.");
      return null;
    } finally {
      setLecture(false);
    }
  }, [contexte, mode]);

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
      const notes = contexteFiche(ficheRef.current);
      const contexteComplet = [contexte, notes, extraits].filter(Boolean).join("\n\n");
      try {
        const r = await fetch("/api/appel/tour", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode, contexte: contexteComplet, langue, dureeMin, ecouleS: Math.round((Date.now() - debutRef.current) / 1000), historique: hist, dejaPosees: dejaPoseesRef.current, souvenirs: formaterSouvenirs(souvenirs) || undefined }) });
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
      const timbre = membreParId(mode, membre).voix;
      if (voixNaturelle) dit = await parlerNaturel(replique, langue, timbre);
      if (!dit && !arreteRef.current && supporte.voix) {
        const v = voixMembresRef.current?.[timbre];
        dit = await parler(replique, langue, v?.voix ?? voixRef.current, { debit: v?.debit ?? 1.02, hauteur: v?.hauteur });
        // Sur certains Android, la synthèse du navigateur est cassée
        // (« synthesis-failed ») alors que la voix du serveur marche : elle
        // prend le relais, pour cette réplique et tout le reste de l'appel.
        if (!dit && !arreteRef.current && !voixNaturelle) {
          dit = await parlerNaturel(replique, langue, timbre);
          if (dit) setVoixNaturelle(true);
        }
      }
      if (!dit && !arreteRef.current) {
        if (!voixMuettesRef.current) {
          voixMuettesRef.current = true;
          toast.info("Aucune voix ne sort sur cet appareil — l'appel continue par écrit, lis les questions à l'écran.");
        }
        await new Promise((r) => setTimeout(r, Math.min(8000, 800 + replique.length * 45)));
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
    redemarragesRef.current = 0;
    if (!Ctor || segmentsForcesRef.current || segmentsPreferes()) {
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
      if (texte) {
        silencesRef.current = 0;
        setMuet(false);
      } else {
        silencesRef.current += 1;
      }
      // Deux blancs de suite : on le signale pendant l'appel plutôt qu'au
      // débrief. Micro coupé ou candidat bloqué, la suite est la même — le jury
      // ne doit pas continuer à empiler des questions dans le vide.
      if (silencesRef.current >= SILENCES_AVANT_ALERTE) setMuet(true);
      const nouveau: Message[] = texte ? [...hist, { role: "user", content: texte }] : [...hist, { role: "user", content: "(silence)" }];
      historiqueRef.current = nouveau;
      setHistorique(nouveau);
      void tourDuJury(nouveau);
    };
    finirReponseRef.current = finir;

    // Sur iPhone et dans certaines WebViews, la reconnaissance native EXISTE
    // mais échoue à l'exécution — sans cette bascule, l'appel restait muet.
    const basculerSurWhisper = () => {
      if (segmentsForcesRef.current || recRef.current !== rec) return;
      segmentsForcesRef.current = true;
      noterSegmentsPreferes();
      nettoyerEcoute();
      toast.info("Ton navigateur ne transcrit pas lui-même : la transcription passe par le serveur.");
      ecouter(hist);
    };

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
        redemarragesRef.current += 1;
        // Des fins en rafale sans le moindre mot : le service ne marche pas
        // vraiment ici — on passe au repli plutôt que de mouliner en silence.
        if (redemarragesRef.current > 4 && finalRef.current.trim() === "") {
          basculerSurWhisper();
          return;
        }
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
        return;
      }
      // Service indisponible, réseau, langue : la permission est bonne mais le
      // service natif ne rend rien — le repli Whisper prend la suite.
      if (ev.error === "service-not-allowed" || ev.error === "network" || ev.error === "language-not-supported") {
        basculerSurWhisper();
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
    // DANS le geste, avant tout await : les mobiles ne déverrouillent l'audio
    // que pendant un geste utilisateur — après, il est trop tard.
    deverrouillerAudio();
    setErreur(null);
    setDebrief(null);
    setSessionId(null);
    setHistorique([]);
    historiqueRef.current = [];
    arreteRef.current = false;
    debutRef.current = Date.now();
    setEcouleS(0);
    if (supporte.voix) {
      voixRef.current = await meilleureVoix(langue);
      voixMembresRef.current = await voixParTimbre(langue);
    }
    setVoixNaturelle(!voixNavigateurExcellente(voixRef.current));
    // Un premier « parler » vide débloque la synthèse vocale sur mobile (geste utilisateur requis).
    if (supporte.voix) await parler(" ", langue, voixRef.current);
    // Le jury lit le dossier avant de parler — c'est la promesse du bouton, et
    // elle n'avait JAMAIS été branchée : toute la machinerie de lecture
    // existait sans que rien ne l'appelle. Une fois par dossier, grâce au
    // cache ; en cas d'échec, l'erreur s'affiche et on ne fait pas semblant.
    const f = await lireDossier();
    if (!f) return;
    await tourDuJury([]);
  }

  useEffect(() => () => {
    arreteRef.current = true;
    nettoyerEcoute();
    taire();
    taireNaturel();
  }, [nettoyerEcoute]);

  const p = PERSONAS[mode];
  const mm = Math.floor(ecouleS / 60);
  const ss = String(ecouleS % 60).padStart(2, "0");
  const enAppel = phase === "jury-reflechit" || phase === "jury-parle" || phase === "ecoute";
  /** Un jury n interroge pas à l aveugle : sans dossier, pas d appel. */
  const pret = dossierSuffisant(contexte);
  const lienDossier = mode === "soutenance" ? "/app/soutenance" : mode === "entretien" ? "/app/entretien" : `/app/m/${mode}`;

  if (phase === "fini" || phase === "debrief") {
    return <DebriefAppel phase={phase} debrief={debrief} erreur={erreur} historique={historique} persona={p} dureeS={ecouleS} sessionId={sessionId} grille={evaluation} onRecommencer={() => setPhase("idle")} />;
  }

  if (!enAppel) {
    return (
      <div className="card lanceur appel-lanceur">
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
        {souvenirs && souvenirs.questionsRatees.length > 0 && (
          <p className="appel-memoire">
            <Icone nom="jour" /> <b>Le jury se souvient de ton dernier appel.</b> Il t&apos;attend
            sur : <em>« {souvenirs.questionsRatees[0]!.question} »</em>
          </p>
        )}
        <div className="appel-contexte">
          <IconeBadge nom={pret ? "valide" : "alerte"} teinte={pret ? "vert" : "or"} taille={32} />
          <span>
            {pret ? (
              <>
                <b>Le {p.nom.toLowerCase()} a ton dossier</b>
                <small>{tailleDossier} dans ton dossier — il les lit en entier, ligne à ligne, avant de te parler.</small>
              </>
            ) : (
              <>
                <b>Dépose ton dossier d&apos;abord</b>
                <small>Un jury n&apos;interroge pas à l&apos;aveugle. Dépose tes diapositives et ton mémoire (ou ton CV et l&apos;offre) : il les lira avant l&apos;appel.</small>
              </>
            )}
          </span>
        </div>

        {fiche && (
          <div className="appel-fiche">
            <span className="carte-titre">
              <Icone nom="memoire" taille={15} /> Ce que le jury a compris de ton dossier
            </span>
            {lu && (
              <p className={`appel-fiche-lu${lu.passes < lu.total ? " partiel" : ""}`}>
                {lu.passes < lu.total
                  ? `${lu.passes} partie${lu.passes > 1 ? "s" : ""} sur ${lu.total} lues — une partie n’a pas pu être analysée. Relance la lecture pour la compléter.`
                  : `Lu en entier : ${Math.round(lu.caracteres / 1800)} pages, en ${lu.passes} passe${lu.passes > 1 ? "s" : ""}.`}
              </p>
            )}
            {fiche.sujet && <p className="appel-fiche-sujet">{fiche.sujet}</p>}
            {fiche.angles.length > 0 && (
              <>
                <b>Ce qu&apos;il compte creuser</b>
                <ol>
                  {fiche.angles.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ol>
              </>
            )}
            {fiche.fragilites.length > 0 && (
              <>
                <b>Les fragilités qu&apos;il a repérées</b>
                <ul>
                  {fiche.fragilites.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </>
            )}
            <p className="report-note a-gauche">
              Tu vois ses notes avant lui : c&apos;est fait exprès. Travaille ces points — il n&apos;ira pas poser exactement ces questions, mais il ira par là.
            </p>
          </div>
        )}

        {pret ? (
          <button className="btn primary big lanceur-btn" onClick={() => void demarrer()} disabled={!supporte.micro || lecture}>
            {lecture ? (
              "Le jury lit ton dossier…"
            ) : (
              <>
                <Icone nom="micro" /> {fiche ? `Lancer l'appel avec le ${p.nom.toLowerCase()}` : "Faire lire mon dossier, puis lancer l'appel"}
              </>
            )}
          </button>
        ) : (
          <Link href={lienDossier} className="btn primary big lanceur-btn">
            <Icone nom="memoire" /> Déposer mon dossier
          </Link>
        )}
        <p className="lanceur-note">
          Il parle, tu réponds, il rebondit. Quand tu as fini de répondre, tais-toi deux secondes — ou appuie sur « J&apos;ai fini ». Un appel consomme trois unités de ton quota : la lecture de ton dossier — une seule fois, tant que tu n'en changes pas —, le lancement, puis le débrief et la grille ensemble. Les questions suivantes sont gratuites.
        </p>
        {mode === "soutenance" && (
        <p className="report-note">
          L&apos;appel ne travaille que les questions. Pour rejouer l&apos;oral entier, ton exposé
          chronométré compris, passe par <Link href="/app/soutenance-blanche">la soutenance blanche</Link>.
        </p>
        )}
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
        <div className="appel-avatar-zone">
          <div className={`appel-avatar${phase === "jury-parle" ? " parle" : phase === "jury-reflechit" ? " reflechit" : ""}`}>
            <Icone nom={mode} taille={40} />
          </div>
          {membreCourant && <p className="appel-membre">{membreCourant.nom}</p>}
          <p className="appel-etat" aria-live="polite">
            {phase === "jury-reflechit" && "Le jury réfléchit…"}
            {phase === "jury-parle" && `${membreCourant?.nom ?? "Le jury"} parle — écoute.`}
            {phase === "ecoute" && `À toi. ${membreCourant?.nom ?? "Le jury"} t'écoute.`}
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
          {muet && (
            <p className="appel-muet" role="status">
              Rien n&apos;a été capté depuis {silencesRef.current} questions. Vérifie que ton micro
              est autorisé — ou raccroche et reprends quand tu es prêt.
            </p>
          )}
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
