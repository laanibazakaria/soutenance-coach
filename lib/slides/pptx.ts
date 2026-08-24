/**
 * Lecture d'un PowerPoint (.pptx) dans le navigateur.
 *
 * Un .pptx est une archive ZIP : chaque diapositive est un XML sous
 * `ppt/slides/slideN.xml`, où le texte vit dans des balises `<a:t>`. On lit
 * donc l'archive en mémoire et on récupère le texte, sans convertir en PDF
 * et sans que le fichier ne quitte l'appareil.
 *
 * Le découpage et l'analyse restent communs avec le PDF : seule la source
 * change.
 */

import { decouperSlide } from "./analyse";
import type { Deck } from "./types";
import { ExtractionError } from "./extract";

/**
 * Décode le XML. Les entités numériques comptent autant que les nommées :
 * PowerPoint écrit les flèches, les apostrophes typographiques et les tirets
 * longs sous cette forme, et une diapositive en est pleine.
 */
function decoder(t: string): string {
  return t
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** `ppt/slides/slide12.xml` → 12, pour remettre les diapositives dans l'ordre. */
function numeroDeSlide(chemin: string): number {
  return Number(/slide(\d+)\.xml$/.exec(chemin)?.[1] ?? 0);
}

/**
 * Le texte d'une diapositive. PowerPoint découpe une même phrase en
 * plusieurs `<a:t>` dès qu'un mot change de style : on recolle, puis on
 * sépare les vrais blocs (paragraphes et formes) par des sauts de ligne.
 */
export function texteDeSlideXml(xml: string): string {
  const paragraphes = xml.split(/<a:p[ >]/).slice(1);
  const lignes = paragraphes.map((p) => {
    const morceaux = [...p.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)].map((m) => m[1] ?? "");
    return decoder(morceaux.join(""))
      .replace(/\s+/g, " ")
      .trim();
  });
  return lignes.filter((l) => l.length > 0).join("\n");
}

export async function extraireDeckPPTX(file: File): Promise<Deck> {
  const { default: JSZip } = await import("jszip");
  let zip;
  try {
    zip = await JSZip.loadAsync(await file.arrayBuffer());
  } catch {
    throw new ExtractionError("Ce fichier PowerPoint n'a pas pu être ouvert. S'il vient de Google Slides, exporte-le en .pptx ou en PDF.");
  }

  const fichiers = Object.keys(zip.files)
    .filter((c) => /^ppt\/slides\/slide\d+\.xml$/.test(c))
    .sort((a, b) => numeroDeSlide(a) - numeroDeSlide(b));

  if (fichiers.length === 0) {
    throw new ExtractionError("Aucune diapositive trouvée dans ce fichier. Vérifie que c'est bien un .pptx (pas un .ppt ancien format).");
  }

  const slides = [];
  for (const [i, chemin] of fichiers.entries()) {
    const xml = await zip.files[chemin]!.async("string");
    const texte = texteDeSlideXml(xml);
    slides.push(decouperSlide(i + 1, texte));
  }

  const utiles = slides.filter((s) => s.texte.trim().length > 0);
  if (utiles.length === 0) {
    throw new ExtractionError("Ces diapositives ne contiennent que des images : aucun texte à lire. Ajoute tes titres et tes points clés en texte, ou dépose le PDF.");
  }
  return { nomFichier: file.name, slides };
}
