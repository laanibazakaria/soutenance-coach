/**
 * La mémoire de la panne de dictée native. Sur certains appareils (le Samsung
 * de Zakaria), la reconnaissance vocale du navigateur démarre puis ne rend
 * jamais un mot : chaque page perdait de longues secondes à le re-découvrir.
 * Une fois la panne prouvée, on la note ici — et l'appel comme les pages
 * d'entraînement partent directement sur la transcription serveur.
 */
const CLE = "sc.dictee.segments";

export function segmentsPreferes(): boolean {
  try {
    return window.localStorage.getItem(CLE) === "1";
  } catch {
    return false;
  }
}

export function noterSegmentsPreferes(): void {
  try {
    window.localStorage.setItem(CLE, "1");
  } catch {
    /* stockage indisponible : on re-détectera la prochaine fois */
  }
}
