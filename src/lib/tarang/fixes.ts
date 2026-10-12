/**
 * Fix catalogue. Every fix is a pure edit of the design, so its effect is
 * measured by re-running the rule engine rather than quoted from a table.
 */

import { TEMPLATE_BY_ID } from "./catalog";
import { boxGap, boxesIntersect } from "./geometry";
import type { Design, FixType, Part, RuleId } from "./types";

export interface FixTarget {
  rule: RuleId;
  aggressor: string;
  victim: string;
}

export interface FixDef {
  id: string;
  type: FixType;
  rules: RuleId[];
  title: (t: FixTarget, d: Design) => string;
  detail: string;
  /** Engineering hours when done at layout stage. */
  effortHours: number;
  /** Added unit or tooling cost at design stage, USD. */
  designCostUsd: number;
  /** Cost of the same change after a failed lab test: re-spin, retest, expedite. */
  postLabCostUsd: number;
  postLabWeeks: number;
  applies?: (t: FixTarget, d: Design) => boolean;
  apply: (d: Design, t: FixTarget) => Design;
}

export function parseRiskKey(key: string): FixTarget {
  const [rule, pair] = key.split(":");
  const [aggressor, victim] = pair.split(">");
  return { rule: rule as RuleId, aggressor, victim };
}

const mapPart = (d: Design, ref: string, fn: (p: Part) => Part): Design => ({
  ...d,
  parts: d.parts.map((p) => (p.ref === ref ? fn(p) : p)),
});

const inletRef = (d: Design) => d.parts.find((p) => TEMPLATE_BY_ID[p.templateId].mainsPort)?.ref ?? "";

/** First named slot that clears every near-field keep-out and hot neighbour. */
export function clearSlotFor(d: Design, ref: string) {
  const part = d.parts.find((p) => p.ref === ref);
  if (!part) return undefined;
  return d.slots.find((slot) => {
    const moved: Part = { ...part, pos: slot.pos };
    return d.parts.every((other) => {
      if (other.ref === ref) return true;
      if (boxesIntersect(moved, other)) return false;
      const tpl = TEMPLATE_BY_ID[other.templateId];
      const gap = boxGap(moved, other);
      if (tpl.nearFieldMm && gap < tpl.nearFieldMm * 1.2) return false;
      if ((tpl.dissipW ?? 0) >= 5 && gap < 150) return false;
      return true;
    });
  });
}

