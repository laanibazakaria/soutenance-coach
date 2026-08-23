import { describe, it, expect } from "vitest";
import { genererIcs } from "../../lib/ics";

describe("genererIcs", () => {
  const ics = genererIcs(
    { titre: "Soutenance PFE", date: "2026-09-15", description: "Jury de 3 ; 20 min, puis questions.", url: "https://soutenance-coach.vercel.app/app/soutenance" },
    new Date("2026-08-23T10:00:00Z"),
  );

  it("est un calendrier valide, journée entière, avec rappel la veille", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART;VALUE=DATE:20260915");
    expect(ics).toContain("DTEND;VALUE=DATE:20260916");
    expect(ics).toContain("SUMMARY:Soutenance PFE");
    expect(ics).toContain("TRIGGER:-P1D");
    expect(ics).toContain("DTSTAMP:20260823T100000Z");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("échappe les caractères réservés et plie les longues lignes", () => {
    expect(ics).toContain("DESCRIPTION:Jury de 3 \\; 20 min\\, puis questions.");
    const long = genererIcs({ titre: "x", date: "2026-12-31", description: "a".repeat(200) });
    const lignes = long.split("\r\n");
    expect(lignes.every((l) => l.length <= 75)).toBe(true);
    expect(long).toContain("DTEND;VALUE=DATE:20270101");
  });
});
