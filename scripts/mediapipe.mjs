import { copyFile, mkdir } from "node:fs/promises";

/**
 * Copie le moteur MediaPipe depuis node_modules vers public/ avant chaque
 * build : on ne dépend d'aucun CDN (toujours la bonne version, et la caméra
 * marche même là où jsdelivr est bloqué). Ces fichiers ne sont pas versionnés.
 */
const SOURCE = "node_modules/@mediapipe/tasks-vision/wasm";
const CIBLE = "public/mediapipe/wasm";
const FICHIERS = ["vision_wasm_internal.js", "vision_wasm_internal.wasm"];

await mkdir(CIBLE, { recursive: true });
for (const f of FICHIERS) await copyFile(`${SOURCE}/${f}`, `${CIBLE}/${f}`);
console.log(`MediaPipe : ${FICHIERS.length} fichiers copiés dans ${CIBLE}`);