export const FIXES: FixDef[] = [
  {
    id: "move-victim", type: "Placement", rules: ["R1", "R7"],
    title: (t, d) => `Move ${t.victim} to ${clearSlotFor(d, t.victim)?.name.toLowerCase() ?? "a clear slot"}`,
    detail: "Relocates the victim outside every near-field keep-out and away from hot neighbours. The cable follows the part.",
    effortHours: 6, designCostUsd: 400, postLabCostUsd: 46000, postLabWeeks: 6,
    applies: (t, d) => Boolean(clearSlotFor(d, t.victim)),
    apply: (d, t) => {
      const slot = clearSlotFor(d, t.victim);
      return slot ? mapPart(d, t.victim, (p) => ({ ...p, pos: slot.pos })) : d;
    },
  },
  {
    id: "shield-can", type: "Shielding", rules: ["R1", "R6"],
    title: (t) => `Fit a shield can over ${t.victim}`,
    detail: "Tin-plated steel can soldered to a ground ring. Helps near-field pickup; does little for an antenna that must see out.",
    effortHours: 10, designCostUsd: 1800, postLabCostUsd: 28000, postLabWeeks: 4,
    applies: (t, d) => {
      const v = d.parts.find((p) => p.ref === t.victim);
      const kind = v ? TEMPLATE_BY_ID[v.templateId].sensitivity : undefined;
      return Boolean(v && !v.shieldCan && (kind === "radio" || kind === "logic"));
    },
    apply: (d, t) => mapPart(d, t.victim, (p) => ({ ...p, shieldCan: true })),
  },
  {
    id: "conduit-aggressor", type: "Harness", rules: ["R2"],
    title: (t) => `Pull the ${t.aggressor} power cable into its own screened conduit`,
    detail: "Takes the noisy conductor out of the shared loom, which clears every signal lead that ran beside it.",
    effortHours: 8, designCostUsd: 2200, postLabCostUsd: 31000, postLabWeeks: 4,
    apply: (d, t) => {
      const noisy = new Set(d.cables.filter((c) => c.noisy && c.from === t.aggressor).map((c) => c.id));
      return { ...d, harnesses: d.harnesses.map((h) => ({ ...h, members: h.members.filter((m) => !noisy.has(m.cableId)) })) };
    },
  },
  {
    id: "reroute-victim", type: "Harness", rules: ["R2"],
    title: (t) => `Route the ${t.victim} lead outside the motor loom`,
    detail: "A separate run with at least 40 mm clearance from switched power conductors.",
    effortHours: 4, designCostUsd: 600, postLabCostUsd: 17000, postLabWeeks: 3,
    apply: (d, t) => {
      const lead = new Set(d.cables.filter((c) => c.sensitive && c.to === t.victim).map((c) => c.id));
      return { ...d, harnesses: d.harnesses.map((h) => ({ ...h, members: h.members.filter((m) => !lead.has(m.cableId)) })) };
    },
  },
  {
    id: "shield-victim-cable", type: "Shielding", rules: ["R2"],
    title: (t) => `Shielded twisted lead to ${t.victim}`,
    detail: "Foil-screened twisted pair with the drain wire bonded at the controller end only.",
    effortHours: 5, designCostUsd: 1400, postLabCostUsd: 19000, postLabWeeks: 3,
    applies: (t, d) => d.cables.some((c) => c.sensitive && c.to === t.victim && c.construction !== "shielded"),
    apply: (d, t) => ({
      ...d,
      cables: d.cables.map((c) => (c.sensitive && c.to === t.victim ? { ...c, construction: "shielded" as const } : c)),
    }),
  },
  {
    id: "filter-2stage", type: "Filtering", rules: ["R3"],
    title: () => "Second filter stage at the mains inlet",
    detail: "Adds a differential choke and X2 capacitor: about 12 dB more insertion loss from 150 kHz.",
    effortHours: 12, designCostUsd: 2600, postLabCostUsd: 36000, postLabWeeks: 4,
    applies: (_t, d) => {
      const inlet = d.parts.find((p) => p.ref === inletRef(d));
      return Boolean(inlet && (inlet.filterStages ?? TEMPLATE_BY_ID[inlet.templateId].filterStages ?? 0) < 2);
    },
    apply: (d) => mapPart(d, inletRef(d), (p) => ({ ...p, filterStages: 2 })),
  },
  {
    id: "jitter", type: "Firmware", rules: ["R3", "R6"],
    title: (t) => `Enable frequency jitter on ${t.aggressor}`,
    detail: "Spreads each harmonic over several resolution bandwidths: about 6 dB less quasi-peak.",
    effortHours: 3, designCostUsd: 0, postLabCostUsd: 9000, postLabWeeks: 2,
    applies: (t, d) => {
      const a = d.parts.find((p) => p.ref === t.aggressor);
      return Boolean(a && !a.spreadSpectrum);
    },
    apply: (d, t) => mapPart(d, t.aggressor, (p) => ({ ...p, spreadSpectrum: true })),
  },
  {
    id: "xy-cap", type: "Component", rules: ["R3"],
    title: () => "Larger X and Y capacitors in the inlet filter",
    detail: "0.47 µF to 1 µF X2 and 2.2 nF to 4.7 nF Y2: about 4 dB, limited by earth-leakage current.",
    effortHours: 4, designCostUsd: 700, postLabCostUsd: 14000, postLabWeeks: 3,
    applies: (_t, d) => !d.parts.find((p) => p.ref === inletRef(d))?.filterBoostDb,
    apply: (d) => mapPart(d, inletRef(d), (p) => ({ ...p, filterBoostDb: 4 })),
  },
  {
    id: "local-filter", type: "Filtering", rules: ["R4"],
    title: (t) => `Local LC filter on the ${t.victim} supply`,
    detail: "Ferrite bead plus 10 µF at the victim's rail entry.",
    effortHours: 3, designCostUsd: 300, postLabCostUsd: 12000, postLabWeeks: 3,
    applies: (t, d) => !d.parts.find((p) => p.ref === t.victim)?.localFilter,
    apply: (d, t) => mapPart(d, t.victim, (p) => ({ ...p, localFilter: true })),
  },
  {
    id: "star-ground", type: "Grounding", rules: ["R5"],
    title: () => "Star ground at the inlet earth stud",
    detail: "Each board returns on its own short strap, so drive return current no longer flows past the victim.",
    effortHours: 6, designCostUsd: 900, postLabCostUsd: 44000, postLabWeeks: 5,
    apply: (d, t) => ({
      ...d,
      groundNets: d.groundNets.map((n) =>
        n.members.includes(t.aggressor) && n.members.includes(t.victim) ? { ...n, topology: "star" as const } : n,
      ),
    }),
  },
  {
    id: "strap-chassis", type: "Grounding", rules: ["R5"],
    title: () => "Dress the shared strap flat against the chassis",
    detail: "Cuts the loop standoff to about 15 mm. The return path is still shared.",
    effortHours: 2, designCostUsd: 100, postLabCostUsd: 15000, postLabWeeks: 3,
    applies: (t, d) => d.groundNets.some((n) => n.members.includes(t.aggressor) && n.members.includes(t.victim) && n.standoffMm > 15),
    apply: (d, t) => ({
      ...d,
      groundNets: d.groundNets.map((n) =>
        n.members.includes(t.aggressor) && n.members.includes(t.victim) ? { ...n, standoffMm: 15 } : n,
      ),
    }),
  },
  {
    id: "freq-hop", type: "Firmware", rules: ["R6"],
    title: (t) => `Frequency hopping on the ${t.victim} scan`,
    detail: "The controller measures noise per scan frequency and hops off any carrier that lands in band.",
    effortHours: 5, designCostUsd: 0, postLabCostUsd: 11000, postLabWeeks: 2,
    applies: (t, d) => {
      const v = d.parts.find((p) => p.ref === t.victim);
      return Boolean(v && !v.freqHop && TEMPLATE_BY_ID[v.templateId].sensitivity === "touch");
    },
    apply: (d, t) => mapPart(d, t.victim, (p) => ({ ...p, freqHop: true })),
  },
  {
    id: "baffle", type: "Thermal", rules: ["R7"],
    title: (t) => `Baffle and vent slot between ${t.aggressor} and ${t.victim}`,
    detail: "A folded aluminium baffle diverts the plume; coupled rise falls to about 40 %.",
    effortHours: 5, designCostUsd: 500, postLabCostUsd: 21000, postLabWeeks: 4,
    applies: (t, d) => !d.parts.find((p) => p.ref === t.victim)?.thermalBaffle,
    apply: (d, t) => mapPart(d, t.victim, (p) => ({ ...p, thermalBaffle: true })),
  },
  {
    id: "tvs", type: "Component", rules: ["R8"],
    title: (t) => `TVS array and guard ring on ${t.victim}`,
    detail: "Low-capacitance TVS on each sense line and a grounded copper ring around the electrode field.",
    effortHours: 4, designCostUsd: 500, postLabCostUsd: 19000, postLabWeeks: 3,
    applies: (t, d) => !d.parts.find((p) => p.ref === t.victim)?.esdProtection,
    apply: (d, t) => mapPart(d, t.victim, (p) => ({ ...p, esdProtection: true })),
  },
  {
    id: "heater-dwell", type: "Firmware", rules: ["R9"],
    title: (t) => `Zero-cross control with a 120 s minimum dwell on ${t.aggressor}`,
    detail: "Fewer voltage changes per minute moves the load down the Pst curve. Wash temperature ripple rises by about 1 °C.",
    effortHours: 4, designCostUsd: 0, postLabCostUsd: 9000, postLabWeeks: 2,
    applies: (t, d) => (d.parts.find((p) => p.ref === t.aggressor)?.switchPeriodS ?? 20) < 120,
    apply: (d, t) => mapPart(d, t.aggressor, (p) => ({ ...p, switchPeriodS: 120 })),
  },
  {
    id: "heater-staged", type: "Component", rules: ["R9"],
    title: (t) => `Split ${t.aggressor} into two staged elements`,
    detail: "Two half-power elements on separate relays halve each voltage step.",
    effortHours: 16, designCostUsd: 5200, postLabCostUsd: 52000, postLabWeeks: 7,
    applies: (t, d) => !d.parts.find((p) => p.ref === t.aggressor)?.staged,
    apply: (d, t) => mapPart(d, t.aggressor, (p) => ({ ...p, staged: true })),
  },
  {
    id: "pfc-active", type: "Component", rules: ["R10"],
    title: (t) => `Active PFC stage ahead of ${t.aggressor}`,
    detail: "Boost PFC brings the third harmonic to about 8 % of the fundamental.",
    effortHours: 30, designCostUsd: 9800, postLabCostUsd: 68000, postLabWeeks: 8,
    applies: (t, d) => d.parts.find((p) => p.ref === t.aggressor)?.pfc !== "active",
    apply: (d, t) => mapPart(d, t.aggressor, (p) => ({ ...p, pfc: "active" })),
  },
  {
    id: "pfc-passive", type: "Component", rules: ["R10"],
    title: (t) => `Passive PFC choke on the ${t.aggressor} DC link`,
    detail: "A 5 mH line choke widens the conduction angle: third harmonic about 45 % of the fundamental.",
    effortHours: 8, designCostUsd: 3100, postLabCostUsd: 38000, postLabWeeks: 5,
    applies: (t, d) => (d.parts.find((p) => p.ref === t.aggressor)?.pfc ?? "none") === "none",
    apply: (d, t) => mapPart(d, t.aggressor, (p) => ({ ...p, pfc: "passive" })),
  },
  {
    id: "bond-panel", type: "Grounding", rules: ["R11", "R14"],
    title: (t, d) => `Bond ${d.panels.find((p) => p.id === t.aggressor)?.name.toLowerCase() ?? "the panel"} to protective earth`,
    detail: "Star washer through masked paint and a 2.5 mm² bond lead to the earth stud.",
    effortHours: 2, designCostUsd: 150, postLabCostUsd: 16000, postLabWeeks: 3,
    apply: (d, t) => ({
      ...d,
      panels: d.panels.map((p) => (p.id === t.aggressor || t.rule === "R14" ? { ...p, earthBonded: true } : p)),
      groundNets: d.groundNets.some((n) => n.protectiveEarth)
        ? d.groundNets
        : d.groundNets.map((n, i) => (i === 0 ? { ...n, protectiveEarth: true } : n)),
    }),
  },
  {
    id: "screen-aperture", type: "Shielding", rules: ["R12"],
    title: () => "Conductive mesh across the limiting aperture",
    detail: "Bonded mesh restores most of the panel's shielding above the leak frequency.",
    effortHours: 14, designCostUsd: 7400, postLabCostUsd: 61000, postLabWeeks: 8,
    apply: (d) => {
      let worst = -1;
      d.panels.forEach((p, i) => {
        if (!p.outsideWrap && !p.apertureScreened && (worst < 0 || p.apertureMm > d.panels[worst].apertureMm)) worst = i;
      });
      return { ...d, panels: d.panels.map((p, i) => (i === worst ? { ...p, apertureScreened: true } : p)) };
    },
  },
  {
    id: "ferrite", type: "Filtering", rules: ["R13"],
    title: (t) => `Ferrite clamp on the ${t.aggressor} to ${t.victim} lead`,
    detail: "Snap-on NiZn core at the board end damps the cable resonance.",
    effortHours: 1, designCostUsd: 200, postLabCostUsd: 12000, postLabWeeks: 2,
    apply: (d, t) => ({
      ...d,
      cables: d.cables.map((c) =>
        (c.from === t.aggressor && c.to === t.victim) || (c.to === t.aggressor && c.from === t.victim) ? { ...c, ferrite: true } : c,
      ),
    }),
  },
];

export const FIX_BY_ID = Object.fromEntries(FIXES.map((f) => [f.id, f])) as Record<string, FixDef>;

/** A fix bound to a risk: `fixId@riskKey`. */
export const fixInstanceId = (fixId: string, riskKey: string) => `${fixId}@${riskKey}`;

export function parseFixInstance(instance: string): { fix: FixDef; target: FixTarget; riskKey: string } | undefined {
  const at = instance.indexOf("@");
  const fix = FIX_BY_ID[instance.slice(0, at)];
  if (!fix || at < 0) return undefined;
  const riskKey = instance.slice(at + 1);
  return { fix, target: parseRiskKey(riskKey), riskKey };
}

export function applyFixes(design: Design, instances: string[]): Design {
  return instances.reduce((d, instance) => {
    const parsed = parseFixInstance(instance);
    return parsed ? parsed.fix.apply(d, parsed.target) : d;
  }, design);
}

export const FIX_TYPES: FixType[] = [
  "Placement", "Filtering", "Grounding", "Harness", "Shielding", "Firmware", "Component", "Thermal",
];
