/** Reference libraries: markets, test requirements, standards, materials, component templates, rules. */

import type {
  Category,
  ComponentTemplate,
  LimitPoint,
  Market,
  MarketId,
  Material,
  RuleDef,
  Standard,
  TestRequirement,
} from "./types";

export const MARKETS: Market[] = [
  { id: "EU", label: "European Union", scheme: "CE (EMCD 2014/30/EU, RED 2014/53/EU)", mainsV: 230 },
  { id: "US", label: "United States", scheme: "FCC (47 CFR Part 15)", mainsV: 120 },
  { id: "CN", label: "China", scheme: "CCC / SRRC", mainsV: 220 },
  { id: "AU", label: "Australia / New Zealand", scheme: "RCM (ACMA)", mainsV: 230 },
  { id: "IN", label: "India", scheme: "BIS / WPC ETA", mainsV: 230 },
];

export const MARKET_BY_ID = Object.fromEntries(MARKETS.map((m) => [m.id, m])) as Record<MarketId, Market>;

/** CISPR 14-1 household appliance mains-port quasi-peak limit, 150 kHz to 30 MHz. */
const CISPR14_QP: LimitPoint[] = [
  { fMHz: 0.15, qp: 66 },
  { fMHz: 0.5, qp: 56 },
  { fMHz: 5, qp: 56 },
  { fMHz: 5.0001, qp: 60 },
  { fMHz: 30, qp: 60 },
];

