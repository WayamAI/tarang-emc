/**
 * Lab history: thirty past reports across five product families.
 *
 * A failing report whose condition tags overlap a risk's tags raises that
 * risk (Jaccard ≥ 0.8 adds 10, ≥ 0.5 adds 6). A passing retest with the same
 * conditions marks the fix it records as proven.
 */

import type { FixType, LabReport } from "./types";

export const LABS = [
  "Kestrel EMC Laboratory, Tilburg",
  "Halden Test House, Chicago",
  "Meridian Compliance Lab, Suzhou",
  "Northfield pre-scan cell, Pune",
] as const;

type Row = [
  id: number, date: string, product: string, family: string, lab: number, standard: string, test: string, testId: string,
  result: "pass" | "fail", margin: number, failFreq: string, symptom: string, rootCause: string, fix: string,
  fixType: FixType | "", delayWeeks: number, costUsd: number, tags: string[],
];

const ROWS: Row[] = [
  [101, "2024-11-14", "AquaLine FL-6", "AquaLine", 0, "EN IEC 55014-1", "Conducted emissions", "CE", "pass", 3.1, "", "None", "Baseline filter adequate at 45 kHz switching", "None required", "", 0, 2400, ["conducted-emissions", "agg:power-conversion", "two-stage-filter", "spread-spectrum", "high-band"]],
  [102, "2024-12-03", "TopLoad TL-5", "TopLoad", 1, "FCC Part 15B", "Radiated emissions", "RE", "fail", -7.4, "68 MHz", "Broadband hump 40 to 120 MHz during agitation", "Brush arcing on the universal motor with no suppression capacitors", "Added 2 × 4.7 nF Y capacitors and a 10 µH choke at the brush gear", "Component", 5, 41000, ["radiated-emissions", "agg:motor", "brush-noise", "no-suppression-caps"]],
  [103, "2025-01-21", "TopLoad TL-5", "TopLoad", 1, "FCC Part 15B", "Radiated emissions", "RE", "pass", 4.2, "", "None", "Retest after brush suppression network", "Suppression network released to production", "Component", 0, 5200, ["radiated-emissions", "agg:motor", "brush-noise", "suppression-caps"]],
  [104, "2025-02-11", "AquaLine FL-6", "AquaLine", 0, "EN IEC 55014-1", "Conducted emissions", "CE", "fail", -5.2, "0.195 MHz", "Quasi-peak over the limit at the third switching harmonic", "65 kHz fixed-frequency flyback behind a single-stage inlet filter", "Second filter stage: added 1 mH differential choke and 0.33 µF X2", "Filtering", 4, 36000, ["conducted-emissions", "agg:power-conversion", "single-stage-filter", "fixed-frequency", "low-band"]],
  [105, "2025-02-27", "FreshCore FC-4", "FreshCore", 2, "GB/T 4343.2", "Surge immunity", "SURGE", "fail", -1, "", "Control board reset at 2 kV line to earth", "No varistor ahead of the capacitive dropper", "Added 14 mm MOV and a fusible resistor", "Component", 3, 22000, ["surge", "mains-port", "no-mov", "agg:external"]],
  [106, "2025-03-18", "FreshCore FC-4", "FreshCore", 2, "GB/T 4343.2", "Surge immunity", "SURGE", "pass", 1, "", "None", "Retest after varistor fitted", "MOV carried into the FC-5 platform", "Component", 0, 1500, ["surge", "mains-port", "mov", "agg:external"]],
  [107, "2025-04-02", "DryLine HP-7", "DryLine", 0, "EN IEC 61000-3-2", "Harmonic current", "HARM", "fail", -0.3, "250 Hz", "Fifth harmonic 0.3 A over Class A", "Passive choke saturating at 1.2 kW compressor load", "Changed to a 6 mH gapped choke", "Component", 6, 58000, ["harmonic-current", "agg:motor-drive", "pfc-passive", "class-a", "high-power"]],
  [108, "2025-04-24", "CleanWave DW-4", "CleanWave", 0, "EN 61000-3-3", "Flicker", "FLICK", "fail", -0.12, "", "dmax 4.6 % at heater turn-on", "Phase-controlled heater start with cold inrush", "Zero-cross switching and a 200 ms soft step", "Firmware", 2, 9000, ["flicker", "agg:heater", "phase-control", "dmax", "inrush"]],
  [109, "2025-05-13", "AquaLine FL-6", "AquaLine", 0, "EN IEC 55014-1", "Conducted emissions", "CE", "pass", 5.6, "", "None", "Retest with the two-stage inlet filter", "Two-stage filter released; 6 dB margin at 195 kHz", "Filtering", 0, 2400, ["conducted-emissions", "agg:power-conversion", "single-stage-filter", "fixed-frequency", "low-band"]],
  [110, "2025-05-29", "CleanWave DW-4", "CleanWave", 0, "EN 61000-3-3", "Flicker", "FLICK", "pass", 0.31, "", "None", "Retest after zero-cross firmware", "Firmware 2.4 released", "Firmware", 0, 1400, ["flicker", "agg:heater", "zero-cross", "dmax", "inrush"]],
  [111, "2025-06-17", "DryLine HP-7", "DryLine", 0, "EN IEC 61000-3-2", "Harmonic current", "HARM", "pass", 0.4, "", "None", "Retest with gapped choke", "Choke change released", "Component", 0, 1400, ["harmonic-current", "agg:motor-drive", "pfc-passive", "class-a", "high-power"]],
  [112, "2025-07-08", "AquaLine FL-7", "AquaLine", 0, "EN 301 489-17", "Radio EMC", "RADIO-EMC", "fail", -9, "2437 MHz", "Wi-Fi packet error rate above 10 % during spin", "Radio module 20 mm from the inverter drive, no shield can", "Moved the module to the console behind the fascia", "Placement", 7, 72000, ["radiated-proximity", "agg:motor-drive", "vic:radio", "no-shield-can", "tight-spacing"]],
  [113, "2025-07-24", "CleanWave DW-5", "CleanWave", 0, "EN IEC 55014-2", "ESD immunity", "ESD", "fail", -2, "", "Display froze after 8 kV air discharge at the metal trim", "Trim ring floating, discharge path through the display flex", "Bonded the trim ring and added a TVS array at the connector", "Component", 3, 19000, ["esd-exposure", "vic:display", "metal-trim", "air-discharge"]],
  [114, "2025-08-12", "FreshCore FC-5", "FreshCore", 2, "GB 4343.1", "Conducted emissions", "CE", "fail", -3.8, "0.168 MHz", "Quasi-peak over the limit at the 21st PWM harmonic", "8 kHz compressor inverter with a single-stage filter", "Added a second common-mode choke", "Filtering", 4, 31000, ["conducted-emissions", "agg:motor-drive", "single-stage-filter", "fixed-frequency", "low-band"]],
  [115, "2025-08-28", "CleanWave DW-5", "CleanWave", 0, "EN IEC 55014-2", "ESD immunity", "ESD", "pass", 2, "", "None", "Retest with TVS array and guard ring on the touch panel", "TVS array and guard ring released", "Component", 0, 1600, ["esd-exposure", "vic:hmi", "user-accessible", "no-tvs"]],
  [116, "2025-09-16", "FreshCore FC-5", "FreshCore", 2, "GB 4343.1", "Conducted emissions", "CE", "pass", 4.4, "", "None", "Retest with the second choke", "Second choke released", "Filtering", 0, 2400, ["conducted-emissions", "agg:motor-drive", "two-stage-filter", "fixed-frequency", "low-band"]],
  [117, "2025-10-07", "AquaLine FL-7", "AquaLine", 0, "EN 301 489-17", "Radio EMC", "RADIO-EMC", "pass", 6, "", "None", "Retest with the module relocated to the console", "Console position released", "Placement", 0, 6800, ["radiated-proximity", "agg:motor-drive", "vic:radio", "no-shield-can", "tight-spacing"]],
  [118, "2025-10-23", "AquaLine FL-7", "AquaLine", 1, "FCC Part 15C", "Radio spectrum", "RADIO-RF", "fail", -1.6, "2483.5 MHz", "Band-edge emission over the restricted-band limit", "Power table not backed off on channel 11", "Regional power table corrected", "Firmware", 2, 12000, ["radio-spurious", "vic:radio", "band-edge", "power-table"]],
  [119, "2025-11-11", "DryLine HP-8", "DryLine", 0, "EN IEC 55014-1", "Radiated emissions", "RE", "fail", -6.1, "96 MHz", "Narrowband peaks at clock harmonics", "780 mm display cable resonant at the second clock harmonic", "Ferrite clamp at the board end and a shorter lead", "Filtering", 4, 33000, ["cable-resonance", "agg:controller", "signal", "no-ferrite"]],
  [120, "2025-12-02", "DryLine HP-8", "DryLine", 0, "EN IEC 55014-1", "Radiated emissions", "RE", "pass", 3.3, "", "None", "Retest with ferrite clamp", "Ferrite clamp released", "Filtering", 0, 5200, ["cable-resonance", "agg:controller", "signal", "no-ferrite"]],
  [121, "2026-01-20", "AquaLine FL-7", "AquaLine", 0, "EN IEC 55014-2", "EFT immunity", "EFT", "fail", -1, "", "Touch panel locked up at 1 kV burst on mains", "Drive and touch board returned through one long chassis strap", "Star ground at the inlet stud with separate short straps", "Grounding", 5, 44000, ["common-ground", "agg:motor-drive", "vic:hmi", "shared-strap", "large-loop"]],
  [122, "2026-02-05", "TopLoad TL-6", "TopLoad", 1, "FCC Part 15B", "Conducted emissions", "CE", "pass", 7.9, "", "None", "Triac drive with standard inlet filter", "None required", "", 0, 2400, ["conducted-emissions", "agg:motor-drive", "single-stage-filter", "phase-control", "high-band"]],
  [123, "2026-02-24", "TopLoad TL-6", "TopLoad", 3, "IS 6873 (Part 2/Sec 1)", "Clicks", "CLICK", "fail", -4, "0.5 MHz", "Click rate above the permitted count on the inlet valve relay", "No snubber across the valve relay contacts", "RC snubber 100 Ω + 100 nF", "Component", 2, 8000, ["clicks", "agg:actuator", "relay-switching", "no-snubber"]],
  [124, "2026-03-12", "AquaLine FL-7", "AquaLine", 0, "EN IEC 55014-2", "EFT immunity", "EFT", "pass", 1, "", "None", "Retest with star ground", "Star ground released", "Grounding", 0, 1500, ["common-ground", "agg:motor-drive", "vic:hmi", "shared-strap", "large-loop"]],
  [125, "2026-04-09", "CleanWave DW-5", "CleanWave", 0, "EN IEC 55014-2", "Conducted RF immunity", "CRF", "fail", -2, "27 MHz", "Water temperature reading drifted 6 °C", "Unshielded NTC lead acting as an antenna into a high-impedance input", "Added 100 nF at the connector and a twisted lead", "Harness", 3, 17000, ["conducted-immunity", "vic:sensor", "long-lead", "no-input-filter"]],
  [126, "2026-05-05", "AquaLine FL-7", "AquaLine", 3, "Pre-scan", "Near-field probe scan", "CRF", "pass", 0, "", "None", "Sensor lead pulled out of the motor loom into its own run", "Separate sensor run released", "Harness", 0, 900, ["harness-crosstalk", "agg:motor-drive", "vic:sensor", "shared-loom", "unshielded-analog"]],
  [127, "2026-06-16", "FreshCore FC-5", "FreshCore", 2, "GB/T 4343.2", "Radiated RF immunity", "RRF", "fail", -1, "433 MHz", "Display flicker at 3 V/m", "Unshielded display flex", "Shielded flex with a grounded tail", "Shielding", 4, 27000, ["radiated-immunity", "vic:display", "unshielded-flex", "agg:external"]],
  [128, "2026-07-14", "DryLine HP-8", "DryLine", 0, "EN 300 328", "Radio spectrum", "RADIO-RF", "pass", 3.5, "", "None", "First-pass radio spectrum", "None required", "", 0, 7400, ["radio-spurious", "vic:radio", "in-band", "power-table"]],
  [129, "2026-08-18", "CleanWave DW-5", "CleanWave", 2, "GB 17625.1", "Harmonic current", "HARM", "pass", 0.9, "", "None", "Heater-dominated load", "None required", "", 0, 1400, ["harmonic-current", "agg:heater", "resistive-load"]],
  [130, "2026-09-22", "TopLoad TL-6", "TopLoad", 3, "IS 6873 (Part 2/Sec 1)", "Clicks", "CLICK", "pass", 2, "", "None", "Retest with relay snubber", "Snubber released", "Component", 0, 1900, ["clicks", "agg:actuator", "relay-switching", "no-snubber"]],
];

