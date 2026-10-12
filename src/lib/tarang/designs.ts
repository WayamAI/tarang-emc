/** Seeded designs. AquaLine FL-8 is modelled in full; three sibling programmes use the same engine. */

import { TEMPLATE_BY_ID } from "./catalog";
import { applyFixes } from "./fixes";
import type { Cable, Design, GroundNet, Harness, Panel, Part, Slot, Vec3, Zone } from "./types";

type PartSeed = [ref: string, templateId: string, pos: Vec3, extra?: Partial<Part>];

function parts(seeds: PartSeed[]): Part[] {
  return seeds.map(([ref, templateId, pos, extra]) => {
    const tpl = TEMPLATE_BY_ID[templateId];
    return { id: ref, ref, templateId, name: tpl.name, pos, size: tpl.size, ...extra };
  });
}

function zones(e: Vec3, ambient: [number, number, number, number, number] = [35, 38, 38, 40, 42]): Zone[] {
  const [w, h, d] = e;
  const top = h - 110;
  return [
    { id: "top", name: "Top console", min: [0, top, 0], max: [w, h, d], ventilated: true, ambientC: ambient[0] },
    { id: "left", name: "Left column", min: [0, 200, 0], max: [90, top, d], ventilated: true, ambientC: ambient[1] },
    { id: "right", name: "Right column", min: [w - 90, 200, 0], max: [w, top, d], ventilated: true, ambientC: ambient[2] },
    { id: "drum", name: "Drum", min: [90, 200, 0], max: [w - 90, top, d], ventilated: false, ambientC: ambient[3] },
    { id: "base", name: "Base", min: [0, 0, 0], max: [w, 200, d], ventilated: false, ambientC: ambient[4] },
  ];
}

function panels(aperture: number, apertureLabel: string, overrides: Partial<Record<string, Partial<Panel>>> = {}): Panel[] {
  const steel = { materialId: "steel-crs", thicknessMm: 0.8, earthBonded: true, seam: "overlapped" as const, screwPitchMm: 100, paintMasked: true };
  const list: Panel[] = [
    { id: "front", name: "Front panel and door", ...steel, apertureMm: aperture, apertureLabel },
    { id: "wrap-left", name: "Left side wrap", ...steel, seam: "welded", apertureMm: 0 },
    { id: "wrap-right", name: "Right side wrap", ...steel, seam: "welded", apertureMm: 0 },
    { id: "rear", name: "Rear panel", ...steel, materialId: "steel-galv", thicknessMm: 0.6, screwPitchMm: 120, apertureMm: 90, apertureLabel: "service cut-out" },
    { id: "top", name: "Top cover", ...steel, apertureMm: 0 },
    { id: "fascia", name: "Console fascia", materialId: "abs", thicknessMm: 3, earthBonded: false, seam: "butt", screwPitchMm: 150, paintMasked: true, apertureMm: 0, outsideWrap: true },
    { id: "base", name: "Base moulding", materialId: "pp-gf", thicknessMm: 2.5, earthBonded: false, seam: "butt", screwPitchMm: 200, paintMasked: true, apertureMm: 0, outsideWrap: true },
  ];
  return list.map((p) => ({ ...p, ...overrides[p.id] }));
}

// --- AquaLine FL-8 ---------------------------------------------------------

const AQ_PARTS = parts([
  ["U1", "mcu-board", [120, 30, 60], { name: "Main control board", rail: "R1" }],
  ["U2", "touch-ui", [330, 770, 10], { name: "Touch UI board", rail: "R2" }],
  ["U3", "wifi-ble", [20, 698, 450], { name: "Wi-Fi / BLE module", rail: "R2" }],
  ["U4", "inv-550", [15, 520, 420], { name: "Inverter motor drive", rail: "R1", pfc: "none" }],
  ["U5", "flyback-24", [10, 743, 430], { name: "Flyback SMPS" }],
  ["M1", "bldc", [300, 30, 330], { name: "BLDC motor" }],
  ["H1", "heater-2000", [190, 205, 150], { name: "Heater 2000 W", switchPeriodS: 20 }],
  ["L1", "door-lock", [540, 430, 10], { name: "Door lock" }],
  ["S1", "ntc-level", [540, 560, 300], { name: "NTC + water-level sensors" }],
  ["X1", "mains-filter", [470, 770, 520], { name: "Mains inlet with EMI filter", filterStages: 1 }],
  ["P1", "drain-pump", [430, 25, 60], { name: "Drain pump" }],
]);

