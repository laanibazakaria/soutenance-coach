"use client";

import { useEffect, useState } from "react";
import { synthese, type QuestionAmi, type SeanceAmi } from "@/lib/ami";
import { useToast } from "@/app/components/Toast";
import { Icone } from "@/app/components/Icone";

interface Props {
  titre: string;
  persona: string;
  dureeS: number;
  /** Les questions à proposer à l'ami (spécifiques d'abord). */
  questions: QuestionAmi[];
  /** Clé locale où garder les liens créés, par module. */
  cle: string;
}

interface LienLocal {
  id: string;
  creeLe: string;
}

/** Répéter avec un ami : créer le lien, puis voir ses retours. */
export default function RepeterAvecAmi({ titre, persona, dureeS, questions, cle }: Props) {
  const [liens, setLiens] = useState<LienLocal[]>([]);
  const [seances, setSeances] = useState<Record<string, SeanceAmi>>({});
  const [creation, setCreation] = useState(false);
  const [ouvert, setOuvert] = useState(false);
  const toast = useToast();

  useEffect(() => {
    try {
      const l = JSON.parse(window.localStorage.getItem(cle) ?? "[]") as LienLocal[];
      setLiens(Array.isArray(l) ? l : []);
      l.forEach((x) =>
        fetch(`/api/ami/${x.id}`, { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null))
          .then((j: { seance?: SeanceAmi } | null) => j?.seance && setSeances((s) => ({ ...s, [x.id]: j.seance! })))
          .catch(() => {}),
      );
    } catch {
      setLiens([]);
    }
  }, [cle]);

  async function creer() {
    if (questions.length === 0) {
      toast.info("Génère d'abord des questions : l'ami doit avoir quoi te poser.");
      return;
    }
    setCreation(true);
    try {
      const res = await fetch("/api/ami", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ titre, persona, dureeS, questions: questions.slice(0, 8) }) });
      const j = (await res.json()) as { id?: string; erreur?: string };
      if (res.ok && j.id) {
        const l = [{ id: j.id, creeLe: new Date().toISOString() }, ...liens].slice(0, 5);
        window.localStorage.setItem(cle, JSON.stringify(l));
        setLiens(l);
        setOuvert(true);
        const url = `${window.location.origin}/ami/${j.id}`;
        try {
          await navigator.clipboard.writeText(url);
          toast.success("Lien créé et copié — envoie-le à ton ami.");
        } catch {
          toast.success("Lien créé.");
        }
      } else toast.error(j.erreur ?? "Le lien n'a pas pu être créé.");
    } catch {
      toast.error("Le serveur est injoignable.");
    } finally {
      setCreation(false);
    }
  }

  const nbRetours = liens.reduce((a, l) => a + (seances[l.id]?.retours.length ?? 0), 0);

  return (
    <section className="card ami-carte">
      <div className="list-head" style={{ margin: 0 }}>
        <div>
          <h2 className="list-title" style={{ margin: 0 }}>
            <Icone nom="amis" /> Répéter avec un ami
          </h2>
          <p className="session-meta">
            {nbRetours > 0 ? `${nbRetours} retour${nbRetours > 1 ? "s" : ""} reçu${nbRetours > 1 ? "s" : ""}` : "Un lien : il joue le jury, avec les bonnes questions et ce qu'une bonne réponse contient. Son retour revient ici."}
          </p>
        </div>
        <div className="list-actions">
          {liens.length > 0 && (
            <button className="btn small" onClick={() => setOuvert((v) => !v)}>
              {ouvert ? "Masquer" : "Voir les liens et retours"}
            </button>
          )}
          <button className="btn small primary" onClick={() => void creer()} disabled={creation}>
            {creation ? "Création…" : <><Icone nom="lien" /> Créer un lien pour un ami</>}
          </button>
        </div>
      </div>
      {ouvert && liens.length > 0 && (
        <div style={{ marginTop: 14 }}>
          {liens.map((l) => {
            const s = seances[l.id];
            const sy = s ? synthese(s) : null;
            return (
              <div key={l.id} className="ami-lien">
                <div className="ami-lien-tete">
                  <a href={`/ami/${l.id}`} target="_blank" rel="noopener">
                    {typeof window !== "undefined" ? `${window.location.origin}/ami/${l.id}` : `/ami/${l.id}`}
                  </a>
                  <span className="session-meta">{s ? `${s.retours.length} retour${s.retours.length > 1 ? "s" : ""}` : "…"}</span>
                </div>
                {sy && sy.nb > 0 && (
                  <div className="timeline" style={{ marginTop: 8 }}>
                    {sy.parQuestion.map((q, i) => (
                      <div key={i} className="timeline-row" style={{ flexWrap: "wrap" }}>
                        <span className="timeline-num">{i + 1}</span>
                        <span className="timeline-titre" style={{ whiteSpace: "normal" }}>{q.question}</span>
                        <span className="chips">
                          <span className={`chip ${q.clair === sy.nb ? "chip-bon" : q.clair > 0 ? "chip-attention" : "chip-alerte"}`}>clair {q.clair}/{sy.nb}</span>
                          <span className={`chip ${q.complet === sy.nb ? "chip-bon" : q.complet > 0 ? "chip-attention" : "chip-alerte"}`}>complet {q.complet}/{sy.nb}</span>
                          <span className={`chip ${q.convaincant === sy.nb ? "chip-bon" : q.convaincant > 0 ? "chip-attention" : "chip-alerte"}`}>convaincant {q.convaincant}/{sy.nb}</span>
                        </span>
                        {q.remarques.length > 0 && <span className="session-meta" style={{ width: "100%", paddingLeft: 40 }}>« {q.remarques.join(" » · « ")} »</span>}
                      </div>
                    ))}
                    {sy.commentaires.length > 0 && (
                      <div className="timeline-row" style={{ flexWrap: "wrap" }}>
                        <span className="timeline-titre" style={{ whiteSpace: "normal" }}><Icone nom="message" /> {sy.commentaires.join(" — ")}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          <p className="report-note a-gauche">Liens valables 30 jours. L&apos;ami n&apos;a besoin ni de compte ni d&apos;application.</p>
        </div>
      )}
    </section>
  );
}
