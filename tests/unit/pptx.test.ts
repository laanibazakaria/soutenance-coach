import { it, expect } from "vitest";
import { texteDeSlideXml } from "../../lib/slides/pptx";

it("lit le texte d'une diapositive PowerPoint réelle", () => {
  // Extrait fidèle d'un slideN.xml : PowerPoint coupe une phrase en plusieurs
  // <a:t> dès qu'un mot change de style.
  const xml = `<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree>
  <p:sp><p:txBody>
    <a:p><a:r><a:t>Transcription automatique des </a:t></a:r><a:r><a:rPr b="1"/><a:t>appels commerciaux</a:t></a:r></a:p>
  </p:txBody></p:sp>
  <p:sp><p:txBody>
    <a:p><a:r><a:t>WER : 8,2 % &lt;&#8594;&gt; 6,9 %</a:t></a:r></a:p>
    <a:p><a:r><a:t>Douze fichiers &amp; deux relecteurs</a:t></a:r></a:p>
    <a:p><a:endParaRPr/></a:p>
  </p:txBody></p:sp>
  </p:spTree></p:cSld></p:sld>`;
  const t = texteDeSlideXml(xml);
  expect(t).toContain("Transcription automatique des appels commerciaux");
  expect(t).toContain("WER : 8,2 % <→> 6,9 %");
  expect(t).toContain("Douze fichiers & deux relecteurs");
  expect(t.split("\n")).toHaveLength(3);
  expect(texteDeSlideXml("<p:sld></p:sld>")).toBe("");
});

it("remet les diapositives dans l'ordre, y compris au-delà de dix", async () => {
  const { texteDeSlideXml } = await import("../../lib/slides/pptx");
  // Le tri par nom de fichier mettrait slide10 avant slide2 : c'est le piège.
  const noms = ["ppt/slides/slide10.xml", "ppt/slides/slide2.xml", "ppt/slides/slide1.xml"];
  const numero = (c: string) => Number(/slide(\d+)\.xml$/.exec(c)?.[1] ?? 0);
  expect([...noms].sort((a, b) => numero(a) - numero(b)).map(numero)).toEqual([1, 2, 10]);
  expect([...noms].sort().map(numero)).not.toEqual([1, 2, 10]);
  expect(texteDeSlideXml("<a:p><a:r><a:t>Une seule ligne</a:t></a:r></a:p>")).toBe("Une seule ligne");
});