const AQ_CABLES: Cable[] = [
  { id: "C1", name: "Mains to SMPS", from: "X1", to: "U5", kind: "mains", construction: "flat", via: [[510, 830, 550], [55, 830, 550], [55, 830, 465]] },
  { id: "C2", name: "Mains to drive", from: "X1", to: "U4", kind: "mains", construction: "flat", via: [[510, 812, 570], [25, 812, 570], [25, 600, 570]] },
  { id: "C3", name: "Motor phase U/V/W", from: "U4", to: "M1", kind: "motor-phase", noisy: true, construction: "flat" },
  { id: "C4", name: "Heater feed", from: "U1", to: "H1", kind: "heater", construction: "flat", via: [[210, 120, 120], [300, 120, 180]] },
  { id: "C5", name: "24 V rail R1 to control", from: "U5", to: "U1", kind: "dc-rail", construction: "flat" },
  { id: "C6", name: "24 V rail R1 to drive", from: "U5", to: "U4", kind: "dc-rail", construction: "flat", via: [[105, 760, 520], [105, 600, 520]] },
  { id: "C7", name: "UI ribbon", from: "U1", to: "U2", kind: "signal", construction: "flat", via: [[560, 42, 120], [560, 720, 60], [440, 800, 40]] },
  { id: "C8", name: "Wi-Fi UART and 3V3", from: "U1", to: "U3", kind: "comms", sensitive: true, construction: "twisted" },
  { id: "C9", name: "NTC and level sense", from: "U1", to: "S1", kind: "sensor", sensitive: true, construction: "unshielded-analog" },
  { id: "C10", name: "Door lock", from: "U1", to: "L1", kind: "actuator", construction: "flat", via: [[300, 42, 20], [580, 42, 20]] },
  { id: "C11", name: "Drain pump", from: "U1", to: "P1", kind: "actuator", construction: "flat", via: [[360, 60, 110]] },
  { id: "C12", name: "Drive command, isolated", from: "U1", to: "U4", kind: "comms", construction: "twisted" },
];

const AQ_HARNESS: Harness = {
  id: "H-1",
  name: "Main loom, left rear column",
  trunk: [[200, 45, 200], [78, 45, 200], [78, 45, 400], [78, 720, 400], [78, 780, 400], [300, 780, 400]],
  members: [
    { cableId: "C3", from: 47, to: 957, offset: 0 },
    { cableId: "C8", from: 0, to: 997, offset: 8 },
    { cableId: "C9", from: 177, to: 1279, offset: -6 },
    { cableId: "C5", from: 0, to: 1057, offset: 20 },
    { cableId: "C12", from: 0, to: 900, offset: -16 },
  ],
};

const AQ_GROUND: GroundNet[] = [
  {
    id: "G1", name: "Drive and UI chassis strap", topology: "shared", members: ["U4", "U2"],
    points: [[40, 600, 550], [40, 790, 550], [40, 790, 18], [415, 790, 18]],
    anchors: [[15, 520, 420], [330, 770, 10]], standoffMm: 85.2, protectiveEarth: false,
  },
  {
    id: "G2", name: "Protective earth, inlet stud to cabinet", topology: "star", members: ["X1"],
    points: [[540, 790, 580], [590, 790, 590]], anchors: [[470, 770, 520], [470, 770, 520]], standoffMm: 5, protectiveEarth: true,
  },
];

const AQ_SLOTS: Slot[] = [
  { id: "console-front-left", name: "Top console, front-left behind the fascia", pos: [60, 800, 30] },
  { id: "console-rear-centre", name: "Top console, rear centre", pos: [230, 790, 470] },
  { id: "right-column-upper", name: "Right column, upper bracket", pos: [520, 600, 150] },
];

const AQ_V1: Design = {
  id: "aqualine-fl8-v1",
  programId: "P-AQ",
  product: "AquaLine FL-8",
  family: "AquaLine",
  version: "v1",
  note: "As designed",
  createdAt: "2026-09-21",
  author: "Tomasz Brenner",
  markets: ["EU", "US"],
  enclosure: [600, 850, 600],
  protectionClass: "I",
  parts: AQ_PARTS,
  cables: AQ_CABLES,
  harnesses: [AQ_HARNESS],
  groundNets: AQ_GROUND,
  zones: zones([600, 850, 600]),
  panels: panels(480, "door window"),
  slots: AQ_SLOTS,
  appliedFixes: [],
};

