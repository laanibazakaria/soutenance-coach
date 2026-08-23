/**
 * Un événement de calendrier (.ics) pour la date d'un oral — journée
 * entière, rappel la veille. Format iCalendar, accepté par Google Agenda,
 * Outlook, Apple Calendar. Pur et testé.
 */

export interface EvenementIcs {
  titre: string;
  /** YYYY-MM-DD */
  date: string;
  description?: string;
  url?: string;
}

function echapper(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Plie les lignes à 75 octets comme l'exige la norme (continuation par un espace). */
function plier(ligne: string): string {
  const out: string[] = [];
  let reste = ligne;
  while (reste.length > 73) {
    out.push(reste.slice(0, 73));
    reste = " " + reste.slice(73);
  }
  out.push(reste);
  return out.join("\r\n");
}

export function genererIcs(e: EvenementIcs, maintenant: Date = new Date()): string {
  const jour = e.date.replace(/-/g, "");
  const [a, m, j] = e.date.split("-").map(Number);
  const lendemain = new Date(Date.UTC(a, m - 1, j + 1));
  const jourFin = `${lendemain.getUTCFullYear()}${String(lendemain.getUTCMonth() + 1).padStart(2, "0")}${String(lendemain.getUTCDate()).padStart(2, "0")}`;
  const horodatage = maintenant.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const uid = `${jour}-${e.titre.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}@soutenance-coach.vercel.app`;
  const lignes = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SoutenanceCoach//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${horodatage}`,
    `DTSTART;VALUE=DATE:${jour}`,
    `DTEND;VALUE=DATE:${jourFin}`,
    `SUMMARY:${echapper(e.titre)}`,
    ...(e.description ? [`DESCRIPTION:${echapper(e.description)}`] : []),
    ...(e.url ? [`URL:${e.url}`] : []),
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:Demain — relis, ne répète plus.",
    "TRIGGER:-P1D",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lignes.map(plier).join("\r\n") + "\r\n";
}

/** Déclenche le téléchargement du fichier dans le navigateur. */
export function telechargerIcs(e: EvenementIcs): void {
  const blob = new Blob([genererIcs(e)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${e.titre.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "oral"}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}
