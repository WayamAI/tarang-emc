/** Derived views over an analysis: compliance matrix, lab plan, version diff, heatmap. */

import { MARKET_BY_ID, STANDARD_BY_ID, TEMPLATE_BY_ID, TESTS } from "./catalog";
import { statusFor } from "./engine";
import { harnessOf } from "./geometry";
import type { Recommendation } from "./planner";
import type { Analysis, Design, Level, MarketId, Part, ReqStatus, Risk, StandardsOverride, TestRequirement } from "./types";

export type Outcome = "Likely fail" | "Marginal" | "Likely pass" | "Clear";

export function outcomeFor(worst: Risk | undefined): Outcome {
  if (!worst) return "Clear";
  if (worst.level === "High") return "Likely fail";
  if (worst.level === "Medium") return "Marginal";
  return "Likely pass";
}

export const OUTCOME_TONE: Record<Outcome, "error" | "warning" | "success" | "neutral"> = {
  "Likely fail": "error", Marginal: "warning", "Likely pass": "success", Clear: "neutral",
};

export interface ComplianceCell {
  market: MarketId;
  status: ReqStatus;
  standard: string;
  standardId: string;
  outcome: Outcome;
  worst?: Risk;
  risks: Risk[];
}

export interface ComplianceRow {
  test: TestRequirement;
  cells: Partial<Record<MarketId, ComplianceCell>>;
  risks: Risk[];
  worst?: Risk;
}

export function complianceMatrix(design: Design, analysis: Analysis, override: StandardsOverride): ComplianceRow[] {
  const rows: ComplianceRow[] = [];
  for (const test of TESTS) {
    const linked = analysis.risks.filter((r) => r.testIds.includes(test.id));
    const cells: ComplianceRow["cells"] = {};
    for (const market of design.markets) {
      const entry = test.markets[market];
      const status = statusFor(test.id, market, override);
      if (!status) continue;
      cells[market] = {
        market, status, standard: entry ? STANDARD_BY_ID[entry.standardId].code : "Simulated requirement", standardId: entry?.standardId ?? "",
        outcome: outcomeFor(linked[0]), worst: linked[0], risks: linked,
      };
    }
    if (Object.keys(cells).length) rows.push({ test, cells, risks: linked, worst: linked[0] });
  }
  return rows;
}

/** Probability the test passes first time, from the risks linked to it. */
export function passProbability(risks: Risk[]): number {
  if (!risks.length) return 0.96;
  const worst = Math.max(...risks.map((r) => r.score));
  return Math.min(0.96, Math.max(0.04, 1 - (worst / 100) * 0.88 - 0.02 * (risks.length - 1)));
}

export type GoCall = "Go" | "Go after fix" | "Pre-scan first" | "Hold";

export const CALL_TONE: Record<GoCall, "success" | "info" | "warning" | "error"> = {
  Go: "success", "Go after fix": "info", "Pre-scan first": "warning", Hold: "error",
};

export interface ReadinessRow {
  test: TestRequirement;
  markets: MarketId[];
  status: ReqStatus;
  standards: string[];
  risks: Risk[];
  pNow: number;
  pPlanned: number;
  cheapest?: Recommendation;
  labCostUsd: number;
  respinUsd: number;
  delayWeeks: number;
  expectedNow: number;
  expectedPlanned: number;
  call: GoCall;
}

const STATUS_RANK: Record<ReqStatus, number> = { mandatory: 3, verify: 2, voluntary: 1 };

export function labReadiness(
  design: Design,
  analysis: Analysis,
  planned: Analysis,
  recsByRisk: Map<string, Recommendation[]>,
  override: StandardsOverride,
): ReadinessRow[] {
  const rows: ReadinessRow[] = [];
  for (const row of complianceMatrix(design, analysis, override)) {
    const cells = Object.values(row.cells);
    const status = cells.map((c) => c.status).sort((a, b) => STATUS_RANK[b] - STATUS_RANK[a])[0];
    if (status === "voluntary") continue;
    const plannedRisks = planned.risks.filter((r) => r.testIds.includes(row.test.id));
    const pNow = passProbability(row.risks);
    const pPlanned = passProbability(plannedRisks);
    const worst = row.risks[0];
    const recs = worst ? recsByRisk.get(worst.key) ?? [] : [];
    const moving = recs.filter((r) => r.after < 60 && r.before - r.after >= 15);
    const cheapest = [...moving].sort((a, b) => a.designStageUsd - b.designStageUsd)[0];
    const respinUsd = worst ? recs[0]?.fix.postLabCostUsd ?? 20000 : 0;
    const delayWeeks = worst ? recs[0]?.fix.postLabWeeks ?? 3 : 0;
    const exposure = row.test.labCostUsd + respinUsd;
    let call: GoCall = "Go";
    if (pNow < 0.8) call = pPlanned >= 0.8 ? "Go after fix" : pNow >= 0.5 ? "Pre-scan first" : "Hold";
    rows.push({
      test: row.test, markets: cells.map((c) => c.market), status,
      standards: [...new Set(cells.map((c) => c.standard))], risks: row.risks, pNow, pPlanned, cheapest,
      labCostUsd: row.test.labCostUsd, respinUsd, delayWeeks,
      expectedNow: (1 - pNow) * exposure, expectedPlanned: (1 - pPlanned) * exposure, call,
    });
  }
  return rows;
}