const V11_FIXES = ["jitter@R3:U5>X1"];
const V2_FIXES = [
  "move-victim@R1:U4>U3",
  "shield-can@R1:U4>U3",
  "conduit-aggressor@R2:U4>U3",
  "filter-2stage@R3:U5>X1",
  "jitter@R3:U5>X1",
  "star-ground@R5:U4>U2",
  "baffle@R7:U4>U5",
  "freq-hop@R6:U4>U2",
  "local-filter@R4:U4>U1",
  "pfc-active@R10:U4>X1",
  "tvs@R8:EXT>U2",
];

const AQ_V11: Design = {
  ...applyFixes(AQ_V1, V11_FIXES),
  id: "aqualine-fl8-v1-1", version: "v1.1", note: "SMPS jitter only", parentId: AQ_V1.id,
  createdAt: "2026-09-30", author: "Anika Rao", appliedFixes: V11_FIXES,
};

const AQ_V2: Design = {
  ...applyFixes(AQ_V1, V2_FIXES),
  id: "aqualine-fl8-v2", version: "v2", note: "Fixes applied", parentId: AQ_V1.id,
  createdAt: "2026-10-08", author: "Tomasz Brenner", appliedFixes: V2_FIXES,
};

// --- Sibling programmes ----------------------------------------------------

function sibling(
  base: Pick<Design, "id" | "programId" | "product" | "family" | "version" | "note" | "createdAt" | "author" | "markets" | "enclosure">,
  seeds: PartSeed[],
  cables: Cable[],
  harness: Harness | undefined,
  ground: GroundNet[],
  aperture: [number, string],
  slots: Slot[],
): Design {
  return {
    ...base, protectionClass: "I", parts: parts(seeds), cables, harnesses: harness ? [harness] : [], groundNets: ground,
    zones: zones(base.enclosure), panels: panels(aperture[0], aperture[1]), slots, appliedFixes: [],
  };
}

const TL_V1 = sibling(
  { id: "topload-tl7-v1", programId: "P-TL", product: "TopLoad TL-7", family: "TopLoad", version: "v1", note: "Layout freeze candidate", createdAt: "2026-09-12", author: "Anika Rao", markets: ["US", "IN"], enclosure: [620, 950, 640] },
  [
    ["U1", "mcu-board", [200, 860, 420], { rail: "R1" }],
    ["U2", "touch-ui", [200, 870, 20], { rail: "R2" }],
    ["U3", "zigbee", [250, 180, 300], { rail: "R2" }],
    ["U4", "triac-drive", [30, 300, 400], { rail: "R1" }],
    ["U5", "cap-dropper", [420, 870, 440]],
    ["M1", "universal-motor", [240, 40, 240]],
    ["L1", "inlet-valve", [500, 860, 540]],
    ["P1", "drain-pump", [450, 30, 80]],
    ["X1", "mains-terminal", [60, 870, 560]],
  ],
  [
    { id: "C1", name: "Motor feed", from: "U4", to: "M1", kind: "motor-phase", noisy: true, construction: "flat" },
    { id: "C2", name: "Zigbee UART", from: "U1", to: "U3", kind: "comms", sensitive: true, construction: "flat" },
    { id: "C3", name: "UI ribbon", from: "U1", to: "U2", kind: "signal", construction: "flat" },
    { id: "C4", name: "Mains to drive", from: "X1", to: "U4", kind: "mains", construction: "flat" },
    { id: "C5", name: "Pump feed", from: "U1", to: "P1", kind: "actuator", construction: "flat" },
  ],
  { id: "H-1", name: "Rear loom", trunk: [[300, 860, 560], [60, 860, 560], [60, 120, 560], [300, 120, 400]], members: [{ cableId: "C1", from: 500, to: 1260, offset: 0 }, { cableId: "C2", from: 0, to: 1260, offset: 12 }] },
  [{ id: "G1", name: "Chassis strap", topology: "shared", members: ["U4", "U1"], points: [[55, 400, 530], [55, 880, 530], [290, 880, 530]], anchors: [[30, 300, 400], [200, 860, 420]], standoffMm: 40, protectiveEarth: true }],
  [0, "lid opening"],
  [{ id: "console-left", name: "Console, left of the display", pos: [80, 880, 60] }, { id: "console-right", name: "Console, right bay", pos: [520, 880, 200] }],
);