export const TESTS: TestRequirement[] = [
  {
    id: "CE", name: "Conducted emissions, mains port", short: "Conducted emissions", group: "Emissions",
    method: "LISN 50 Ω/50 µH, 150 kHz to 30 MHz, quasi-peak and average",
    markets: {
      EU: { status: "mandatory", standardId: "en55014-1" }, US: { status: "mandatory", standardId: "fcc15b" },
      CN: { status: "mandatory", standardId: "gb4343-1" }, AU: { status: "mandatory", standardId: "as-cispr14-1" },
      IN: { status: "verify", standardId: "is6873" },
    },
    labCostUsd: 2400, labDays: 1, facility: "Shielded room",
  },
  {
    id: "RE", name: "Radiated emissions, 30 MHz to 1 GHz", short: "Radiated emissions", group: "Emissions",
    method: "Semi-anechoic chamber at 3 m or 10 m, quasi-peak",
    markets: {
      EU: { status: "mandatory", standardId: "en55014-1" }, US: { status: "mandatory", standardId: "fcc15b" },
      CN: { status: "mandatory", standardId: "gb4343-1" }, AU: { status: "mandatory", standardId: "as-cispr14-1" },
      IN: { status: "verify", standardId: "is6873" },
    },
    labCostUsd: 5200, labDays: 1.5, facility: "SAC",
  },
  {
    id: "CLICK", name: "Discontinuous disturbance (clicks)", short: "Clicks", group: "Emissions",
    method: "Click analyser at 150 kHz, 500 kHz, 1.4 MHz and 30 MHz over a full programme",
    markets: {
      EU: { status: "mandatory", standardId: "en55014-1" }, CN: { status: "mandatory", standardId: "gb4343-1" },
      AU: { status: "mandatory", standardId: "as-cispr14-1" }, IN: { status: "voluntary", standardId: "is6873" },
    },
    labCostUsd: 1900, labDays: 1, facility: "Shielded room",
  },
  {
    id: "HARM", name: "Harmonic current emissions", short: "Harmonic current", group: "Mains quality",
    method: "Class A limits, harmonics 2 to 40 on a reference source",
    markets: {
      EU: { status: "mandatory", standardId: "en61000-3-2" }, CN: { status: "mandatory", standardId: "gb17625-1" },
      AU: { status: "verify", standardId: "as61000-3-2" },
    },
    labCostUsd: 1400, labDays: 0.5, facility: "Bench",
  },
  {
    id: "FLICK", name: "Voltage changes and flicker", short: "Flicker", group: "Mains quality",
    method: "Pst and dmax against reference impedance 0.4 + j0.25 Ω",
    markets: {
      EU: { status: "mandatory", standardId: "en61000-3-3" }, CN: { status: "voluntary", standardId: "gb17625-1" },
      AU: { status: "verify", standardId: "as61000-3-2" },
    },
    labCostUsd: 1400, labDays: 0.5, facility: "Bench",
  },
  {
    id: "ESD", name: "Electrostatic discharge immunity", short: "ESD immunity", group: "Immunity",
    method: "IEC 61000-4-2, 4 kV contact, 8 kV air, criterion B",
    markets: {
      EU: { status: "mandatory", standardId: "en55014-2" }, CN: { status: "voluntary", standardId: "gbt4343-2" },
      AU: { status: "voluntary", standardId: "as-cispr14-1" },
    },
    labCostUsd: 1600, labDays: 0.5, facility: "Bench",
  },
  {
    id: "EFT", name: "Electrical fast transient / burst immunity", short: "EFT immunity", group: "Immunity",
    method: "IEC 61000-4-4, 1 kV on mains, 5/50 ns, 5 kHz repetition",
    markets: {
      EU: { status: "mandatory", standardId: "en55014-2" }, CN: { status: "voluntary", standardId: "gbt4343-2" },
    },
    labCostUsd: 1500, labDays: 0.5, facility: "Bench",
  },
  {
    id: "SURGE", name: "Surge immunity", short: "Surge immunity", group: "Immunity",
    method: "IEC 61000-4-5, 1 kV line to line, 2 kV line to earth",
    markets: {
      EU: { status: "mandatory", standardId: "en55014-2" }, CN: { status: "voluntary", standardId: "gbt4343-2" },
      IN: { status: "voluntary", standardId: "is6873" },
    },
    labCostUsd: 1500, labDays: 0.5, facility: "Bench",
  },
  {
    id: "CRF", name: "Conducted RF immunity", short: "Conducted RF immunity", group: "Immunity",
    method: "IEC 61000-4-6, 3 V rms, 150 kHz to 230 MHz, 80 % AM",
    markets: {
      EU: { status: "mandatory", standardId: "en55014-2" }, CN: { status: "voluntary", standardId: "gbt4343-2" },
    },
    labCostUsd: 2100, labDays: 1, facility: "Shielded room",
  },
  {
    id: "RRF", name: "Radiated RF immunity", short: "Radiated RF immunity", group: "Immunity",
    method: "IEC 61000-4-3, 3 V/m, 80 MHz to 1 GHz",
    markets: {
      EU: { status: "mandatory", standardId: "en55014-2" }, CN: { status: "voluntary", standardId: "gbt4343-2" },
    },
    labCostUsd: 4800, labDays: 1, facility: "SAC",
  },
  {
    id: "RADIO-EMC", name: "Radio equipment EMC", short: "Radio EMC", group: "Radio",
    method: "Emissions and immunity with the 2.4 GHz link active, packet error criterion",
    markets: {
      EU: { status: "mandatory", standardId: "en301489-17" }, AU: { status: "verify", standardId: "as4268" },
    },
    labCostUsd: 6800, labDays: 2, facility: "Radio lab",
  },
  {
    id: "RADIO-RF", name: "2.4 GHz wideband transmission", short: "Radio spectrum", group: "Radio",
    method: "Output power, spectral density, occupied bandwidth, spurious, adaptivity",
    markets: {
      EU: { status: "mandatory", standardId: "en300328" }, US: { status: "mandatory", standardId: "fcc15c" },
      CN: { status: "mandatory", standardId: "srrc" }, AU: { status: "mandatory", standardId: "as4268" },
      IN: { status: "mandatory", standardId: "wpc-eta" },
    },
    labCostUsd: 7400, labDays: 2, facility: "Radio lab",
  },
  {
    id: "EMF", name: "Human exposure to EM fields", short: "EMF exposure", group: "Safety",
    method: "Field probe survey around the appliance, 10 Hz to 400 kHz",
    markets: {
      EU: { status: "mandatory", standardId: "en62233" }, AU: { status: "voluntary", standardId: "as-cispr14-1" },
    },
    labCostUsd: 1800, labDays: 0.5, facility: "Bench",
  },
  {
    id: "EARTH", name: "Protective earth continuity", short: "Earth continuity", group: "Safety",
    method: "25 A for 60 s, resistance below 0.1 Ω between earth pin and accessible metal",
    markets: {
      EU: { status: "mandatory", standardId: "en60335-1" }, US: { status: "mandatory", standardId: "ul60335-1" },
    },
    labCostUsd: 600, labDays: 0.25, facility: "Bench",
  },
];

