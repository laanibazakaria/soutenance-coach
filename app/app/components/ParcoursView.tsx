"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  construirePlan,
  dateDuJour,
  DUREES,
  LIBELLES,
  type Parcours,
  type TypeSoutenance,
  type EtapePlanifiee,
} from "@/lib/parcours";
import { lireParcours, sauverParcours, marquerEtape, detecterContexte } from "@/lib/parcours/persistance";
import { surSynchronisation } from "@/lib/sync/client";
import { telechargerIcs } from "@/lib/ics";
import RetourOralForm from "./RetourOralForm";
import type { SessionRecord } from "@/lib/types";

function versDate(d: string): Date {
  const [a, m, j] = d.split("-").map(Number);
  return new Date(a ?? 2026, (m ?? 1) - 1, j ?? 1);
}

function dateLongue(d: string): string {
  return versDate(d).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

function dateCourte(d: string): string {
  return versDate(d).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

const RE_DATE = /^\d{4}-\d{2}-\d{2}$/;

interface Props {
  sessions: SessionRecord[];
  /** Appelé après chaque modification locale (pour pousser vers le compte). */
  onChange: () => void;
}

/** Le parcours J-X : formulaire de date, puis plan du jour et progression. */
export default function ParcoursView({ sessions, onChange }: Props) {
  const [parcours, setParcours] = useState<Parcours | null | undefined>(undefined);
  const [edition, setEdition] = useState(false);
  const [toutLePlan, setToutLePlan] = useState(false);
  const [aujourdhui, setAujourdhui] = useState(() => dateDuJour());

  useEffect(() => {
    const lire = () => {
      setParcours(lireParcours(window.localStorage));
      setAujourdhui(dateDuJour());
    };
    lire();
    return surSynchronisation(lire);
  }, []);

  if (parcours === undefined) return null;

  function enregistrer(p: Parcours) {
    sauverParcours(window.localStorage, p);
    setParcours(p);
    setEdition(false);
    onChange();
  }

  function cocher(id: string, faite: boolean) {
    const p = marquerEtape(window.localStorage, id, faite);
    if (p) {
      setParcours(p);
      onChange();
    }
  }

  if (!parcours || edition) {
    return (
      <FormulaireDate
        initial={parcours ?? null}
        aujourdhui={aujourdhui}
        onAnnuler={parcours ? () => setEdition(false) : undefined}
        onValider={enregistrer}
      />
    );
  }

  const plan = construirePlan(parcours, detecterContexte(window.localStorage, sessions), aujourdhui);
  const libelle = LIBELLES[parcours.type];

  if (plan.passee) {
    return (
      <section className="card parcours parcours-fin" aria-label="Parcours">
        <h2>
          🎓 Ta soutenance {libelle} était le {dateLongue(parcours.dateSoutenance)}.
        </h2>
        <p>Bravo d&apos;être allé au bout. Tes sessions restent ici pour la prochaine.</p>
        <RetourOralForm type="soutenance" niveauInitial={libelle} />
        <button className="btn small" onClick={() => setEdition(true)} style={{ marginTop: 12 }}>
          Préparer une nouvelle soutenance
        </button>
      </section>
    );
  }

  const jourJ = plan.joursRestants === 0;
  const pct = plan.progression.pourcent;
  const niveau = pct >= 80 ? "pret" : pct >= 40 ? "encours" : "debut";
  const titre = jourJ ? "C'est aujourd'hui." : plan.joursRestants === 1 ? "C'est demain." : `Dans ${plan.joursRestants} jours`;
  const commentaire =
    pct >= 80
      ? " · tu es dans la bonne zone."
      : pct >= 40
        ? " · continue, le plus dur est fait."
        : " · chaque étape compte, commence par la première.";

  return (
    <section className="card parcours" aria-label="Parcours de préparation">
      <div className="parcours-head">
        <div>
          <div className="parcours-sur">
            Soutenance {libelle} · {parcours.dureeMin} min · {dateLongue(parcours.dateSoutenance)}
          </div>
          <h2 className="parcours-titre">{titre}</h2>
        </div>
        <div className={`jmoins jmoins-${niveau}`} aria-hidden="true">
          J-{plan.joursRestants}
        </div>
      </div>

      <div
        className="jauge"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Préparation"
      >
        <div className={`jauge-barre jauge-${niveau}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="jauge-texte">
        <b>Prêt à {pct} %</b> — {plan.progression.faites}/{plan.progression.total} étapes
        {commentaire}
      </p>

      {plan.aFaire.length > 0 ? (
        <>
          <h3 className="parcours-h3">{jourJ ? "Aujourd'hui" : "À faire maintenant"}</h3>
          <ul className="etapes">
            {plan.aFaire.map((e) => (
              <EtapeRow key={e.id} etape={e} aujourdhui={aujourdhui} onCocher={cocher} />
            ))}
          </ul>
        </>
      ) : plan.prochaine ? (
        <p className="parcours-calme">
          ✅ Rien en retard. Prochaine étape {dateCourte(plan.prochaine.jour)} : <b>{plan.prochaine.titre}</b>.
          Envie d&apos;avancer ? <Link href={plan.prochaine.lien}>{plan.prochaine.action} →</Link>
        </p>
      ) : (
        <p className="parcours-calme">✅ Tout est fait. Il ne reste qu&apos;à respirer.</p>
      )}

      <div className="parcours-pied">
        <button className="link-btn" onClick={() => setToutLePlan((v) => !v)} aria-expanded={toutLePlan}>
          {toutLePlan ? "Masquer le plan complet" : "Voir le plan complet"}
        </button>
        <button className="link-btn" onClick={() => setEdition(true)}>
          Modifier la date
        </button>
        <button
          className="link-btn"
          onClick={() =>
            telechargerIcs({
              titre: `Soutenance ${libelle}`,
              date: parcours.dateSoutenance,
              description: `${parcours.dureeMin} minutes d'exposé. Préparée avec SoutenanceCoach.`,
              url: "https://soutenance-coach.vercel.app/app/soutenance",
            })
          }
        >
          📅 Ajouter au calendrier
        </button>
      </div>

      {toutLePlan && (
        <ul className="etapes etapes-plan">
          {plan.etapes.map((e) => (
            <EtapeRow key={e.id} etape={e} aujourdhui={aujourdhui} onCocher={cocher} avecJour />
          ))}
        </ul>
      )}
    </section>
  );
}

