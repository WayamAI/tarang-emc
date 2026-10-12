/** Fix Planner: ranks every applicable fix for a risk by re-running the engine on the edited design. */

import { analyze } from "./engine";
import { FIXES, fixInstanceId, parseRiskKey, type FixDef } from "./fixes";
import { PROVEN_FIX, REPORT_BY_ID } from "./history";
import type { Analysis, Design, LabReport, Risk, StandardsOverride } from "./types";

export const ENGINEER_RATE_USD = 140;

export interface Recommendation {
  instance: string;
  fix: FixDef;
  riskKey: string;
  riskNum: number;
  title: string;
  before: number;
  after: number;
  indexBefore: number;
  indexAfter: number;
  /** Other risks this fix also moves, by key, with their new score. */
  sideEffects: { key: string; num: number; before: number; after: number }[];
  provenBy?: LabReport;
  designStageUsd: number;
}

export function recommendationsFor(
  design: Design,
  analysis: Analysis,
  risk: Risk,
  override: StandardsOverride,
): Recommendation[] {
  const target = parseRiskKey(risk.key);
  const out: Recommendation[] = [];
  for (const fix of FIXES) {
    if (!fix.rules.includes(risk.rule)) continue;
    if (fix.applies && !fix.applies(target, design)) continue;
    const edited = fix.apply(design, target);
    if (edited === design) continue;
    const next = analyze(edited, override);
    const after = next.risks.find((r) => r.key === risk.key)?.score ?? 0;
    if (after >= risk.score) continue;
    const sideEffects = analysis.risks
      .filter((r) => r.key !== risk.key)
      .map((r) => ({ key: r.key, num: r.num, before: r.score, after: next.risks.find((n) => n.key === r.key)?.score ?? 0 }))
      .filter((s) => s.after !== s.before);
    const proof = risk.matches.find((m) => m.result === "pass" && PROVEN_FIX[m.reportId] === fix.id);
    out.push({
      instance: fixInstanceId(fix.id, risk.key),
      fix,
      riskKey: risk.key,
      riskNum: risk.num,
      title: fix.title(target, design),
      before: risk.score,
      after,
      indexBefore: analysis.index,
      indexAfter: next.index,
      sideEffects,
      provenBy: proof ? REPORT_BY_ID[proof.reportId] : undefined,
      designStageUsd: fix.effortHours * ENGINEER_RATE_USD + fix.designCostUsd,
    });
  }
  return out.sort((a, b) => a.after - b.after || a.fix.effortHours - b.fix.effortHours);
}

export function planFor(design: Design, analysis: Analysis, override: StandardsOverride) {
  return analysis.risks.map((risk) => ({ risk, recs: recommendationsFor(design, analysis, risk, override) }));
}
