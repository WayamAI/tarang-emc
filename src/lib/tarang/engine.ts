/**
 * Tarang rule engine.
 *
 * Deterministic and pure: the same design, markets and standards library always
 * give the same register. Every page reads its numbers from `analyze`, so a
 * part nudged in the workspace moves the register, the compliance matrix, the
 * lab plan and the portfolio together.
 *
 *   score = min(100, round(100 × clamp(rule factor + modifiers, 0, 1) × impact) + history adjustment)
 */

import {
  HISTORY_ADJ,
  IMPACT_WEIGHT,
  LEVEL_BANDS,
  MATERIAL_BY_ID,
  RULE_BY_ID,
  STANDARD_BY_ID,
  TEMPLATE_BY_ID,
  TEST_BY_ID,
} from "./catalog";
import { boxGap, cableLength, center, polylineLength, strapPath, zoneOf } from "./geometry";
import { LAB_REPORTS } from "./history";
import {
  EMPTY_OVERRIDE,
  type Analysis,
  type CabinetShielding,
  type Category,
  type ComponentTemplate,
  type Design,
  type HistoryMatch,
  type LabReport,
  type Level,
  type LimitPoint,
  type Panel,
  type Part,
  type ReqStatus,
  type Risk,
  type RuleId,
  type StandardsOverride,
} from "./types";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const tplOf = (part: Part): ComponentTemplate => TEMPLATE_BY_ID[part.templateId];

/** Display numbers of the seeded front-loader register; new risks number from 14. */
const SEEDED_NUMBERS: Record<string, number> = {
  "R1:U4>U3": 1, "R3:U5>X1": 2, "R5:U4>U2": 3, "R2:U4>U3": 4, "R2:U4>S1": 5, "R7:U4>U5": 6, "R6:U4>U2": 7,
  "R4:U4>U1": 8, "R9:H1>X1": 9, "R10:U4>X1": 10, "R8:EXT>U2": 11, "R1:U5>U3": 12, "R6:U1>U3": 13,
};

export function levelOf(score: number): Level | null {
  if (score >= LEVEL_BANDS.high) return "High";
  if (score >= LEVEL_BANDS.medium) return "Medium";
  if (score >= LEVEL_BANDS.low) return "Low";
  return null;
}

export function statusFor(
  testId: string,
  market: string,
  override: StandardsOverride = EMPTY_OVERRIDE,
): ReqStatus | undefined {
  const forced = override.status[`${testId}:${market}`];
  if (forced) return forced;
  return TEST_BY_ID[testId]?.markets[market as keyof (typeof TEST_BY_ID)[string]["markets"]]?.status;
}

/** Limit line of a standard after any edit or tightening in force. */
export function limitLineFor(standardId: string, override: StandardsOverride = EMPTY_OVERRIDE): LimitPoint[] | undefined {
  const base = override.limitLines[standardId] ?? STANDARD_BY_ID[standardId]?.limitLine;
  if (!base) return undefined;
  const delta = override.limitDeltaDb[standardId] ?? 0;
  return delta ? base.map((p) => ({ fMHz: p.fMHz, qp: p.qp - delta })) : base;
}

/** Quasi-peak limit at a frequency, interpolated on log frequency. */
export function limitAt(line: LimitPoint[], fMHz: number): number {
  if (fMHz <= line[0].fMHz) return line[0].qp;
  for (let i = 1; i < line.length; i++) {
    if (fMHz <= line[i].fMHz) {
      const a = line[i - 1];
      const b = line[i];
      const t = (Math.log10(fMHz) - Math.log10(a.fMHz)) / (Math.log10(b.fMHz) - Math.log10(a.fMHz) || 1);
      return a.qp + (b.qp - a.qp) * t;
    }
  }
  return line[line.length - 1].qp;
}

