"use client";

import { useEffect, useState } from "react";
import type { SeanceAmi } from "@/lib/ami";
import { Icone } from "@/app/components/Icone";

type Ligne = { clair: boolean; complet: boolean; convaincant: boolean; remarque: string };

/** L'ami joue le jury : une question à la fois, un chrono, trois cases, une remarque. */
export default function AmiJury({ id, seance }: { id: string; seance: SeanceAmi }) {
  const [index, setIndex] = useState(-1);
  const [lignes, setLignes] = useState<Ligne[]>(() => seance.questions.map(() => ({ clair: false, complet: false, convaincant: false, remarque: "" })));
  const [attenduVisible, setAttenduVisible] = useState(false);
  const [chrono, setChrono] = useState<number | null>(null);
  const [nom, setNom] = useState("");
  const [commentaire, setCommentaire] = useState("");
  const [envoi, setEnvoi] = useState<"idle" | "en-cours" | "fait" | "erreur">("idle");

  useEffect(() => {
    if (chrono === null) return;
    const t = setInterval(() => setChrono((c) => (c === null ? null : c + 1)), 1000);
    return () => clearInterval(t);
  }, [chrono]);

  const q = seance.questions[index];
  const fini = index >= seance.questions.length;

  function maj(i: number, patch: Partial<Ligne>) {
    setLignes((l) => l.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  }

  async function envoyer() {
    setEnvoi("en-cours");
    try {
      const res = await fetch(`/api/ami/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ nom, commentaire, reponses: lignes }) });
      setEnvoi(res.ok ? "fait" : "erreur");
    } catch {
      setEnvoi("erreur");
    }
  }

  if (index === -1) {
    return (
      <div className="card ami-intro">
        <span className="question-cat">Tu es le jury</span>
        <h1 style={{ fontSize: "1.5rem", margin: "6px 0 10px" }}>{seance.titre}</h1>
        <p>
          Ton ami prépare un oral et te demande de jouer le <b>{seance.persona.toLowerCase()}</b>. Tu vas lui poser <b>{seance.questions.length} questions</b>, une par une. Pour chacune, tu as ce qu&apos;un bon jury cherche à vérifier — et tu coches ce que tu as entendu.
        </p>
        <ol className="guide-liste" style={{ marginTop: 10 }}>
          <li>Lis la question à voix haute, exactement comme elle est écrite.</li>
          <li>Laisse-le répondre sans l&apos;interrompre — environ {seance.dureeS} secondes. Le chrono t&apos;aide.</li>
          <li>Coche : <b>clair</b> (tu as compris), <b>complet</b> (il a répondu à la question, pas à côté), <b>convaincant</b> (tu l&apos;as cru). Une remarque si tu veux.</li>
          <li>Si ce qu&apos;une bonne réponse contient t&apos;aide, affiche-le — mais après sa réponse.</li>
        </ol>
        <div className="actions">
          <button className="btn primary big" onClick={() => { setIndex(0); setChrono(0); }}>
            Commencer
          </button>
        </div>
        <p className="report-note">Aucun compte, rien n&apos;est enregistré sur toi. Ton retour est envoyé à ton ami, et c&apos;est tout.</p>
      </div>
    );
  }

  if (fini) {
    return (
      <div className="card">
        <h2 style={{ marginBottom: 8 }}>Merci — dernière étape</h2>
        {envoi === "fait" ? (
          <p className="forfait-ok">✓ Ton retour est envoyé. Ton ami le verra dans sa préparation.</p>
        ) : (
          <>
            <label className="champ">
              <span>Ton prénom (facultatif)</span>
              <input value={nom} onChange={(e) => setNom(e.target.value)} maxLength={40} placeholder="Sara" />
            </label>
            <label className="champ champ-large" style={{ marginTop: 10 }}>
              <span>Un conseil général, en une ou deux phrases (facultatif)</span>
              <textarea value={commentaire} onChange={(e) => setCommentaire(e.target.value)} rows={3} maxLength={800} placeholder="Ce qui t'a marqué, ce qu'il devrait travailler en priorité…" />
            </label>
            {envoi === "erreur" && <p className="warn" role="alert" style={{ marginTop: 10 }}>L&apos;envoi a échoué. Réessaie.</p>}
            <div className="actions">
              <button className="btn primary big" onClick={() => void envoyer()} disabled={envoi === "en-cours"}>
                {envoi === "en-cours" ? "Envoi…" : "Envoyer mon retour"}
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  const l = lignes[index];
  const depasse = chrono !== null && chrono > seance.dureeS;
  return (
    <div className="ami">
      <div className="blanche-bandeau">
        <span className="question-cat">Question {index + 1} sur {seance.questions.length}</span>
        <span className={`ami-chrono${depasse ? " ami-chrono-depasse" : ""}`}>⏱ {chrono ?? 0} s{depasse ? " — tu peux l'arrêter" : ""}</span>
      </div>
      <article className="card question-posee">
        <p className="question-grande">{q.question}</p>
        {q.pourquoi && <p className="question-pourquoi"><Icone nom="recherche" /> Ce que tu vérifies : {q.pourquoi}</p>}
        {q.attendu && (
          <p className="question-pourquoi">
            {attenduVisible ? (
              <>
                <b>Une bonne réponse :</b> {q.attendu}
              </>
            ) : (
              <button className="link-btn" onClick={() => setAttenduVisible(true)}>
                Voir ce qu&apos;une bonne réponse contient (après sa réponse)
              </button>
            )}
          </p>
        )}
      </article>
      <div className="card ami-cases">
        <label><input type="checkbox" checked={l.clair} onChange={(e) => maj(index, { clair: e.target.checked })} /> Clair — j&apos;ai compris</label>
        <label><input type="checkbox" checked={l.complet} onChange={(e) => maj(index, { complet: e.target.checked })} /> Complet — il a répondu à la question</label>
        <label><input type="checkbox" checked={l.convaincant} onChange={(e) => maj(index, { convaincant: e.target.checked })} /> Convaincant — je l&apos;ai cru</label>
        <label className="champ champ-large" style={{ marginTop: 8 }}>
          <span>Une remarque (facultatif)</span>
          <input value={l.remarque} onChange={(e) => maj(index, { remarque: e.target.value })} maxLength={400} placeholder="Trop long, manque le chiffre, regarde ses notes…" />
        </label>
      </div>
      <div className="actions">
        <button className="btn primary big" onClick={() => { setIndex(index + 1); setChrono(0); setAttenduVisible(false); }}>
          {index + 1 < seance.questions.length ? "Question suivante →" : "Terminer →"}
        </button>
      </div>
    </div>
  );
}
