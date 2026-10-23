import { describe, expect, it } from "vitest";
import { dagensGraenser, danskDato, iUdsendelsesvindue, laegDage, laesbarDato, timerIDoegnet, ugedag } from "@/lib/tid";

describe("tid og sommertid", () => {
  it("et almindeligt døgn har 24 timer, skiftedøgnene 23 og 25", () => {
    expect(timerIDoegnet("2026-06-15")).toBe(24);
    expect(timerIDoegnet("2026-03-29")).toBe(23); // sidste søndag i marts 2026
    expect(timerIDoegnet("2026-10-25")).toBe(25); // sidste søndag i oktober 2026
  });

  it("dansk midnat er UTC-1 om vinteren og UTC-2 om sommeren", () => {
    expect(dagensGraenser("2026-01-10").start.toISOString()).toBe("2026-01-09T23:00:00.000Z");
    expect(dagensGraenser("2026-07-10").start.toISOString()).toBe("2026-07-09T22:00:00.000Z");
  });

  it("kalenderregning og ugedage", () => {
    expect(laegDage("2026-10-31", 1)).toBe("2026-11-01");
    expect(laegDage("2026-03-01", -1)).toBe("2026-02-28");
    expect(ugedag("2026-10-24")).toBe("lørdag");
    expect(laesbarDato("2026-10-24")).toBe("lørdag den 24. oktober");
  });

  it("udsendelsesvinduet er 16.00–18.59 dansk tid, sommer som vinter", () => {
    expect(iUdsendelsesvindue(new Date("2026-07-10T13:59:00Z"))).toBe(false); // 15.59 CEST
    expect(iUdsendelsesvindue(new Date("2026-07-10T14:00:00Z"))).toBe(true); // 16.00 CEST
    expect(iUdsendelsesvindue(new Date("2026-01-10T15:00:00Z"))).toBe(true); // 16.00 CET
    expect(iUdsendelsesvindue(new Date("2026-01-10T14:00:00Z"))).toBe(false); // 15.00 CET
    expect(iUdsendelsesvindue(new Date("2026-01-10T18:00:00Z"))).toBe(false); // 19.00 CET
    expect(danskDato(new Date("2026-12-31T23:30:00Z"))).toBe("2027-01-01");
  });
});