/** Insertion loss of the mains filter, dB. */
export function filterAttenuation(inlet: Part | undefined, fMHz: number): number {
  const stages = inlet?.filterStages ?? (inlet ? tplOf(inlet).filterStages ?? 0 : 0);
  if (!stages) return 0;
  const single = Math.min(60, 25.44 + 40 * Math.log10(fMHz / 0.15));
  return single + (stages >= 2 ? 12 : 0) + (inlet?.filterBoostDb ?? 0);
}

export interface HarmonicPoint {
  n: number;
  fMHz: number;
  level: number;
  limit: number;
}

/** Predicted quasi-peak spectrum of one switching source at the mains port. */
export function conductedSpectrum(source: Part, inlet: Part | undefined, line: LimitPoint[]): HarmonicPoint[] {
  const tpl = tplOf(source);
  if (!tpl.switchKHz || !tpl.conductedE0) return [];
  const f0 = tpl.switchKHz / 1000;
  const out: HarmonicPoint[] = [];
  for (let n = Math.ceil(0.15 / f0); n <= 400 && n * f0 <= 30; n++) {
    const fMHz = n * f0;
    const level =
      tpl.conductedE0 - 20 * Math.log10(n) - filterAttenuation(inlet, fMHz) - (source.spreadSpectrum ? 6 : 0);
    out.push({ n, fMHz, level, limit: limitAt(line, fMHz) });
  }
  return out;
}

/** Panel calculator: the walk from base shielding to effective shielding. */
export function panelShielding(panel: Panel) {
  const material = MATERIAL_BY_ID[panel.materialId];
  const base = material?.shieldingDb ?? 0;
  const steps: { label: string; delta: number }[] = [];
  if (!material?.conductive) {
    return { base, steps, effective: 0, leakMHz: 0, conductive: false };
  }
  steps.push({ label: `Thickness ${panel.thicknessMm} mm`, delta: Math.max(-6, Math.min(6, 20 * Math.log10(panel.thicknessMm))) });
  steps.push({ label: `Seams ${panel.seam}`, delta: -{ welded: 0, overlapped: 3, butt: 6 }[panel.seam] });
  steps.push({ label: `Screw pitch ${panel.screwPitchMm} mm`, delta: -Math.max(0, Math.min(12, 20 * Math.log10(panel.screwPitchMm / 50))) });
  steps.push({ label: panel.paintMasked ? "Paint masked at contacts" : "Paint under contacts", delta: panel.paintMasked ? 0 : -4 });
  const aperture = panel.apertureMm > 50 ? (panel.apertureScreened ? 3 : 10 * Math.log10(panel.apertureMm / 50)) : 0;
  steps.push({ label: panel.apertureMm ? `Aperture ${panel.apertureMm} mm${panel.apertureScreened ? " screened" : ""}` : "No aperture", delta: -aperture });
  const effective = Math.max(0, base + steps.reduce((sum, s) => sum + s.delta, 0));
  const leakMHz = panel.apertureMm && !panel.apertureScreened ? 150 / (panel.apertureMm / 1000) : 0;
  return { base, steps, effective, leakMHz, conductive: true };
}

export function cabinetShielding(design: Design): CabinetShielding {
  let worst: { panel: Panel; effective: number; leakMHz: number } | undefined;
  for (const panel of design.panels) {
    if (panel.outsideWrap) continue;
    const result = panelShielding(panel);
    if (!worst || result.effective < worst.effective) worst = { panel, effective: result.effective, leakMHz: result.leakMHz };
  }
  if (!worst) return { effectiveDb: 0, leakMHz: 0, aboveLeakDb: 0, limitingPanel: "none", limitingAperture: "no panels" };
  return {
    effectiveDb: Math.round(worst.effective),
    leakMHz: Math.round(worst.leakMHz / 10) * 10,
    aboveLeakDb: worst.leakMHz ? Math.min(6, Math.round(worst.effective)) : Math.round(worst.effective),
    limitingPanel: worst.panel.name,
    limitingAperture: worst.panel.apertureMm
      ? `${worst.panel.apertureLabel ?? "aperture"} ${worst.panel.apertureMm} mm ${worst.panel.apertureScreened ? "screened" : "unscreened"}`
      : "no aperture",
  };
}

