/** Domain model for Tarang: appliance EMI/EMC pre-compliance. Millimetres, dB, MHz. */

export type Vec3 = [number, number, number];

export type MarketId = "EU" | "US" | "CN" | "AU" | "IN";
export type ReqStatus = "mandatory" | "verify" | "voluntary";
export type Level = "High" | "Medium" | "Low";
export type RuleId =
  | "R1" | "R2" | "R3" | "R4" | "R5" | "R6" | "R7"
  | "R8" | "R9" | "R10" | "R11" | "R12" | "R13" | "R14";

export type Category =
  | "motor-drive" | "power-conversion" | "motor" | "controller" | "hmi" | "radio"
  | "sensor" | "actuator" | "heater" | "pump" | "mains-port";

export type FixType =
  | "Placement" | "Filtering" | "Grounding" | "Harness"
  | "Shielding" | "Firmware" | "Component" | "Thermal";

export interface Market {
  id: MarketId;
  label: string;
  scheme: string;
  mainsV: number;
}

export interface ComponentTemplate {
  id: string;
  category: Category;
  name: string;
  prefix: string;
  size: Vec3;
  /** Human label for the dominant switching or clock frequency. */
  freqLabel: string;
  switchKHz?: number;
  clockMHz?: number;
  powerW?: number;
  /** Heat shed to cabinet air, W. */
  dissipW?: number;
  /** R1 critical edge-to-edge distance to a sensitive victim, mm. */
  nearFieldMm?: number;
  /** R3 unfiltered level of the switching fundamental at the LISN, dBµV. */
  conductedE0?: number;
  /** Band in which the part is disturbed by in-band harmonics. */
  victimBand?: { lo: number; hi: number; unit: "kHz" | "MHz"; label: string };
  sensitivity?: "radio" | "analog" | "touch" | "logic";
  tempLimitC?: number;
  selfRiseC?: number;
  userAccessible?: boolean;
  /** R4 ripple injected on a shared rail, 0..1. */
  rippleClass?: number;
  /** R5 return-current noise on a shared ground, 0..1. */
  returnNoise?: number;
  /** R10 capacitor-input rectifier power, W. */
  rectifierW?: number;
  /** R9 cyclically switched resistive load, W. */
  heaterW?: number;
  mainsPort?: boolean;
  filterStages?: number;
  note: string;
}

export interface Part {
  id: string;
  ref: string;
  templateId: string;
  name: string;
  /** Minimum corner, mm, cabinet origin at front-bottom-left. */
  pos: Vec3;
  size: Vec3;
  rail?: string;
  shieldCan?: boolean;
  localFilter?: boolean;
  spreadSpectrum?: boolean;
  freqHop?: boolean;
  esdProtection?: boolean;
  pfc?: "none" | "passive" | "active";
  filterStages?: number;
  /** Extra X/Y capacitance on the mains filter, dB of added attenuation. */
  filterBoostDb?: number;
  switchPeriodS?: number;
  staged?: boolean;
  thermalBaffle?: boolean;
}

export type CableKind =
  | "mains" | "motor-phase" | "dc-rail" | "signal" | "sensor" | "comms" | "actuator" | "heater";

export interface Cable {
  id: string;
  name: string;
  from: string;
  to: string;
  kind: CableKind;
  noisy?: boolean;
  sensitive?: boolean;
  construction: "flat" | "twisted" | "unshielded-analog" | "shielded";
  ferrite?: boolean;
  /** Free routing waypoints when the cable is not carried by a harness. */
  via?: Vec3[];
}

export interface HarnessMember {
  cableId: string;
  /** Position along the trunk where the cable joins and leaves, mm. */
  from: number;
  to: number;
  /** Radial position inside the bundle, mm. */
  offset: number;
}

export interface Harness {
  id: string;
  name: string;
  trunk: Vec3[];
  members: HarnessMember[];
}

export interface GroundNet {
  id: string;
  name: string;
  topology: "shared" | "star";
  members: string[];
  /** Strap path. First and last points ride with the first and last member. */
  points: Vec3[];
  /** Positions of the first and last member when the path was drawn. */
  anchors: [Vec3, Vec3];
  /** Mean height of the strap above its chassis return, mm. */
  standoffMm: number;
  protectiveEarth: boolean;
}

export interface Zone {
  id: string;
  name: string;
  min: Vec3;
  max: Vec3;
  ventilated: boolean;
  ambientC: number;
}