export const TEST_BY_ID = Object.fromEntries(TESTS.map((t) => [t.id, t])) as Record<string, TestRequirement>;

export const STANDARDS: Standard[] = [
  { id: "en55014-1", code: "EN IEC 55014-1", title: "Household appliances, electric tools: emission", market: "EU", edition: "2021", scope: "Conducted, radiated and discontinuous emissions for appliances.", testIds: ["CE", "RE", "CLICK"], limitLine: CISPR14_QP, watch: "CISPR 14-1 Ed. 7 amendment under vote: radiated limits extended to 6 GHz for products with radios." },
  { id: "en55014-2", code: "EN IEC 55014-2", title: "Household appliances: immunity", market: "EU", edition: "2021", scope: "ESD, EFT, surge, conducted and radiated RF immunity, category II and IV equipment.", testIds: ["ESD", "EFT", "SURGE", "CRF", "RRF"] },
  { id: "en61000-3-2", code: "EN IEC 61000-3-2", title: "Limits for harmonic current emissions (≤ 16 A per phase)", market: "EU", edition: "2019 + A1:2021", scope: "Class A limits for household appliances.", testIds: ["HARM"] },
  { id: "en61000-3-3", code: "EN 61000-3-3", title: "Voltage changes, fluctuations and flicker", market: "EU", edition: "2013 + A2:2021", scope: "Pst ≤ 1.0, Plt ≤ 0.65, dmax limits.", testIds: ["FLICK"] },
  { id: "en301489-17", code: "EN 301 489-17", title: "EMC for broadband data transmission systems", market: "EU", edition: "V3.2.4", scope: "Specific conditions for 2.4 GHz and 5 GHz equipment.", testIds: ["RADIO-EMC"] },
  { id: "en300328", code: "EN 300 328", title: "Wideband transmission systems in the 2.4 GHz band", market: "EU", edition: "V2.2.2", scope: "RF output power, spurious emissions, adaptivity, receiver blocking.", testIds: ["RADIO-RF"], watch: "Receiver blocking levels tightened in V2.2.2; category 2 receivers need a retest when the host layout changes." },
  { id: "en62233", code: "EN 62233", title: "Measurement of EM fields of household appliances", market: "EU", edition: "2008", scope: "Human exposure assessment.", testIds: ["EMF"] },
  { id: "en60335-1", code: "EN 60335-1", title: "Household appliances: safety, general requirements", market: "EU", edition: "2012 + A15:2021", scope: "Clause 27 provision for earthing: bond resistance below 0.1 Ω.", testIds: ["EARTH"] },
  { id: "fcc15b", code: "FCC Part 15B", title: "Unintentional radiators", market: "US", edition: "47 CFR 15.107 / 15.109", scope: "Class B conducted and radiated limits.", testIds: ["CE", "RE"], limitLine: CISPR14_QP },
  { id: "fcc15c", code: "FCC Part 15C", title: "Intentional radiators (§15.247)", market: "US", edition: "47 CFR 15.247", scope: "Digital transmission systems at 2400 to 2483.5 MHz.", testIds: ["RADIO-RF"] },
  { id: "ul60335-1", code: "UL 60335-1", title: "Household appliances: safety, general requirements", market: "US", edition: "6th edition", scope: "Earthing provisions and bond resistance for NRTL listing.", testIds: ["EARTH"] },
  { id: "gb4343-1", code: "GB 4343.1", title: "Household appliances: emission", market: "CN", edition: "2018", scope: "CCC emission requirements, aligned with CISPR 14-1.", testIds: ["CE", "RE", "CLICK"], limitLine: CISPR14_QP, watch: "2024 edition replaces the 2018 text for CCC certificates renewed after August 2026." },
  { id: "gbt4343-2", code: "GB/T 4343.2", title: "Household appliances: immunity", market: "CN", edition: "2020", scope: "Recommended immunity requirements.", testIds: ["ESD", "EFT", "SURGE", "CRF", "RRF"] },
  { id: "gb17625-1", code: "GB 17625.1", title: "Limits for harmonic current emissions", market: "CN", edition: "2022", scope: "Class A limits, aligned with IEC 61000-3-2.", testIds: ["HARM", "FLICK"] },
  { id: "srrc", code: "SRRC type approval", title: "Radio transmission equipment type approval", market: "CN", edition: "MIIT notice 2021 No. 129", scope: "2.4 GHz equipment RF parameters.", testIds: ["RADIO-RF"] },
  { id: "as-cispr14-1", code: "AS/NZS CISPR 14.1", title: "Household appliances: emission", market: "AU", edition: "2021", scope: "RCM emission requirements.", testIds: ["CE", "RE", "CLICK", "ESD", "EMF"], limitLine: CISPR14_QP },
  { id: "as4268", code: "AS/NZS 4268", title: "Radio equipment: short range devices", market: "AU", edition: "2017 + A1", scope: "2.4 GHz short range device limits.", testIds: ["RADIO-RF", "RADIO-EMC"] },
  { id: "as61000-3-2", code: "AS/NZS 61000.3.2", title: "Limits for harmonic current emissions", market: "AU", edition: "2013", scope: "Harmonics and flicker for RCM supplier declaration.", testIds: ["HARM", "FLICK"] },
  { id: "is6873", code: "IS 6873 (Part 2/Sec 1)", title: "Household appliances: emission", market: "IN", edition: "2019", scope: "BIS emission requirements, aligned with CISPR 14-1.", testIds: ["CE", "RE", "CLICK", "SURGE"], limitLine: CISPR14_QP, watch: "BIS quality control order for washing appliances extends compulsory registration from April 2027." },
  { id: "wpc-eta", code: "WPC ETA", title: "Equipment type approval for licence-exempt radios", market: "IN", edition: "GSR 45(E)", scope: "2.4 GHz licence-exempt band approval.", testIds: ["RADIO-RF"] },
];