/** First-pass probability for one market: every mandatory or verify test passes. */
export function firstPassByMarket(design: Design, analysis: Analysis, override: StandardsOverride): Partial<Record<MarketId, number>> {
  const out: Partial<Record<MarketId, number>> = {};
  for (const market of design.markets) {
    let p = 1;
    for (const test of TESTS) {
      const status = statusFor(test.id, market, override);
      if (!status || status === "voluntary") continue;
      const linked = analysis.risks.filter((r) => r.testIds.includes(test.id));
      if (linked.length) p *= passProbability(linked);
    }
    out[market] = p;
  }
  return out;
}

export interface Heatmap {
  aggressors: string[];
  victims: string[];
  cell: (aggressor: string, victim: string) => Risk | undefined;
}

export function heatmap(analysis: Analysis): Heatmap {
  const aggressors = [...new Set(analysis.risks.map((r) => r.aggressor))].sort();
  const victims = [...new Set(analysis.risks.map((r) => r.victim))].sort();
  return {
    aggressors, victims,
    cell: (a, v) => analysis.risks.find((r) => r.aggressor === a && r.victim === v),
  };
}

// --- version compare -------------------------------------------------------

export interface RiskDelta {
  key: string;
  num: number;
  label: string;
  mechanism: string;
  before?: number;
  after?: number;
  levelBefore?: Level;
  levelAfter?: Level;
  kind: "resolved" | "new" | "level" | "score" | "same";
}

export function riskLabel(r: Risk) {
  return `${r.aggressor} → ${r.victim}`;
}

export function compareRisks(a: Analysis, b: Analysis): RiskDelta[] {
  const out: RiskDelta[] = [];
  const bByKey = new Map(b.risks.map((r) => [r.key, r]));
  for (const ra of a.risks) {
    const rb = bByKey.get(ra.key);
    bByKey.delete(ra.key);
    out.push({
      key: ra.key, num: ra.num, label: riskLabel(ra), mechanism: ra.mechanism, before: ra.score, after: rb?.score,
      levelBefore: ra.level, levelAfter: rb?.level,
      kind: !rb ? "resolved" : rb.level !== ra.level ? "level" : rb.score !== ra.score ? "score" : "same",
    });
  }
  for (const rb of bByKey.values()) {
    out.push({ key: rb.key, num: rb.num, label: riskLabel(rb), mechanism: rb.mechanism, after: rb.score, levelAfter: rb.level, kind: "new" });
  }
  return out;
}

export interface DesignDiff {
  area: "Layout" | "Wiring" | "Grounding" | "Component" | "Markets" | "Panels";
  subject: string;
  change: string;
}

const FLAG_LABEL: [keyof Part, string][] = [
  ["shieldCan", "shield can"], ["localFilter", "local LC filter"], ["spreadSpectrum", "frequency jitter"],
  ["freqHop", "frequency hopping"], ["esdProtection", "TVS array and guard ring"], ["thermalBaffle", "thermal baffle"],
  ["staged", "staged elements"],
];

