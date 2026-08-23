"use client";

import { useState } from "react";
import { LIBELLES_TYPE_ORAL, type TypeOral } from "@/lib/retours";
import { useToast } from "@/app/components/Toast";
import { Icone } from "@/app/components/Icone";

/** Après l'oral : « comment ça s'est passé ? » — les vraies questions, pour les suivants. */
export default function RetourOralForm({ type, ecoleInitiale = "", niveauInitial = "" }: { type: TypeOral; ecoleInitiale?: string; niveauInitial?: string }) {
  const cle = `sc.retour-oral.${type}`;
  const [fait, setFait] = useState(() => typeof window !== "undefined" && window.localStorage.getItem(cle) === "1");
  const [ouvert, setOuvert] = useState(false);
  const [ecole, setEcole] = useState(ecoleInitiale);
  const [filiere, setFiliere] = useState("");
  const [niveau, setNiveau] = useState(niveauInitial);
  const [questions, setQuestions] = useState("");
  const [ressenti, setRessenti] = useState("");
  const [conseil, setConseil] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const toast = useToast();

  async function envoyer(ev: React.FormEvent) {
    ev.preventDefault();
    setEnvoi(true);
    try {
      const res = await fetch("/api/retours", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type, ecole, filiere, niveau, annee: new Date().getFullYear(), questions, ressenti, conseil }) });
      const j = (await res.json()) as { ok?: boolean; erreur?: string };
      if (res.ok && j.ok) {
        window.localStorage.setItem(cle, "1");
        setFait(true);
        toast.success("Merci. Tes questions aideront les suivants — après relecture.");
      } else toast.error(j.erreur ?? "L'envoi a échoué.");
    } catch {
      toast.error("Le serveur est injoignable.");
    } finally {
      setEnvoi(false);
    }
  }

  if (fait) return <p className="forfait-ok">✓ Merci d&apos;avoir raconté ton oral : tes questions rejoindront les vraies questions des jurys.</p>;

  return (
    <div className="retour-oral">
      {!ouvert ? (
        <div className="actions" style={{ justifyContent: "flex-start" }}>
          <button className="btn primary" onClick={() => setOuvert(true)}>
            <Icone nom="parole" /> Comment ça s&apos;est passé ? Raconte les vraies questions
          </button>
          <span className="session-meta">Anonyme · 2 minutes · ça aide tous les suivants</span>
        </div>
      ) : (
        <form className="parcours-champs" onSubmit={envoyer}>
          <p className="session-meta">{LIBELLES_TYPE_ORAL[type]} — anonyme, relu avant publication. Aucun nom, aucune note : seulement ce qui aide les suivants.</p>
          <div className="champs-ligne">
            <label className="champ"><span>École / organisme</span><input value={ecole} onChange={(e) => setEcole(e.target.value)} placeholder="ENSIAS" maxLength={80} /></label>
            <label className="champ"><span>Filière / poste</span><input value={filiere} onChange={(e) => setFiliere(e.target.value)} placeholder="IA, Génie logiciel, Data…" maxLength={80} /></label>
            <label className="champ"><span>Niveau</span><input value={niveau} onChange={(e) => setNiveau(e.target.value)} placeholder="PFA, PFE, thèse, M2…" maxLength={80} /></label>
          </div>
          <label className="champ champ-large">
            <span>Les questions qu&apos;on t&apos;a vraiment posées — une par ligne *</span>
            <textarea value={questions} onChange={(e) => setQuestions(e.target.value)} rows={6} required placeholder={"Pourquoi avoir choisi cette métrique ?\nQue feriez-vous avec plus de temps ?\n…"} />
          </label>
          <div className="champs-ligne">
            <label className="champ champ-large"><span>Comment tu l&apos;as vécu (facultatif)</span><textarea value={ressenti} onChange={(e) => setRessenti(e.target.value)} rows={2} maxLength={600} placeholder="Le jury était bienveillant mais précis sur les chiffres…" /></label>
            <label className="champ champ-large"><span>Un conseil pour les suivants (facultatif)</span><textarea value={conseil} onChange={(e) => setConseil(e.target.value)} rows={2} maxLength={600} placeholder="Connais tes chiffres par cœur…" /></label>
          </div>
          <div className="actions" style={{ justifyContent: "flex-start" }}>
            <button type="button" className="btn" onClick={() => setOuvert(false)}>Plus tard</button>
            <button className="btn primary" disabled={envoi || questions.trim().length < 12}>{envoi ? "Envoi…" : "Envoyer"}</button>
          </div>
        </form>
      )}
    </div>
  );
}