export const STANDARD_BY_ID = Object.fromEntries(STANDARDS.map((s) => [s.id, s])) as Record<string, Standard>;

export const MATERIALS: Material[] = [
  { id: "steel-crs", name: "Cold-rolled steel", cls: "Ferrous sheet", shieldingDb: 40, conductive: true, earthable: true, thermalK: 50, emissivity: 0.6, note: "Default cabinet wrap. Good magnetic shielding below 1 MHz." },
  { id: "steel-galv", name: "Galvanised steel", cls: "Ferrous sheet", shieldingDb: 42, conductive: true, earthable: true, thermalK: 48, emissivity: 0.28, note: "Zinc keeps seams conductive without masking." },
  { id: "steel-ss", name: "Stainless steel 430", cls: "Ferrous sheet", shieldingDb: 36, conductive: true, earthable: true, thermalK: 26, emissivity: 0.35, note: "Drum and tub. Higher contact resistance at seams." },
  { id: "alu", name: "Aluminium 5052", cls: "Non-ferrous sheet", shieldingDb: 38, conductive: true, earthable: true, thermalK: 138, emissivity: 0.09, note: "Heat spreaders and shield cans. Weak against low-frequency magnetic fields." },
  { id: "pp-gf", name: "Glass-filled polypropylene", cls: "Structural plastic", shieldingDb: 0, conductive: false, earthable: false, thermalK: 0.35, emissivity: 0.92, note: "Tubs and bases. Transparent to RF." },
  { id: "abs", name: "ABS fascia", cls: "Cosmetic plastic", shieldingDb: 0, conductive: false, earthable: false, thermalK: 0.2, emissivity: 0.93, note: "Console fascia. Antennas belong behind it." },
  { id: "abs-cond", name: "Conductive-coated ABS", cls: "Coated plastic", shieldingDb: 28, conductive: true, earthable: true, thermalK: 0.2, emissivity: 0.6, note: "Copper-nickel spray, needs a gasketed earth point." },
  { id: "glass", name: "Tempered glass", cls: "Glazing", shieldingDb: 0, conductive: false, earthable: false, thermalK: 1.0, emissivity: 0.94, note: "Door window. The dominant aperture on a front-loader." },
  { id: "glass-mesh", name: "Glass with conductive mesh", cls: "Glazing", shieldingDb: 22, conductive: true, earthable: true, thermalK: 1.0, emissivity: 0.9, note: "Screened window; mesh must bond to the door ring." },
  { id: "epdm", name: "EPDM gasket", cls: "Elastomer", shieldingDb: 0, conductive: false, earthable: false, thermalK: 0.25, emissivity: 0.9, note: "Door bellows. Breaks panel-to-panel contact." },
];