export function diffDesigns(a: Design, b: Design): DesignDiff[] {
  const out: DesignDiff[] = [];
  const bParts = new Map(b.parts.map((p) => [p.ref, p]));
  for (const pa of a.parts) {
    const pb = bParts.get(pa.ref);
    if (!pb) {
      out.push({ area: "Layout", subject: pa.ref, change: `${pa.name} removed` });
      continue;
    }
    bParts.delete(pa.ref);
    if (pa.pos.some((v, i) => v !== pb.pos[i])) {
      const moved = Math.round(Math.hypot(pa.pos[0] - pb.pos[0], pa.pos[1] - pb.pos[1], pa.pos[2] - pb.pos[2]));
      out.push({ area: "Layout", subject: pa.ref, change: `Moved ${moved} mm, (${pa.pos.join(", ")}) to (${pb.pos.join(", ")})` });
    }
    for (const [flag, label] of FLAG_LABEL) {
      if (Boolean(pa[flag]) !== Boolean(pb[flag])) out.push({ area: "Component", subject: pa.ref, change: `${pb[flag] ? "Added" : "Removed"} ${label}` });
    }
    if ((pa.pfc ?? "none") !== (pb.pfc ?? "none")) out.push({ area: "Component", subject: pa.ref, change: `PFC ${pa.pfc ?? "none"} to ${pb.pfc ?? "none"}` });
    const stagesA = pa.filterStages ?? TEMPLATE_BY_ID[pa.templateId].filterStages;
    const stagesB = pb.filterStages ?? TEMPLATE_BY_ID[pb.templateId].filterStages;
    if (stagesA !== stagesB) out.push({ area: "Component", subject: pa.ref, change: `Filter stages ${stagesA ?? 0} to ${stagesB ?? 0}` });
    if ((pa.filterBoostDb ?? 0) !== (pb.filterBoostDb ?? 0)) out.push({ area: "Component", subject: pa.ref, change: `Filter X/Y capacitance +${pb.filterBoostDb ?? 0} dB` });
    if ((pa.switchPeriodS ?? 0) !== (pb.switchPeriodS ?? 0)) out.push({ area: "Component", subject: pa.ref, change: `Switching period ${pa.switchPeriodS ?? 20} s to ${pb.switchPeriodS ?? 20} s` });
  }
  for (const pb of bParts.values()) out.push({ area: "Layout", subject: pb.ref, change: `${pb.name} added` });

  for (const cable of a.cables) {
    const inA = harnessOf(a, cable.id);
    const inB = harnessOf(b, cable.id);
    if (Boolean(inA) !== Boolean(inB)) out.push({ area: "Wiring", subject: cable.id, change: `${cable.name}: ${inB ? `joined ${inB.harness.name}` : `left ${inA?.harness.name}, own run`}` });
    const cb = b.cables.find((c) => c.id === cable.id);
    if (cb && cb.construction !== cable.construction) out.push({ area: "Wiring", subject: cable.id, change: `${cable.name}: ${cable.construction} to ${cb.construction}` });
    if (cb && Boolean(cb.ferrite) !== Boolean(cable.ferrite)) out.push({ area: "Wiring", subject: cable.id, change: `${cable.name}: ferrite clamp ${cb.ferrite ? "added" : "removed"}` });
  }
  for (const net of a.groundNets) {
    const nb = b.groundNets.find((n) => n.id === net.id);
    if (!nb) continue;
    if (nb.topology !== net.topology) out.push({ area: "Grounding", subject: net.id, change: `${net.name}: ${net.topology} to ${nb.topology} topology` });
    if (nb.standoffMm !== net.standoffMm) out.push({ area: "Grounding", subject: net.id, change: `${net.name}: standoff ${net.standoffMm} mm to ${nb.standoffMm} mm` });
  }
  for (const panel of a.panels) {
    const pb = b.panels.find((p) => p.id === panel.id);
    if (!pb) continue;
    if (pb.earthBonded !== panel.earthBonded) out.push({ area: "Panels", subject: panel.name, change: `Earth bond ${pb.earthBonded ? "added" : "removed"}` });
    if (pb.materialId !== panel.materialId) out.push({ area: "Panels", subject: panel.name, change: `Material ${panel.materialId} to ${pb.materialId}` });
    if (Boolean(pb.apertureScreened) !== Boolean(panel.apertureScreened)) out.push({ area: "Panels", subject: panel.name, change: `Aperture ${pb.apertureScreened ? "screened" : "unscreened"}` });
  }
  const added = b.markets.filter((m) => !a.markets.includes(m));
  const dropped = a.markets.filter((m) => !b.markets.includes(m));
  if (added.length) out.push({ area: "Markets", subject: "Scope", change: `Added ${added.map((m) => MARKET_BY_ID[m].label).join(", ")}` });
  if (dropped.length) out.push({ area: "Markets", subject: "Scope", change: `Dropped ${dropped.map((m) => MARKET_BY_ID[m].label).join(", ")}` });
  return out;
}