export interface Panel {
  id: string;
  name: string;
  materialId: string;
  thicknessMm: number;
  earthBonded: boolean;
  seam: "welded" | "overlapped" | "butt";
  screwPitchMm: number;
  paintMasked: boolean;
  apertureMm: number;
  apertureLabel?: string;
  apertureScreened?: boolean;
  /** Outside the shielded wrap or facing the floor: not counted in the cabinet estimate. */
  outsideWrap?: boolean;
}

export interface Slot {
  id: string;
  name: string;
  pos: Vec3;
}

export interface Design {
  id: string;
  programId: string;
  product: string;
  family: string;
  version: string;
  note: string;
  parentId?: string;
  createdAt: string;
  author: string;
  markets: MarketId[];
  enclosure: Vec3;
  protectionClass: "I" | "II";
  parts: Part[];
  cables: Cable[];
  harnesses: Harness[];
  groundNets: GroundNet[];
  zones: Zone[];
  panels: Panel[];
  slots: Slot[];
  /** Fix ids already folded into this version, for the audit trail. */
  appliedFixes: string[];
}

export interface TestRequirement {
  id: string;
  name: string;
  short: string;
  group: "Emissions" | "Mains quality" | "Immunity" | "Radio" | "Safety";
  method: string;
  /** Per market: requirement status and the standard that carries it. */
  markets: Partial<Record<MarketId, { status: ReqStatus; standardId: string }>>;
  labCostUsd: number;
  labDays: number;
  facility: "SAC" | "Shielded room" | "Bench" | "Radio lab";
}

export interface LimitPoint {
  fMHz: number;
  qp: number;
}

export interface Standard {
  id: string;
  code: string;
  title: string;
  market: MarketId;
  edition: string;
  scope: string;
  testIds: string[];
  /** Quasi-peak conducted-emission limit at the mains port, dBµV. */
  limitLine?: LimitPoint[];
  watch?: string;
}

export interface Material {
  id: string;
  name: string;
  cls: string;
  shieldingDb: number;
  conductive: boolean;
  earthable: boolean;
  thermalK: number;
  emissivity: number;
  note: string;
}

export interface RuleDef {
  id: RuleId;
  name: string;
  mechanism: string;
  path: "Radiated" | "Crosstalk" | "Conducted" | "Common impedance" | "Thermal" | "Port";
  factor: string;
  modifiers: string[];
  inputs: string;
  assumption: string;
  implemented: "geometry" | "parametric";
}

export interface LabReport {
  id: string;
  date: string;
  product: string;
  family: string;
  lab: string;
  standard: string;
  test: string;
  testId: string;
  result: "pass" | "fail";
  marginDb: number;
  failFreq?: string;
  symptom: string;
  rootCause: string;
  fixApplied: string;
  fixType?: FixType;
  delayWeeks: number;
  costBand: "< $10k" | "$10–25k" | "$25–60k" | "> $60k";
  costUsd: number;
  tags: string[];
}

export interface HistoryMatch {
  reportId: string;
  jaccard: number;
  result: "pass" | "fail";
}

export interface Risk {
  /** Stable key: rule, aggressor and victim. Survives version changes. */
  key: string;
  num: number;
  rule: RuleId;
  mechanism: string;
  path: RuleDef["path"];
  aggressor: string;
  victim: string;
  aggressorCat: Category | "external" | "panel";
  victimCat: Category | "external" | "panel";
  coupling: string;
  factor: number;
  modifiers: { label: string; value: number }[];
  impact: number;
  impactBasis: string;
  historyAdj: number;
  score: number;
  level: Level;
  testIds: string[];
  standards: string[];
  tags: string[];
  matches: HistoryMatch[];
}

export interface CabinetShielding {
  effectiveDb: number;
  leakMHz: number;
  aboveLeakDb: number;
  limitingPanel: string;
  limitingAperture: string;
}

export interface Analysis {
  designId: string;
  risks: Risk[];
  index: number;
  counts: Record<Level, number>;
  shielding: CabinetShielding;
  rulesEvaluated: Record<RuleId, { pairs: number; raised: number }>;
}

/** Simulated regulatory change layered over the standards library. */
export interface StandardsOverride {
  /** Standard id → dB subtracted from every point of its limit line. */
  limitDeltaDb: Record<string, number>;
  /** `${testId}:${market}` → forced status. */
  status: Record<string, ReqStatus>;
  /** Standard id → edited limit line. */
  limitLines: Record<string, LimitPoint[]>;
}

export const EMPTY_OVERRIDE: StandardsOverride = { limitDeltaDb: {}, status: {}, limitLines: {} };
