/**
 * Mark registry: every dimensional mark the app uses, the Lucide glyph shown
 * until its render exists at public/images/marks/<id>.png, and where it appears.
 * The numbering in prompts.md follows this order.
 */

import {
  Activity, AudioWaveform, BadgeCheck, BookOpenCheck, Box, Boxes, Cable, CalendarClock, ChartNoAxesCombined, CircleDollarSign, CircuitBoard, ClipboardCheck, Cpu, DoorOpen, FileText, FlaskConical, Gauge, GitCompare, Grid3x3, Hourglass, Layers, LayoutDashboard, Magnet, Move3d, Nfc, Radar, Radio, Ruler, Scale, ScanSearch, ShieldCheck, ShieldQuestion, SlidersHorizontal, Stamp, Telescope, TriangleAlert, Unplug, Wrench, Zap,
  type LucideIcon,
} from "lucide-react";

export interface MarkDef {
  id: string;
  icon: LucideIcon;
  used: string;
}

export const MARKS = {
  command: { id: "mark-command", icon: LayoutDashboard, used: "/dashboard header" },
  riskIndex: { id: "mark-risk-index", icon: Gauge, used: "Risk index KPI on /dashboard, /risks" },
  highRisk: { id: "mark-high-risk", icon: TriangleAlert, used: "High-risk KPI on /dashboard, /risks, /compliance, /designs" },
  firstPass: { id: "mark-first-pass", icon: BadgeCheck, used: "First-pass KPI on /dashboard, /lab-readiness, /compliance" },
  labWeeks: { id: "mark-lab-weeks", icon: Hourglass, used: "Lab weeks KPI on /dashboard, /test-history" },
  respin: { id: "mark-respin", icon: CircleDollarSign, used: "Re-spin cost KPI on /dashboard, /lab-readiness, /test-history" },
  booking: { id: "mark-chamber-booking", icon: CalendarClock, used: "Chamber bookings on /dashboard, /lab-readiness" },
  unproven: { id: "mark-unproven", icon: ShieldQuestion, used: "Unproven fixes on /dashboard, /fixes" },
  source: { id: "mark-source", icon: Zap, used: "Interference path, Source column" },
  path: { id: "mark-path", icon: ScanSearch, used: "Interference path, Coupling path column" },
  victim: { id: "mark-victim", icon: Radio, used: "Interference path, Victim column" },
  test: { id: "mark-test", icon: FlaskConical, used: "Interference path, Test at risk column" },
  observation: { id: "mark-observation", icon: Telescope, used: "Agent observation cards on /dashboard" },
  designs: { id: "mark-designs", icon: DoorOpen, used: "/designs header" },
  version: { id: "mark-version", icon: Layers, used: "Designs KPI on /designs" },
  workspace: { id: "mark-workspace", icon: Move3d, used: "/workspace header" },
  compare: { id: "mark-compare", icon: GitCompare, used: "/compare header" },
  ground: { id: "mark-ground", icon: Unplug, used: "Ground nets in the /workspace inspector" },
  harness: { id: "mark-harness", icon: Cable, used: "Harnesses in the /workspace inspector" },
  choke: { id: "mark-choke", icon: Magnet, used: "EMI filter control in the /workspace inspector" },
  part: { id: "mark-part", icon: Cpu, used: "Selected part in the /workspace inspector" },
  register: { id: "mark-register", icon: AudioWaveform, used: "/risks header" },
  heatmap: { id: "mark-heatmap", icon: Grid3x3, used: "Aggressor × victim heatmap on /risks" },
  fixes: { id: "mark-fixes", icon: Wrench, used: "/fixes header" },
  whatIf: { id: "mark-what-if", icon: SlidersHorizontal, used: "What-if tray on /fixes" },
  proven: { id: "mark-proven", icon: ShieldCheck, used: "Ranked fixes in the risk drawer, proven fix on /test-history" },
  compliance: { id: "mark-compliance", icon: ChartNoAxesCombined, used: "/compliance header" },
  lab: { id: "mark-lab", icon: Radar, used: "/lab-readiness header" },
  goNoGo: { id: "mark-go-no-go", icon: Scale, used: "Go / hold KPI on /lab-readiness" },
  reviewPack: { id: "mark-review-pack", icon: FileText, used: "/review-pack header" },
  signOff: { id: "mark-sign-off", icon: Stamp, used: "Sign-off block on /review-pack" },
  history: { id: "mark-history", icon: Activity, used: "/test-history header" },
  components: { id: "mark-components", icon: CircuitBoard, used: "/libraries/components header" },
  materials: { id: "mark-materials", icon: Boxes, used: "/libraries/materials header" },
  panelCalc: { id: "mark-panel-calc", icon: Ruler, used: "Panel calculator on /libraries/materials" },
  standards: { id: "mark-standards", icon: BookOpenCheck, used: "/libraries/standards header" },
  standardsWatch: { id: "mark-standards-watch", icon: Nfc, used: "Standards watch on /libraries/standards" },
  rules: { id: "mark-rules", icon: ClipboardCheck, used: "/libraries/rules header" },
  settings: { id: "mark-settings", icon: SlidersHorizontal, used: "/settings header" },
  empty: { id: "mark-empty", icon: Box, used: "Empty states on /workspace, /fixes" },
} as const satisfies Record<string, MarkDef>;

export const MARK_LIST: MarkDef[] = Object.values(MARKS);