function EtapeRow({
  etape,
  aujourdhui,
  onCocher,
  avecJour = false,
}: {
  etape: EtapePlanifiee;
  aujourdhui: string;
  onCocher: (id: string, faite: boolean) => void;
  avecJour?: boolean;
}) {
  const auto = etape.source === "auto";
  return (
    <li className={`etape etape-${etape.etat}`}>
      <label className="etape-check">
        <input
          type="checkbox"
          checked={etape.faite}
          disabled={auto}
          onChange={(ev) => onCocher(etape.id, ev.target.checked)}
          aria-label={`${etape.titre}${auto ? " (détectée automatiquement)" : ""}`}
        />
      </label>
      <div className="etape-corps">
        <div className="etape-ligne">
          <b className="etape-titre">{etape.titre}</b>
          {avecJour && (
            <span className="etape-jour">{etape.jour === aujourdhui ? "aujourd'hui" : dateCourte(etape.jour)}</span>
          )}
          {etape.etat === "retard" && <span className="etape-tag etape-tag-retard">en retard</span>}
          {auto && <span className="etape-tag etape-tag-auto">détectée ✓</span>}
        </div>
        {!etape.faite && <p className="etape-pourquoi">{etape.pourquoi}</p>}
        {!etape.faite && etape.details && (
          <ul className="etape-details">
            {etape.details.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        )}
      </div>
      {!etape.faite && (
        <Link href={etape.lien} className="btn small etape-action">
          {etape.action} →
        </Link>
      )}
    </li>
  );
}

function FormulaireDate({
  initial,
  aujourdhui,
  onValider,
  onAnnuler,
}: {
  initial: Parcours | null;
  aujourdhui: string;
  onValider: (p: Parcours) => void;
  onAnnuler?: () => void;
}) {
  const [date, setDate] = useState(initial?.dateSoutenance ?? "");
  const [type, setType] = useState<TypeSoutenance>(initial?.type ?? "pfe");
  const [duree, setDuree] = useState(initial?.dureeMin ?? DUREES.pfe);
  const valide = RE_DATE.test(date) && date >= aujourdhui && duree > 0;

  function choisirType(t: TypeSoutenance) {
    setType(t);
    if (t !== "autre") setDuree(DUREES[t]);
  }

  return (
    <section className="card parcours parcours-form" aria-label="Ta soutenance">
      <h2 className="parcours-titre">📅 Ta soutenance, c&apos;est quand ?</h2>
      <p className="parcours-lead">
        Donne la date : le coach répartit les étapes sur les jours qui restent et coche tout seul celles
        que ton activité prouve.
      </p>
      <form
        className="parcours-champs"
        onSubmit={(ev) => {
          ev.preventDefault();
          if (!valide) return;
          onValider({
            dateSoutenance: date,
            type,
            dureeMin: duree,
            // Changer la date, c'est un nouveau plan : on repart d'aujourd'hui.
            creeLe: initial && initial.dateSoutenance === date ? initial.creeLe : aujourdhui,
            etapesFaites: initial?.etapesFaites ?? {},
            misAJourLe: new Date().toISOString(),
          });
        }}
      >
        <label className="champ">
          <span>Date</span>
          <input type="date" value={date} min={aujourdhui} onChange={(ev) => setDate(ev.target.value)} required />
        </label>
        <fieldset className="formats formats-inline">
          <legend>Type</legend>
          {(["pfa", "pfe", "autre"] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={`format-btn${type === t ? " active" : ""}`}
              onClick={() => choisirType(t)}
            >
              {LIBELLES[t]}
              {t !== "autre" && <span className="format-hint"> · {DUREES[t]} min</span>}
            </button>
          ))}
        </fieldset>
        {type === "autre" && (
          <label className="champ">
            <span>Durée de l&apos;exposé (min)</span>
            <input
              type="number"
              min={1}
              max={60}
              value={duree}
              onChange={(ev) => setDuree(Number(ev.target.value))}
            />
          </label>
        )}
        <div className="actions">
          {onAnnuler && (
            <button type="button" className="btn" onClick={onAnnuler}>
              Annuler
            </button>
          )}
          <button type="submit" className="btn primary" disabled={!valide}>
            {initial ? "Mettre à jour" : "Construire mon parcours"}
          </button>
        </div>
      </form>
    </section>
  );
}