function jaccard(a: string[], b: string[]): number {
  const setB = new Set(b);
  const inter = a.filter((t) => setB.has(t)).length;
  const union = new Set([...a, ...b]).size;
  return union ? inter / union : 0;
}

interface Draft {
  rule: RuleId;
  aggressor: string;
  victim: string;
  aggressorCat: Risk["aggressorCat"];
  victimCat: Risk["victimCat"];
  coupling: string;
  factor: number;
  modifiers: { label: string; value: number }[];
  testIds: string[];
  tags: string[];
  /** Skip the risk when no selected market carries one of its tests. */
  needsTest?: boolean;
  /** Safety items are scored at full weight in every market. */
  forceImpact?: number;
}

const RADIO_TESTS = ["RADIO-EMC", "RADIO-RF"];

function testsForVictim(rule: RuleId, sensitivity: ComponentTemplate["sensitivity"]): string[] {
  if (sensitivity === "radio") return RADIO_TESTS;
  if (rule === "R1") return ["RRF"];
  if (rule === "R5") return ["EFT", "CRF"];
  return [];
}

export function analyze(
  design: Design,
  override: StandardsOverride = EMPTY_OVERRIDE,
  history: LabReport[] = LAB_REPORTS,
): Analysis {
  const drafts: Draft[] = [];
  const evaluated = {} as Analysis["rulesEvaluated"];
  const count = (rule: RuleId) => {
    evaluated[rule] = evaluated[rule] ?? { pairs: 0, raised: 0 };
    evaluated[rule].pairs += 1;
  };
  (Object.keys(RULE_BY_ID) as RuleId[]).forEach((r) => (evaluated[r] = { pairs: 0, raised: 0 }));

  const parts = design.parts;
  const byRef = new Map(parts.map((p) => [p.ref, p]));
  const cat = (p: Part): Category => tplOf(p).category;
  const inlet = parts.find((p) => tplOf(p).mainsPort);
  const shielding = cabinetShielding(design);

  // R1 Radiated proximity: 3D edge-to-edge gap against the aggressor's critical distance.
  for (const a of parts) {
    const dCrit = tplOf(a).nearFieldMm;
    if (!dCrit) continue;
    for (const v of parts) {
      const sens = tplOf(v).sensitivity;
      if (v === a || !sens) continue;
      count("R1");
      const gap = boxGap(a, v);
      if (gap >= dCrit) continue;
      drafts.push({
        rule: "R1", aggressor: a.ref, victim: v.ref, aggressorCat: cat(a), victimCat: cat(v),
        coupling: `${Math.round(gap)} mm vs ${dCrit} mm critical distance`,
        factor: 1 - gap / dCrit,
        modifiers: [v.shieldCan ? { label: "Shield can fitted", value: -0.25 } : { label: "No shield can on victim", value: 0.06 }],
        testIds: testsForVictim("R1", sens),
        tags: ["radiated-proximity", `agg:${cat(a)}`, `vic:${cat(v)}`, v.shieldCan ? "shield-can" : "no-shield-can", gap / dCrit < 0.33 ? "tight-spacing" : "marginal-spacing"],
      });
    }
  }

  // R2 Harness crosstalk: length two cables share a loom, and their separation in the bundle.
  for (const harness of design.harnesses) {
    for (const ma of harness.members) {
      const ca = design.cables.find((c) => c.id === ma.cableId);
      if (!ca?.noisy) continue;
      for (const mv of harness.members) {
        const cv = design.cables.find((c) => c.id === mv.cableId);
        if (!cv?.sensitive) continue;
        count("R2");
        const coupled = Math.min(ma.to, mv.to) - Math.max(ma.from, mv.from);
        if (coupled <= 0) continue;
        const sep = Math.abs(ma.offset - mv.offset);
        const a = byRef.get(ca.from);
        const v = byRef.get(cv.to);
        if (!a || !v) continue;
        const mods: Draft["modifiers"] = [];
        if (cv.construction === "twisted") mods.push({ label: "Twisted victim pair", value: -0.18 });
        if (cv.construction === "unshielded-analog") mods.push({ label: "High-impedance analogue victim", value: 0.18 });
        if (cv.construction === "shielded") mods.push({ label: "Shielded victim cable", value: -0.5 });
        drafts.push({
          rule: "R2", aggressor: a.ref, victim: v.ref, aggressorCat: cat(a), victimCat: cat(v),
          coupling: `${Math.round(coupled)} mm alongside ${ca.kind.replace("-", " ")} ${ca.id} at ${Math.round(sep)} mm`,
          factor: Math.min(1, coupled / 1000) * Math.max(0, 1 - sep / 40),
          modifiers: mods,
          testIds: testsForVictim("R2", tplOf(v).sensitivity),
          tags: ["harness-crosstalk", `agg:${cat(a)}`, `vic:${cat(v)}`, "shared-loom", cv.construction],
        });
      }
    }
  }

  // R3 Conducted emissions: worst switching harmonic against every selected market's limit line.
  const ceLines = design.markets
    .map((m) => TEST_BY_ID.CE.markets[m]?.standardId)
    .filter((id): id is string => Boolean(id))
    .map((id) => ({ id, line: limitLineFor(id, override) }))
    .filter((l): l is { id: string; line: LimitPoint[] } => Boolean(l.line));
  if (inlet && ceLines.length) {
    for (const a of parts) {
      if (!tplOf(a).conductedE0) continue;
      count("R3");
      let worst: (HarmonicPoint & { std: string }) | undefined;
      for (const { id, line } of ceLines) {
        for (const h of conductedSpectrum(a, inlet, line)) {
          if (!worst || h.level - h.limit > worst.level - worst.limit) worst = { ...h, std: id };
        }
      }
      if (!worst) continue;
      const over = worst.level - worst.limit;
      const stages = inlet.filterStages ?? tplOf(inlet).filterStages ?? 0;
      const ordinal = worst.n === 1 ? "fundamental" : worst.n === 2 ? "2nd harmonic" : worst.n === 3 ? "3rd harmonic" : `${worst.n}th harmonic`;
      const rounded = Math.round(over);
      drafts.push({
        rule: "R3", aggressor: a.ref, victim: inlet.ref, aggressorCat: cat(a), victimCat: cat(inlet),
        coupling: `${ordinal} at ${worst.fMHz.toFixed(3)} MHz, ${rounded >= 0 ? `${rounded} dB over` : `${-rounded} dB under`} the limit`,
        factor: 0.5 + over / 20,
        modifiers: a.spreadSpectrum ? [] : [{ label: "Fixed-frequency switching", value: 0.1 }],
        testIds: ["CE"],
        tags: ["conducted-emissions", `agg:${cat(a)}`, stages >= 2 ? "two-stage-filter" : stages === 1 ? "single-stage-filter" : "no-filter", a.spreadSpectrum ? "spread-spectrum" : "fixed-frequency", worst.fMHz < 0.5 ? "low-band" : "high-band"],
      });
    }
  }

  // R4 Shared supply rail.
  for (const a of parts) {
    const ripple = tplOf(a).rippleClass;
    if (!ripple || !a.rail) continue;
    for (const v of parts) {
      if (v === a || v.rail !== a.rail || !tplOf(v).sensitivity) continue;
      count("R4");
      drafts.push({
        rule: "R4", aggressor: a.ref, victim: v.ref, aggressorCat: cat(a), victimCat: cat(v),
        coupling: `shares rail ${a.rail}, ${v.localFilter ? "local LC filter fitted" : "no local filter"}`,
        factor: ripple,
        modifiers: v.localFilter ? [{ label: "Local LC filter at victim", value: -0.4 }] : [],
        testIds: [],
        tags: ["shared-rail", `agg:${cat(a)}`, `vic:${cat(v)}`, v.localFilter ? "local-filter" : "no-local-filter"],
      });
    }
  }

  // R5 Common ground return: loop enclosed by a shared strap.
  for (const net of design.groundNets) {
    if (net.topology !== "shared" || net.members.length < 2) continue;
    const length = polylineLength(strapPath(design, net));
    const areaCm2 = (length * net.standoffMm) / 100;
    for (const aRef of net.members) {
      const a = byRef.get(aRef);
      const noise = a ? tplOf(a).returnNoise : undefined;
      if (!a || !noise) continue;
      for (const vRef of net.members) {
        const v = byRef.get(vRef);
        if (!v || v === a || !tplOf(v).sensitivity) continue;
        count("R5");
        drafts.push({
          rule: "R5", aggressor: a.ref, victim: v.ref, aggressorCat: cat(a), victimCat: cat(v),
          coupling: `shares a ${Math.round(length)} mm strap, ${Math.round(areaCm2)} cm² loop`,
          factor: Math.min(1, areaCm2 / 1000) * noise,
          modifiers: [],
          testIds: testsForVictim("R5", tplOf(v).sensitivity),
          tags: ["common-ground", `agg:${cat(a)}`, `vic:${cat(v)}`, "shared-strap", areaCm2 > 500 ? "large-loop" : "small-loop"],
        });
      }
    }
  }

  // R6 Harmonics of a switching or clock source inside a victim's working band.
  for (const a of parts) {
    const ta = tplOf(a);
    const f0kHz = ta.clockMHz ? ta.clockMHz * 1000 : ta.switchKHz;
    if (!f0kHz) continue;
    for (const v of parts) {
      const band = tplOf(v).victimBand;
      if (v === a || !band) continue;
      count("R6");
      if (v.freqHop) continue;
      const lo = band.unit === "MHz" ? band.lo * 1000 : band.lo;
      const hi = band.unit === "MHz" ? band.hi * 1000 : band.hi;
      const hits: number[] = [];
      for (let n = Math.max(2, Math.ceil(lo / f0kHz)); n <= 60 && n * f0kHz <= hi; n++) hits.push(n);
      if (!hits.length) continue;
      const mods: Draft["modifiers"] = [];
      if (hits[0] > 30) mods.push({ label: "High-order harmonics carry little energy", value: -0.45 });
      if (v.shieldCan) mods.push({ label: "Shield can fitted", value: -0.2 });
      if (a.spreadSpectrum) mods.push({ label: "Aggressor spread spectrum", value: -0.15 });
      const fmt = (n: number) => (band.unit === "MHz" ? Math.round((n * f0kHz) / 1000) : Math.round(n * f0kHz));
      const list = hits.slice(0, 3).map(fmt).join(" and ");
      drafts.push({
        rule: "R6", aggressor: a.ref, victim: v.ref, aggressorCat: cat(a), victimCat: cat(v),
        coupling: `${ta.clockMHz ? `${ta.clockMHz} MHz clock` : "PWM"} harmonics ${ta.clockMHz ? "at " : ""}${list} ${band.unit}${ta.clockMHz ? "" : " in band"}`,
        factor: Math.min(1, 0.3 + 0.2 * hits.length),
        modifiers: mods,
        testIds: testsForVictim("R6", tplOf(v).sensitivity),
        tags: ["harmonics-in-band", `agg:${cat(a)}`, `vic:${cat(v)}`, hits[0] > 30 ? "high-order" : "low-order"],
      });
    }
  }

  // R7 Thermal proximity: estimated victim temperature against its derated limit.
  for (const a of parts) {
    const heat = tplOf(a).dissipW ?? 0;
    if (heat < 5) continue;
    for (const v of parts) {
      const tv = tplOf(v);
      if (v === a || !tv.tempLimitC) continue;
      count("R7");
      const zone = zoneOf(design, v);
      const gap = boxGap(a, v);
      const above = center(v)[1] > center(a)[1];
      const rise =
        ((heat * 60) / (gap + 30)) * (zone && !zone.ventilated ? 1.5 : 1) * (above ? 1 : 0.6) * (v.thermalBaffle ? 0.4 : 1);
      const est = (zone?.ambientC ?? 40) + (tv.selfRiseC ?? 0) + rise;
      const factor = 0.5 + (est - tv.tempLimitC) / 10;
      if (factor < 0.1) continue;
      drafts.push({
        rule: "R7", aggressor: a.ref, victim: v.ref, aggressorCat: cat(a), victimCat: cat(v),
        coupling: `about ${Math.round(est)}°C vs ${tv.tempLimitC}°C derated limit`,
        factor,
        modifiers: [],
        testIds: [],
        tags: ["thermal-proximity", `agg:${cat(a)}`, `vic:${cat(v)}`, zone?.ventilated ? "ventilated" : "sealed"],
      });
    }
  }

  // R8 ESD exposure of user-accessible electronics.
  for (const v of parts) {
    if (!tplOf(v).userAccessible) continue;
    count("R8");
    drafts.push({
      rule: "R8", aggressor: "EXT", victim: v.ref, aggressorCat: "external", victimCat: cat(v),
      coupling: v.esdProtection ? "user-accessible, TVS array and guard ring fitted" : "user-accessible, no TVS array or guard ring",
      factor: 0.3,
      modifiers: [v.esdProtection ? { label: "TVS array and guard ring", value: -0.18 } : { label: "No TVS array or guard ring", value: 0.2 }],
      testIds: ["ESD"],
      tags: ["esd-exposure", `vic:${cat(v)}`, "user-accessible", v.esdProtection ? "tvs" : "no-tvs"],
    });
  }

  // R9 Flicker from cyclically switched heaters.
  for (const a of parts) {
    const watts = tplOf(a).heaterW;
    if (!watts || !inlet) continue;
    count("R9");
    const period = a.switchPeriodS ?? 20;
    const step = a.staged ? watts / 2 : watts;
    const changesPerMin = (60 / period) * (a.staged ? 2 : 1);
    const d = (step * 0.4 * 100) / (230 * 230);
    const dLim = 2.7 * Math.pow(changesPerMin, -0.3);
    const pst = d / dLim;
    drafts.push({
      rule: "R9", aggressor: a.ref, victim: inlet.ref, aggressorCat: cat(a), victimCat: cat(inlet),
      coupling: `${Math.round(step)} W switched every ${a.staged ? period / 2 : period} s, Pst about ${pst.toFixed(2)}`,
      factor: pst - 0.29,
      modifiers: [],
      testIds: ["FLICK"],
      needsTest: true,
      tags: ["flicker", `agg:${cat(a)}`, "cyclic-switching", period < 30 ? "short-period" : "long-period"],
    });
  }

  // R10 Harmonic current of capacitor-input rectifiers.
  for (const a of parts) {
    const watts = tplOf(a).rectifierW;
    if (!watts || !inlet) continue;
    count("R10");
    const pfc = a.pfc ?? "none";
    const i3 = (watts / 230) * (pfc === "active" ? 0.08 : pfc === "passive" ? 0.45 : 0.75);
    drafts.push({
      rule: "R10", aggressor: a.ref, victim: inlet.ref, aggressorCat: cat(a), victimCat: cat(inlet),
      coupling: `${watts} W rectifier input ${pfc === "none" ? "without PFC" : `with ${pfc} PFC`}, I3 about ${i3.toFixed(2)} A vs 2.30 A`,
      factor: 0.46 * (i3 / 2.3),
      modifiers: [],
      testIds: ["HARM"],
      needsTest: true,
      tags: ["harmonic-current", `agg:${cat(a)}`, `pfc-${pfc}`],
    });
  }

  // R11 Unearthed conductive surfaces, R14 earth continuity.
  const hasPe = design.groundNets.some((n) => n.protectiveEarth);
  for (const panel of design.panels) {
    if (!MATERIAL_BY_ID[panel.materialId]?.conductive) continue;
    count("R11");
    if (panel.earthBonded) continue;
    drafts.push({
      rule: "R11", aggressor: panel.id, victim: "EXT", aggressorCat: "panel", victimCat: "external",
      coupling: `${panel.name} is conductive and has no earth bond`,
      factor: 0.55, modifiers: [], testIds: ["RE", "ESD"],
      tags: ["unearthed-surface", "floating-panel", panel.materialId],
    });
  }
  if (design.protectionClass === "I") {
    count("R14");
    const floating = design.panels.filter((p) => MATERIAL_BY_ID[p.materialId]?.conductive && !p.earthBonded);
    if (!hasPe || floating.length) {
      drafts.push({
        rule: "R14", aggressor: floating[0]?.id ?? "PE", victim: "EXT", aggressorCat: "panel", victimCat: "external",
        coupling: !hasPe ? "Class I cabinet without a protective earth net" : `${floating.length} accessible panel${floating.length > 1 ? "s" : ""} outside the protective earth path`,
        factor: 0.8, modifiers: [], testIds: ["EARTH"], forceImpact: 1,
        tags: ["earth-continuity", "class-i", hasPe ? "floating-panel" : "no-pe-net"],
      });
    }
  }

  // R12 Aperture leakage: clock sources behind a cabinet that barely shields.
  for (const a of parts) {
    const clock = tplOf(a).clockMHz;
    if (!clock || clock < 30) continue;
    count("R12");
    if (shielding.effectiveDb >= 12) continue;
    drafts.push({
      rule: "R12", aggressor: a.ref, victim: "EXT", aggressorCat: cat(a), victimCat: "external",
      coupling: `${shielding.effectiveDb} dB cabinet shielding, limited by ${shielding.limitingPanel.toLowerCase()}`,
      factor: 0.3 + (12 - shielding.effectiveDb) / 20, modifiers: [], testIds: ["RE"],
      tags: ["aperture-leakage", `agg:${cat(a)}`, "weak-cabinet"],
    });
  }

  // R13 Cable resonance: a lead near a quarter wavelength of a clock harmonic.
  for (const a of parts) {
    const clock = tplOf(a).clockMHz;
    if (!clock) continue;
    for (const cable of design.cables) {
      if (cable.from !== a.ref && cable.to !== a.ref) continue;
      count("R13");
      const metres = cableLength(design, cable) / 1000;
      for (let n = 1; n <= 3; n++) {
        const quarter = 75 / (clock * n);
        if (Math.abs(metres - quarter) / quarter > 0.03) continue;
        const other = cable.from === a.ref ? cable.to : cable.from;
        drafts.push({
          rule: "R13", aggressor: a.ref, victim: other, aggressorCat: cat(a), victimCat: byRef.get(other) ? cat(byRef.get(other)!) : "external",
          coupling: `${cable.id} is ${Math.round(metres * 1000)} mm, a quarter wave at ${clock * n} MHz`,
          factor: 0.4, modifiers: cable.ferrite ? [{ label: "Ferrite clamp", value: -0.3 }] : [], testIds: ["RE"],
          tags: ["cable-resonance", `agg:${cat(a)}`, cable.kind, cable.ferrite ? "ferrite" : "no-ferrite"],
        });
        break;
      }
    }
  }

  // Score, weight by the markets in scope, adjust for lab history, band.
  const risks: Risk[] = [];
  for (const d of drafts) {
    let impact = 0;
    let basis = "";
    const liveTests: string[] = [];
    const standards: string[] = [];
    for (const testId of d.testIds) {
      for (const market of design.markets) {
        const status = statusFor(testId, market, override);
        const entry = TEST_BY_ID[testId]?.markets[market];
        if (!status) continue;
        if (!liveTests.includes(testId)) liveTests.push(testId);
        // A status forced by the standards watch may have no published standard behind it yet.
        const code = entry ? STANDARD_BY_ID[entry.standardId]?.code : `Simulated requirement, ${market}`;
        if (code && !standards.includes(code)) standards.push(code);
        if (IMPACT_WEIGHT[status] > impact) {
          impact = IMPACT_WEIGHT[status];
          basis = `${status} in ${market}`;
        }
      }
    }
    if (d.needsTest && !liveTests.length) continue;
    if (d.forceImpact) {
      impact = d.forceImpact;
      basis = "safety, every market";
    } else if (!liveTests.length) {
      impact = IMPACT_WEIGHT.functional;
      basis = "functional";
    }

    const matches: HistoryMatch[] = [];
    let historyAdj = 0;
    for (const report of history) {
      const j = jaccard(d.tags, report.tags);
      if (j < HISTORY_ADJ.partial.jaccard) continue;
      matches.push({ reportId: report.id, jaccard: j, result: report.result });
      if (report.result === "fail") {
        historyAdj = Math.max(historyAdj, j >= HISTORY_ADJ.strong.jaccard ? HISTORY_ADJ.strong.add : HISTORY_ADJ.partial.add);
      }
    }

    const modSum = d.modifiers.reduce((sum, m) => sum + m.value, 0);
    const base = Math.round(100 * clamp01(d.factor + modSum) * impact + 1e-6);
    if (base < LEVEL_BANDS.low) continue;
    const score = Math.min(100, base + historyAdj);
    const level = levelOf(score);
    if (!level) continue;
    const key = `${d.rule}:${d.aggressor}>${d.victim}`;
    evaluated[d.rule].raised += 1;
    risks.push({
      key, num: 0, rule: d.rule, mechanism: RULE_BY_ID[d.rule].mechanism, path: RULE_BY_ID[d.rule].path,
      aggressor: d.aggressor, victim: d.victim, aggressorCat: d.aggressorCat, victimCat: d.victimCat,
      coupling: d.coupling, factor: d.factor, modifiers: d.modifiers, impact, impactBasis: basis, historyAdj,
      score, level, testIds: liveTests, standards, tags: d.tags,
      matches: matches.sort((a, b) => b.jaccard - a.jaccard),
    });
  }

  let next = 14;
  for (const risk of [...risks].sort((a, b) => a.key.localeCompare(b.key))) {
    risk.num = SEEDED_NUMBERS[risk.key] ?? next++;
  }
  risks.sort((a, b) => b.score - a.score || a.num - b.num);

  const counts: Record<Level, number> = { High: 0, Medium: 0, Low: 0 };
  for (const r of risks) counts[r.level] += 1;

  return { designId: design.id, risks, index: riskIndex(risks.map((r) => r.score)), counts, shielding, rulesEvaluated: evaluated };
}

/**
 * Design risk index, 0 to 100: the worst risk, the mean of the three worst,
 * and one point per High. A single unresolved High keeps the index high;
 * clearing them one by one walks it down.
 */
export function riskIndex(scores: number[]): number {
  if (!scores.length) return 0;
  const sorted = [...scores].sort((a, b) => b - a);
  const top3 = (sorted[0] + (sorted[1] ?? 0) + (sorted[2] ?? 0)) / 3;
  const highs = sorted.filter((s) => s >= LEVEL_BANDS.high).length;
  return Math.min(100, Math.round(0.45 * sorted[0] + 0.55 * top3 + highs));
}