const DL_V1 = sibling(
  { id: "dryline-hp9-v1", programId: "P-DL", product: "DryLine HP-9", family: "DryLine", version: "v1", note: "Heat-pump base, first layout", createdAt: "2026-09-25", author: "Tomasz Brenner", markets: ["EU", "AU"], enclosure: [600, 850, 640] },
  [
    ["U1", "mcu-board", [200, 770, 380], { rail: "R1" }],
    ["U2", "tft-display", [240, 760, 8], { rail: "R2" }],
    ["U3", "wifi-ble", [150, 800, 30], { rail: "R2" }],
    ["U4", "inv-1200", [20, 30, 380], { rail: "R1", pfc: "passive" }],
    ["U5", "flyback-24", [420, 780, 420], { spreadSpectrum: false }],
    ["H1", "ptc-1000", [220, 220, 480], { switchPeriodS: 10 }],
    ["S1", "ntc-level", [470, 300, 500]],
    ["X1", "mains-filter", [500, 770, 560], { filterStages: 1 }],
  ],
  [
    { id: "C1", name: "Compressor phase", from: "U4", to: "H1", kind: "motor-phase", noisy: true, construction: "flat" },
    { id: "C2", name: "NTC sense", from: "U1", to: "S1", kind: "sensor", sensitive: true, construction: "unshielded-analog" },
    { id: "C3", name: "Display flex", from: "U1", to: "U2", kind: "signal", construction: "flat" },
    { id: "C4", name: "Wi-Fi UART", from: "U1", to: "U3", kind: "comms", sensitive: true, construction: "twisted" },
    { id: "C5", name: "Mains to drive", from: "X1", to: "U4", kind: "mains", construction: "flat" },
  ],
  { id: "H-1", name: "Base loom", trunk: [[290, 760, 560], [560, 760, 560], [560, 120, 560], [100, 120, 560]], members: [{ cableId: "C1", from: 700, to: 1370, offset: 0 }, { cableId: "C2", from: 0, to: 1000, offset: 10 }] },
  [{ id: "G1", name: "Compressor drive strap", topology: "shared", members: ["U4", "U1"], points: [[50, 120, 520], [50, 790, 520], [290, 790, 520]], anchors: [[20, 30, 380], [200, 770, 380]], standoffMm: 30, protectiveEarth: true }],
  [390, "door window"],
  [{ id: "console-right", name: "Console, right bay", pos: [500, 800, 60] }],
);

const CW_V2 = sibling(
  { id: "cleanwave-dw6-v2", programId: "P-CW", product: "CleanWave DW-6", family: "CleanWave", version: "v2", note: "After design review 2", createdAt: "2026-10-02", author: "Anika Rao", markets: ["EU", "CN"], enclosure: [600, 820, 570] },
  [
    ["U1", "mcu-board", [60, 40, 60], { rail: "R1", localFilter: true }],
    ["U2", "touch-ui", [190, 740, 6], { rail: "R2", esdProtection: true, freqHop: true }],
    ["U3", "wifi-ble", [470, 760, 20], { rail: "R2", shieldCan: true }],
    ["U5", "flyback-24", [300, 30, 420], { spreadSpectrum: true }],
    ["H1", "heater-2000", [200, 210, 200], { switchPeriodS: 45 }],
    ["P1", "drain-pump", [440, 30, 120]],
    ["L1", "inlet-valve", [60, 40, 460]],
    ["X1", "mains-filter", [480, 40, 480], { filterStages: 2 }],
  ],
  [
    { id: "C1", name: "UI ribbon", from: "U1", to: "U2", kind: "signal", construction: "flat" },
    { id: "C2", name: "Wi-Fi UART", from: "U1", to: "U3", kind: "comms", sensitive: true, construction: "twisted" },
    { id: "C3", name: "Heater feed", from: "U1", to: "H1", kind: "heater", construction: "flat" },
    { id: "C4", name: "Mains to SMPS", from: "X1", to: "U5", kind: "mains", construction: "flat" },
  ],
  undefined,
  [{ id: "G1", name: "Protective earth", topology: "star", members: ["X1"], points: [[520, 60, 520], [590, 60, 560]], anchors: [[480, 40, 480], [480, 40, 480]], standoffMm: 5, protectiveEarth: true }],
  [0, "none, steel door"],
  [{ id: "door-top", name: "Door top rail", pos: [300, 780, 20] }],
);

export const SEED_DESIGNS: Design[] = [AQ_V1, AQ_V11, AQ_V2, TL_V1, DL_V1, CW_V2];
export const DEFAULT_DESIGN_ID = AQ_V1.id;