export const MATERIAL_BY_ID = Object.fromEntries(MATERIALS.map((m) => [m.id, m])) as Record<string, Material>;

export const CATEGORY_LABEL: Record<Category, string> = {
  "motor-drive": "Motor drive",
  "power-conversion": "Power conversion",
  motor: "Motor",
  controller: "Controller",
  hmi: "HMI / touch",
  radio: "Radio",
  sensor: "Sensor input",
  actuator: "Actuator",
  heater: "Heater",
  pump: "Pump",
  "mains-port": "Mains port",
};

export const CATEGORY_ORDER: Category[] = [
  "motor-drive", "power-conversion", "motor", "controller", "hmi", "radio",
  "sensor", "actuator", "heater", "pump", "mains-port",
];

/** Colour token per category for the 3D view, drafting views and legends. */
export const CATEGORY_TOKEN: Record<Category, string> = {
  "motor-drive": "--feedback-error-icon",
  "power-conversion": "--feedback-warning-icon",
  motor: "--feedback-neutral-icon",
  controller: "--feedback-info-icon",
  hmi: "--feedback-success-icon",
  radio: "--brand-accent",
  sensor: "--feedback-success-icon",
  actuator: "--feedback-neutral-icon",
  heater: "--feedback-error-icon",
  pump: "--feedback-info-icon",
  "mains-port": "--text-primary",
};

