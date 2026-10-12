/**
 * Extra command-palette results beyond pages: the records an operator looks
 * up by id or name. Each entry navigates to the page that shows it.
 */
import { RULES, STANDARDS, TEMPLATES, CATEGORY_LABEL, MATERIALS } from "./tarang/catalog";
import { SEED_DESIGNS } from "./tarang/designs";
import { analyze } from "./tarang/engine";
import { LAB_REPORTS } from "./tarang/history";
import { BOOKINGS, PROGRAM_BY_ID } from "./tarang/portfolio";

export interface SearchRecord {
  id: string;
  group: string;
  title: string;
  detail: string;
  href: string;
}

const seeded = analyze(SEED_DESIGNS[0]);

export const SEARCH_RECORDS: SearchRecord[] = [
  ...SEED_DESIGNS.map((d) => ({
    id: `design-${d.id}`, group: "Designs", title: `${d.product} ${d.version}`,
    detail: `${d.note} · ${d.markets.join(" + ")}`, href: `/workspace/${d.id}`,
  })),
  ...seeded.risks.map((r) => ({
    id: `risk-${r.key}`, group: "Risks", title: `#${r.num} ${r.aggressor} → ${r.victim} · ${r.mechanism}`,
    detail: `${r.level} ${r.score} · ${r.coupling}`, href: `/risks?risk=${encodeURIComponent(r.key)}`,
  })),
  ...LAB_REPORTS.map((r) => ({
    id: `report-${r.id}`, group: "Lab reports", title: `${r.id} ${r.product} · ${r.test}`,
    detail: `${r.result === "fail" ? "Fail" : "Pass"} · ${r.standard} · ${r.rootCause}`, href: `/test-history?report=${r.id}`,
  })),
  ...STANDARDS.map((s) => ({
    id: `std-${s.id}`, group: "Standards", title: s.code, detail: `${s.market} · ${s.title}`,
    href: `/libraries/standards?std=${s.id}`,
  })),
  ...RULES.map((r) => ({
    id: `rule-${r.id}`, group: "Rules", title: `${r.id} ${r.name}`, detail: r.factor, href: `/libraries/rules?rule=${r.id}`,
  })),
  ...TEMPLATES.map((t) => ({
    id: `tpl-${t.id}`, group: "Components", title: t.name, detail: `${CATEGORY_LABEL[t.category]} · ${t.freqLabel}`,
    href: `/libraries/components?q=${encodeURIComponent(t.name)}`,
  })),
  ...MATERIALS.map((m) => ({
    id: `mat-${m.id}`, group: "Materials", title: m.name, detail: `${m.cls} · ${m.shieldingDb} dB at 1 mm`,
    href: "/libraries/materials",
  })),
  ...BOOKINGS.map((b) => ({
    id: `bk-${b.id}`, group: "Chamber bookings", title: `${b.id} ${PROGRAM_BY_ID[b.programId].name}`,
    detail: `${b.date} · ${b.lab}`, href: "/lab-readiness",
  })),
];
