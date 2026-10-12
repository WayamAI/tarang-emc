/**
 * Primary navigation.
 *
 * One source of truth: the sidebar, the command palette's page results and the
 * top bar's title all read this. Adding a route means adding it here once.
 *
 * Groups with more than one item render as a collapsible tree in the sidebar.
 * Optional `sections` add a second branch level. Keep the sidebar to seven
 * groups or fewer so the collapsed rail never outgrows a laptop viewport.
 */

import {
  Activity, AudioWaveform, BookOpenCheck, Boxes, ChartNoAxesCombined, CircuitBoard, ClipboardCheck, DoorOpen,
  FileText, FlaskConical, GitCompare, LayoutDashboard, Library, Move3d, Radar, Settings, ShieldAlert, Wrench,
  type LucideIcon,
} from "lucide-react";

import { SEED_DESIGNS } from "./tarang/designs";
import { analyze } from "./tarang/engine";
import { LAB_REPORTS } from "./tarang/history";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Open-work count shown beside the leaf in the expanded tree. */
  badge?: number;
}

export interface NavSection {
  id: string;
  label: string;
  items: NavItem[];
}

export interface NavGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
  /** Optional second-level labels inside a dropdown. */
  sections?: NavSection[];
  /** Hidden from the sidebar; still indexed for the top bar and search. */
  sidebar?: false;
}

// Open-work counts for the seeded front-loader as designed.
const SEEDED = analyze(SEED_DESIGNS[0]);
const OPEN_RISKS = SEEDED.risks.length;
const OPEN_HIGH = SEEDED.counts.High;
const FAILED_REPORTS = LAB_REPORTS.filter((r) => r.result === "fail").length;

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "command-center",
    label: "Command Center",
    icon: LayoutDashboard,
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    id: "design",
    label: "Design",
    icon: Move3d,
    items: [
      { label: "Designs", href: "/designs", icon: DoorOpen, badge: SEED_DESIGNS.length },
      { label: "Workspace", href: "/workspace", icon: Move3d },
      { label: "Compare", href: "/compare", icon: GitCompare },
    ],
  },
  {
    id: "risk",
    label: "Risk",
    icon: ShieldAlert,
    items: [
      { label: "Risk Register", href: "/risks", icon: AudioWaveform, badge: OPEN_RISKS },
      { label: "Fix Planner", href: "/fixes", icon: Wrench, badge: OPEN_HIGH },
    ],
  },
  {
    id: "compliance",
    label: "Compliance",
    icon: ChartNoAxesCombined,
    items: [
      { label: "Compliance Matrix", href: "/compliance", icon: ChartNoAxesCombined },
      { label: "Lab Readiness", href: "/lab-readiness", icon: Radar },
      { label: "Review Pack", href: "/review-pack", icon: FileText },
    ],
  },
  {
    id: "evidence",
    label: "Evidence",
    icon: FlaskConical,
    items: [{ label: "Test History", href: "/test-history", icon: Activity, badge: FAILED_REPORTS }],
  },
  {
    id: "libraries",
    label: "Libraries",
    icon: Library,
    items: [
      { label: "Components", href: "/libraries/components", icon: CircuitBoard },
      { label: "Materials", href: "/libraries/materials", icon: Boxes },
      { label: "Standards", href: "/libraries/standards", icon: BookOpenCheck },
      { label: "Rules & Assumptions", href: "/libraries/rules", icon: ClipboardCheck },
    ],
  },
  {
    id: "administration",
    label: "Administration",
    icon: Settings,
    sidebar: false,
    items: [{ label: "Settings", href: "/settings", icon: Settings }],
  },
];

export function itemsInGroup(group: NavGroup): NavItem[] {
  return group.sections?.length
    ? group.sections.flatMap((section) => section.items)
    : group.items;
}

export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap(itemsInGroup);

export const SIDEBAR_GROUPS: NavGroup[] = NAV_GROUPS.filter((g) => g.sidebar !== false);

/** Longest-prefix match, so /designs/D-1 still resolves to Designs. */
export function navItemForPath(pathname: string): NavItem | undefined {
  return ALL_NAV_ITEMS.filter(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  ).sort((a, b) => b.href.length - a.href.length)[0];
}

export function groupForPath(pathname: string): NavGroup | undefined {
  const item = navItemForPath(pathname);
  if (!item) return undefined;
  return NAV_GROUPS.find((g) => itemsInGroup(g).includes(item));
}