export const TEMPLATES: ComponentTemplate[] = [
  { id: "inv-550", category: "motor-drive", name: "Inverter motor drive 550 W", prefix: "U", size: [50, 160, 130], freqLabel: "16 kHz PWM", switchKHz: 16, powerW: 550, dissipW: 28, nearFieldMm: 90, conductedE0: 98, rippleClass: 0.6, returnNoise: 1, rectifierW: 550, note: "Three-phase IPM, capacitor-input rectifier, no PFC by default." },
  { id: "inv-1200", category: "motor-drive", name: "Compressor inverter 1.2 kW", prefix: "U", size: [60, 180, 150], freqLabel: "8 kHz PWM", switchKHz: 8, powerW: 1200, dissipW: 48, nearFieldMm: 120, conductedE0: 102, rippleClass: 0.7, returnNoise: 1, rectifierW: 1200, note: "Heat-pump and refrigeration compressors." },
  { id: "triac-drive", category: "motor-drive", name: "Triac universal-motor drive", prefix: "U", size: [45, 110, 90], freqLabel: "100 Hz phase control", switchKHz: 0.1, powerW: 450, dissipW: 9, nearFieldMm: 50, rippleClass: 0.4, returnNoise: 0.7, note: "Phase-angle control; brush noise dominates above 1 MHz." },
  { id: "flyback-24", category: "power-conversion", name: "Flyback SMPS 24 W", prefix: "U", size: [90, 35, 70], freqLabel: "65 kHz fixed", switchKHz: 65, powerW: 24, dissipW: 4, nearFieldMm: 60, conductedE0: 109.34, tempLimitC: 65, selfRiseC: 15, note: "Fixed-frequency controller; electrolytics derated to 65 °C." },
  { id: "buck-5v", category: "power-conversion", name: "Buck converter 5 V", prefix: "U", size: [40, 12, 30], freqLabel: "400 kHz", switchKHz: 400, powerW: 6, dissipW: 1, nearFieldMm: 25, note: "Point-of-load regulator on the control board." },
  { id: "cap-dropper", category: "power-conversion", name: "Capacitive dropper supply", prefix: "U", size: [50, 20, 35], freqLabel: "50 Hz", powerW: 1, dissipW: 1, note: "Non-isolated standby supply; no switching noise." },
  { id: "bldc", category: "motor", name: "BLDC drum motor", prefix: "M", size: [140, 140, 150], freqLabel: "16 kHz phase ripple", powerW: 550, dissipW: 40, note: "Fed by the inverter over a three-phase cable." },
  { id: "universal-motor", category: "motor", name: "Universal brushed motor", prefix: "M", size: [120, 120, 160], freqLabel: "Broadband brush noise", powerW: 450, dissipW: 25, nearFieldMm: 70, note: "Commutator arcing radiates from 30 MHz to 300 MHz." },
  { id: "mcu-board", category: "controller", name: "Main control board", prefix: "U", size: [180, 25, 120], freqLabel: "48 MHz MCU clock", clockMHz: 48, powerW: 4, dissipW: 2, nearFieldMm: 25, sensitivity: "logic", tempLimitC: 70, selfRiseC: 8, note: "Relays, MCU, communication transceivers." },
  { id: "touch-ui", category: "hmi", name: "Capacitive touch UI board", prefix: "U", size: [220, 60, 15], freqLabel: "248 kHz sense", sensitivity: "touch", victimBand: { lo: 238, hi: 258, unit: "kHz", label: "touch sense band" }, userAccessible: true, tempLimitC: 70, selfRiseC: 4, note: "Self-capacitance sensing behind a 3 mm fascia." },
  { id: "tft-display", category: "hmi", name: "TFT display module", prefix: "U", size: [120, 80, 12], freqLabel: "33 MHz pixel clock", clockMHz: 33, sensitivity: "logic", userAccessible: true, nearFieldMm: 30, tempLimitC: 70, selfRiseC: 6, note: "RGB interface; flex cable radiates if unshielded." },
  { id: "wifi-ble", category: "radio", name: "Wi-Fi / BLE module", prefix: "U", size: [30, 8, 40], freqLabel: "2.4 GHz", sensitivity: "radio", victimBand: { lo: 2400, hi: 2483.5, unit: "MHz", label: "2.4 GHz ISM band" }, tempLimitC: 85, selfRiseC: 5, note: "PCB antenna; receiver sensitivity near −96 dBm." },
  { id: "zigbee", category: "radio", name: "Thread / Zigbee module", prefix: "U", size: [25, 6, 30], freqLabel: "2.4 GHz", sensitivity: "radio", victimBand: { lo: 2405, hi: 2480, unit: "MHz", label: "IEEE 802.15.4 channels" }, tempLimitC: 85, selfRiseC: 3, note: "Low-rate mesh radio." },
  { id: "ntc-level", category: "sensor", name: "NTC + water-level sensors", prefix: "S", size: [40, 40, 30], freqLabel: "DC to 1 kHz", sensitivity: "analog", note: "High-impedance analogue inputs on a long lead." },
  { id: "hall-tacho", category: "sensor", name: "Hall tacho sensor", prefix: "S", size: [20, 15, 20], freqLabel: "0 to 2 kHz pulses", sensitivity: "analog", note: "Open-collector speed feedback." },
  { id: "door-lock", category: "actuator", name: "Door lock", prefix: "L", size: [40, 90, 30], freqLabel: "Mains switched", powerW: 6, note: "PTC and solenoid interlock." },
  { id: "inlet-valve", category: "actuator", name: "Inlet valve solenoids", prefix: "L", size: [70, 50, 50], freqLabel: "Mains switched", powerW: 8, note: "Inductive kick on release; a click source." },
  { id: "heater-2000", category: "heater", name: "Heater 2000 W", prefix: "H", size: [220, 30, 60], freqLabel: "Relay, 20 s cycle", powerW: 2000, heaterW: 2000, note: "Immersed wash heater on a relay." },
  { id: "ptc-1000", category: "heater", name: "PTC drying heater 1000 W", prefix: "H", size: [160, 40, 80], freqLabel: "Triac burst, 10 s cycle", powerW: 1000, heaterW: 1000, dissipW: 30, note: "Air heater for wash-dry programmes." },
  { id: "drain-pump", category: "pump", name: "Drain pump", prefix: "P", size: [90, 80, 90], freqLabel: "50 Hz synchronous", powerW: 30, dissipW: 10, note: "Shaded-pole or synchronous pump." },
  { id: "mains-filter", category: "mains-port", name: "Mains inlet with EMI filter", prefix: "X", size: [80, 50, 60], freqLabel: "150 kHz corner", mainsPort: true, filterStages: 1, note: "Single-stage LC: 0.47 µF X2, 2 × 2.2 nF Y2, 2 × 3.3 mH common-mode choke." },
  { id: "mains-terminal", category: "mains-port", name: "Mains terminal block", prefix: "X", size: [60, 30, 40], freqLabel: "Unfiltered", mainsPort: true, filterStages: 0, note: "No filter; relies on board-level suppression." },
];

