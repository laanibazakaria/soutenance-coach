import { Icone } from "@/app/components/Icone";
import type { Antiseche } from "@/lib/antiseche";

/**
 * L'antisèche du jour J, pensée pour l'impression : une page qu'on pose à côté
 * de soi en salle de soutenance. Quatre blocs courts — on ne lit pas un
 * paragraphe sous le regard d'un jury, on jette un œil à une liste.
 */
export default function AntisecheVue({ antiseche }: { antiseche: Antiseche }) {
  const { accroche, plan, chiffres, fragilites } = antiseche;
  return (
    <section className="antiseche" aria-label="Antisèche du jour J">
      <h2 className="list-title">
        <Icone nom="document" taille={18} /> L&apos;antisèche du jour J
      </h2>
      <p className="session-meta">
        Tout vient de ta préparation : ton pitch, tes diapositives, la lecture du jury. À imprimer
        avec ce bilan, et à relire une dernière fois avant d&apos;entrer.
      </p>

      {accroche && (
        <div className="antiseche-bloc">
          <h3>Tes premières phrases</h3>
          <p className="antiseche-accroche">{accroche}</p>
        </div>
      )}

      {plan.length > 0 && (
        <div className="antiseche-bloc">
          <h3>Le plan que tu annonces</h3>
          <ol>
            {plan.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ol>
        </div>
      )}

      {chiffres.length > 0 && (
        <div className="antiseche-bloc">
          <h3>Tes chiffres — le jury les a relevés, il les redemandera</h3>
          <ul>
            {chiffres.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      {fragilites.length > 0 && (
        <div className="antiseche-bloc">
          <h3>Là où il attaquera — prépare une réponse à chacune</h3>
          <ul>
            {fragilites.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
