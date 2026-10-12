/** Portfolio layer: programmes, people, chamber bookings and the figures the EMC lead tracks. */

import { STANDARD_BY_ID, TEST_BY_ID } from "./catalog";
import { LAB_REPORTS, LABS } from "./history";
import type { Analysis, Design, MarketId, Risk } from "./types";

export const TENANT = "Northfield Appliances";

export const PEOPLE = {
  lead: { name: "Marit Solheim", role: "EMC lead" },
  eng1: { name: "Tomasz Brenner", role: "EMC engineer" },
  eng2: { name: "Anika Rao", role: "EMC engineer" },
  architect: { name: "Devika Menon", role: "Appliance architect" },
  lab: { name: "Jonas Feld", role: "Lab coordinator" },
} as const;

export interface Program {
  id: string;
  name: string;
  kind: string;
  family: string;
  engineer: string;
  architect: string;
  gate: string;
  gateDate: string;
  /** Risk index at the last six weekly reviews, oldest first. The live value is appended. */
  trend: number[];
  plm: string;
}

export const PROGRAMS: Program[] = [
  { id: "P-AQ", name: "AquaLine FL-8", kind: "Front-load washer, 8 kg", family: "AquaLine", engineer: PEOPLE.eng1.name, architect: PEOPLE.architect.name, gate: "EVT lab entry", gateDate: "2026-11-09", trend: [100, 100, 100, 94, 94, 58], plm: "Windchill WT-448210" },
  { id: "P-TL", name: "TopLoad TL-7", kind: "Top-load washer, 7 kg", family: "TopLoad", engineer: PEOPLE.eng2.name, architect: PEOPLE.architect.name, gate: "Layout freeze", gateDate: "2026-10-26", trend: [84, 84, 84, 80, 77, 77], plm: "Windchill WT-451877" },
  { id: "P-DL", name: "DryLine HP-9", kind: "Heat-pump dryer, 9 kg", family: "DryLine", engineer: PEOPLE.eng1.name, architect: "Lucas Oyelaran", gate: "EVT lab entry", gateDate: "2026-12-07", trend: [89, 89, 86, 86, 83, 83], plm: "Windchill WT-455031" },
  { id: "P-CW", name: "CleanWave DW-6", kind: "Dishwasher, 14 place settings", family: "CleanWave", engineer: PEOPLE.eng2.name, architect: "Lucas Oyelaran", gate: "DVT lab entry", gateDate: "2026-10-19", trend: [58, 49, 41, 33, 27, 24], plm: "Windchill WT-439406" },
];

export const PROGRAM_BY_ID = Object.fromEntries(PROGRAMS.map((p) => [p.id, p])) as Record<string, Program>;

export interface Booking {
  id: string;
  programId: string;
  lab: string;
  facility: string;
  date: string;
  days: number;
  testIds: string[];
  costUsd: number;
  status: "Confirmed" | "Tentative";
  cancelBy: string;
}

export const BOOKINGS: Booking[] = [
  { id: "BK-2610", programId: "P-CW", lab: LABS[0], facility: "10 m semi-anechoic chamber", date: "2026-10-19", days: 3, testIds: ["CE", "RE", "CLICK", "ESD", "EFT", "FLICK"], costUsd: 14800, status: "Confirmed", cancelBy: "2026-10-14" },
  { id: "BK-2611", programId: "P-AQ", lab: LABS[0], facility: "10 m semi-anechoic chamber + radio lab", date: "2026-11-09", days: 5, testIds: ["CE", "RE", "EFT", "CRF", "ESD", "RADIO-EMC", "RADIO-RF", "HARM", "FLICK"], costUsd: 31600, status: "Confirmed", cancelBy: "2026-10-26" },
  { id: "BK-2612", programId: "P-AQ", lab: LABS[1], facility: "3 m chamber, FCC listed", date: "2026-11-17", days: 2, testIds: ["CE", "RE", "RADIO-RF"], costUsd: 15000, status: "Tentative", cancelBy: "2026-11-03" },
  { id: "BK-2613", programId: "P-TL", lab: LABS[1], facility: "3 m chamber, FCC listed", date: "2026-11-24", days: 2, testIds: ["CE", "RE", "RADIO-RF"], costUsd: 15000, status: "Tentative", cancelBy: "2026-11-10" },
  { id: "BK-2614", programId: "P-DL", lab: LABS[0], facility: "10 m semi-anechoic chamber + radio lab", date: "2026-12-07", days: 4, testIds: ["CE", "RE", "HARM", "FLICK", "ESD", "RADIO-EMC", "RADIO-RF"], costUsd: 27200, status: "Confirmed", cancelBy: "2026-11-23" },
  { id: "BK-2615", programId: "P-TL", lab: LABS[3], facility: "Pre-scan cell, 3 m open bench", date: "2026-10-22", days: 1, testIds: ["CE", "RADIO-RF"], costUsd: 1800, status: "Confirmed", cancelBy: "2026-10-20" },
];

export function designsOf(designs: Design[], programId: string): Design[] {
  return designs.filter((d) => d.programId === programId);
}

export function latestDesign(designs: Design[], programId: string): Design | undefined {
  const list = designsOf(designs, programId);
  return list[list.length - 1];
}

/** Mean delay and cost of past lab failures by the same mechanism. */
export function failureCost(risk: Risk): { weeks: number; usd: number; basis: string } {
  const fails = LAB_REPORTS.filter((r) => r.result === "fail");
  const same = fails.filter((r) => r.tags[0] === risk.tags[0]);
  const pool = same.length ? same : fails;
  const weeks = pool.reduce((s, r) => s + r.delayWeeks, 0) / pool.length;
  const usd = pool.reduce((s, r) => s + r.costUsd, 0) / pool.length;
  return { weeks, usd, basis: same.length ? same.map((r) => r.id).join(", ") : "all failing reports" };
}

export interface Avoided {
  weeks: number;
  usd: number;
  resolved: { programId: string; risk: Risk; weeks: number; usd: number }[];
}

/** Highs present in a programme's first version and cleared in its latest. */
export function avoidedThisYear(designs: Design[], analysisOf: (id: string) => Analysis): Avoided {
  const out: Avoided = { weeks: 0, usd: 0, resolved: [] };
  for (const program of PROGRAMS) {
    const list = designsOf(designs, program.id);
    if (list.length < 2) continue;
    const first = analysisOf(list[0].id);
    const best = list.slice(1).reduce((a, d) => (analysisOf(d.id).index < analysisOf(a.id).index ? d : a), list[1]);
    const latest = analysisOf(best.id);
    for (const risk of first.risks) {
      if (risk.level !== "High") continue;
      const now = latest.risks.find((r) => r.key === risk.key);
      if (now?.level === "High") continue;
      const cost = failureCost(risk);
      out.weeks += cost.weeks;
      out.usd += cost.usd;
      out.resolved.push({ programId: program.id, risk, weeks: cost.weeks, usd: cost.usd });
    }
  }
  return out;
}

export function standardsFor(markets: MarketId[], testIds: string[]): string[] {
  const out: string[] = [];
  for (const id of testIds) {
    for (const m of markets) {
      const code = STANDARD_BY_ID[TEST_BY_ID[id]?.markets[m]?.standardId ?? ""]?.code;
      if (code && !out.includes(code)) out.push(code);
    }
  }
  return out;
}