export const TEMPLATE_BY_ID = Object.fromEntries(TEMPLATES.map((t) => [t.id, t])) as Record<string, ComponentTemplate>;

export const RULES: RuleDef[] = [
  { id: "R1", name: "Radiated proximity", mechanism: "Radiated proximity", path: "Radiated", factor: "1 − d / d_crit, where d is the 3D edge-to-edge gap between aggressor and victim boxes", modifiers: ["Victim without shield can +0.06", "Victim with shield can −0.25"], inputs: "Part positions and sizes, aggressor critical distance", assumption: "Near-field coupling falls off linearly inside the critical distance; orientation and polarisation are ignored.", implemented: "geometry" },
  { id: "R2", name: "Harness crosstalk", mechanism: "Harness crosstalk", path: "Crosstalk", factor: "min(1, L / 1000 mm) × (1 − s / 40 mm) over the length two cables share a loom", modifiers: ["Twisted victim pair −0.18", "High-impedance analogue victim +0.18", "Shielded victim cable −0.5"], inputs: "Harness trunk, join and leave positions, bundle offsets", assumption: "Capacitive and inductive crosstalk scale with coupled length and inversely with separation; terminations are not modelled.", implemented: "geometry" },
  { id: "R3", name: "Conducted emissions", mechanism: "Conducted emissions", path: "Conducted", factor: "0.5 + (worst harmonic − limit) / 20 dB at the mains port", modifiers: ["Fixed-frequency switching +0.10"], inputs: "Switching frequency, unfiltered level, filter stages, limit line of every selected market", assumption: "Harmonic envelope falls at 20 dB/decade; a single-stage filter gives 25 dB at 150 kHz rising 40 dB/decade to a 60 dB ceiling; a second stage adds 12 dB; jitter removes 6 dB quasi-peak.", implemented: "geometry" },
  { id: "R4", name: "Shared supply rail", mechanism: "Shared supply rail", path: "Common impedance", factor: "Ripple class of the aggressor on the shared rail", modifiers: ["Local LC filter at the victim −0.40"], inputs: "Rail membership", assumption: "Rail impedance is not extracted; ripple class is a per-template estimate.", implemented: "parametric" },
  { id: "R5", name: "Common ground return", mechanism: "Common ground return", path: "Common impedance", factor: "min(1, loop area / 1000 cm²) × aggressor return noise, loop area = strap length × standoff", modifiers: ["Star topology removes the shared path"], inputs: "Ground strap polyline, standoff, topology", assumption: "The strap and chassis form a single-turn loop; mutual inductance to other loops is ignored.", implemented: "geometry" },
  { id: "R6", name: "Harmonics in victim band", mechanism: "Harmonics in victim band", path: "Radiated", factor: "0.3 + 0.2 × number of aggressor harmonics inside the victim band", modifiers: ["Harmonic order above 30 −0.45", "Victim shield can −0.20", "Aggressor spread spectrum −0.15", "Victim frequency hopping removes the risk"], inputs: "Switching and clock frequencies, victim bands", assumption: "Up to the 60th harmonic is considered; coupling path strength is not modelled.", implemented: "parametric" },
  { id: "R7", name: "Thermal proximity", mechanism: "Thermal proximity", path: "Thermal", factor: "0.5 + (T_est − T_limit) / 10 °C", modifiers: ["Sealed zone ×1.5 on coupled rise", "Victim not above the source ×0.6", "Baffle ×0.4"], inputs: "Zone ambient, dissipation, 3D gap, self rise", assumption: "Coupled rise = P × 60 / (gap + 30 mm). Not a CFD result; a filter for obviously hot neighbours.", implemented: "geometry" },
  { id: "R8", name: "ESD exposure", mechanism: "ESD exposure", path: "Port", factor: "0.30 for a user-accessible electronic surface", modifiers: ["No TVS array or guard ring +0.20", "TVS array and guard ring −0.18"], inputs: "User accessibility, protection fitted", assumption: "Air discharge reaches the sense electrodes through fascia gaps.", implemented: "parametric" },
  { id: "R9", name: "Flicker", mechanism: "Flicker", path: "Port", factor: "Pst − 0.29, Pst = d / d_lim(r), d = ΔP × 0.4 Ω / U²", modifiers: ["Staged elements halve d"], inputs: "Heater power, switching period", assumption: "d_lim(r) = 2.7 × r^−0.3 % approximates the Pst = 1 curve for rectangular changes.", implemented: "parametric" },
  { id: "R10", name: "Harmonic current", mechanism: "Harmonic current", path: "Port", factor: "0.46 × I3 / 2.30 A (Class A third-harmonic limit)", modifiers: ["Passive PFC choke: I3 = 0.45 × I1", "Active PFC: I3 = 0.08 × I1"], inputs: "Rectifier input power, PFC type", assumption: "Capacitor-input rectifier draws I3 = 0.75 × I1 at 230 V.", implemented: "parametric" },
  { id: "R11", name: "Unearthed conductive surface", mechanism: "Unearthed conductive surface", path: "Radiated", factor: "0.55 per conductive panel without an earth bond", modifiers: [], inputs: "Panel material, earth bond", assumption: "A floating panel re-radiates and collects ESD charge.", implemented: "parametric" },
  { id: "R12", name: "Aperture leakage", mechanism: "Aperture leakage", path: "Radiated", factor: "0.3 + (12 dB − effective shielding) / 20 when shielding falls below 12 dB", modifiers: [], inputs: "Panel calculator result, clock sources above 30 MHz", assumption: "Leak frequency f = 150 / longest aperture dimension in metres.", implemented: "geometry" },
  { id: "R13", name: "Cable resonance", mechanism: "Cable resonance", path: "Radiated", factor: "0.40 when a cable is within 3 % of a quarter wavelength of a clock harmonic (n ≤ 3)", modifiers: ["Ferrite clamp −0.30"], inputs: "Routed cable length, clock frequency", assumption: "Velocity factor 1.0; only the first three harmonics are checked.", implemented: "geometry" },
  { id: "R14", name: "Earth continuity", mechanism: "Earth continuity", path: "Port", factor: "0.80 when a Class I cabinet has no protective earth net or an unbonded conductive panel", modifiers: [], inputs: "Protection class, ground nets, panels", assumption: "Bond resistance is not calculated; presence only.", implemented: "parametric" },
];

export const RULE_BY_ID = Object.fromEntries(RULES.map((r) => [r.id, r])) as Record<string, RuleDef>;

export const IMPACT_WEIGHT = { mandatory: 1.0, verify: 0.8, voluntary: 0.6, functional: 0.7 } as const;
export const LEVEL_BANDS = { high: 60, medium: 30, low: 10 } as const;
export const HISTORY_ADJ = { strong: { jaccard: 0.8, add: 10 }, partial: { jaccard: 0.5, add: 6 } } as const;