function band(cost: number): LabReport["costBand"] {
  if (cost < 10000) return "< $10k";
  if (cost < 25000) return "$10–25k";
  if (cost < 60000) return "$25–60k";
  return "> $60k";
}

export const LAB_REPORTS: LabReport[] = ROWS.map((r) => ({
  id: `TR-${r[0]}`,
  date: r[1],
  product: r[2],
  family: r[3],
  lab: LABS[r[4]],
  standard: r[5],
  test: r[6],
  testId: r[7],
  result: r[8],
  marginDb: r[9],
  failFreq: r[10] || undefined,
  symptom: r[11],
  rootCause: r[12],
  fixApplied: r[13],
  fixType: r[14] || undefined,
  delayWeeks: r[15],
  costBand: band(r[16]),
  costUsd: r[16],
  tags: r[17],
}));

/** Passing retests and the catalogue fix each one proved. */
export const PROVEN_FIX: Record<string, string> = {
  "TR-109": "filter-2stage",
  "TR-116": "filter-2stage",
  "TR-117": "move-victim",
  "TR-120": "ferrite",
  "TR-124": "star-ground",
  "TR-126": "reroute-victim",
  "TR-115": "tvs",
};

export const REPORT_BY_ID =Object.fromEntries(LAB_REPORTS.map((r) => [r.id, r])) as Record<string, LabReport>;
