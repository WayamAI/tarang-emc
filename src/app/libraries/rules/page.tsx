"use client";

/** Rules and assumptions: the fourteen rules, the scoring model and what each one takes on trust. */

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { PageBody, PageHeader } from "@/components/layout/page-header";
import { DesignPicker, Drawer, Label, LevelBadge, LinkButton, M } from "@/components/tarang/ui";
import { DataTable, FilterChips, type Column } from "@/components/ui/data-table";
import { Panel, SplitRow, StatusBadge } from "@/components/ui/primitives";
import { MARKS } from "@/lib/marks";
import { HISTORY_ADJ, IMPACT_WEIGHT, LEVEL_BANDS, RULES, RULE_BY_ID } from "@/lib/tarang/catalog";
import { useTarang } from "@/lib/tarang/context";
import { FIXES } from "@/lib/tarang/fixes";
import type { RuleDef } from "@/lib/tarang/types";

const PATHS = [...new Set(RULES.map((r) => r.path))];

function RulesLibrary() {
  const params = useSearchParams();
  const { active, analysisOf } = useTarang();
  const analysis = analysisOf(active.id);
  const [path, setPath] = useState("all");
  const [openId, setOpenId] = useState<string | null>(RULE_BY_ID[params.get("rule") ?? ""]?.id ?? null);
  const rows = path === "all" ? RULES : RULES.filter((r) => r.path === path);
  const open = openId ? RULE_BY_ID[openId] : undefined;
  const raised = open ? analysis.risks.filter((r) => r.rule === open.id) : [];
  const fixes = open ? FIXES.filter((f) => f.rules.includes(open.id)) : [];

  const columns: Column<RuleDef>[] = [
    { key: "id", header: "Rule", render: (r) => <span className="tabular text-primary">{r.id}</span>, value: (r) => Number(r.id.slice(1)) },
    { key: "name", header: "Name", render: (r) => <span className="text-primary">{r.name}</span>, value: (r) => r.name },
    { key: "path", header: "Coupling path", render: (r) => r.path, value: (r) => r.path },
    { key: "factor", header: "Rule factor", render: (r) => <span title={r.factor}>{r.factor}</span>, value: (r) => r.factor, card: false },
    { key: "impl", header: "Reads", render: (r) => <StatusBadge tone={r.implemented === "geometry" ? "info" : "neutral"}>{r.implemented === "geometry" ? "3D geometry" : "Part parameters"}</StatusBadge>, value: (r) => r.implemented },
    { key: "pairs", header: "Pairs checked", align: "right", render: (r) => <span className="tabular">{analysis.rulesEvaluated[r.id].pairs}</span>, value: (r) => analysis.rulesEvaluated[r.id].pairs, hide: "md" },
    { key: "raised", header: "Raised", align: "right", render: (r) => <span className="tabular">{analysis.rulesEvaluated[r.id].raised}</span>, value: (r) => analysis.rulesEvaluated[r.id].raised, card: "metric" },
  ];

  return (
    <>
      <PageHeader
        title="Rules & Assumptions"
        description="Every score in Tarang comes from one of fourteen deterministic rules. This page shows what each rule reads, what it assumes, and how often it fired on the design in scope."
        mark={<M mark={MARKS.rules} size={44} />}
        actions={<DesignPicker />}
      >
        <FilterChips options={[{ id: "all", label: "All paths", count: RULES.length }, ...PATHS.map((p) => ({ id: p, label: p, count: RULES.filter((r) => r.path === p).length }))]} value={path} onChange={setPath} />
      </PageHeader>
      <PageBody>
        <div className="flex flex-col gap-4">
          <SplitRow ratio="1/2">
            <Panel title="Scoring model">
              <p className="rounded-md border border-muted bg-raised px-3 py-2 text-body-sm tabular text-primary">
                score = min(100, round(100 × clamp(rule factor + modifiers, 0, 1) × impact) + history adjustment)
              </p>
              <Label className="mt-4 mb-1.5">Levels</Label>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                <span className="inline-flex items-center gap-2 text-body-sm text-secondary"><LevelBadge level="High" /> {LEVEL_BANDS.high} and above</span>
                <span className="inline-flex items-center gap-2 text-body-sm text-secondary"><LevelBadge level="Medium" /> {LEVEL_BANDS.medium} to {LEVEL_BANDS.high - 1}</span>
                <span className="inline-flex items-center gap-2 text-body-sm text-secondary"><LevelBadge level="Low" /> {LEVEL_BANDS.low} to {LEVEL_BANDS.medium - 1}</span>
              </div>
              <Label className="mt-4 mb-1">Impact weight, from the strictest status in the selected markets</Label>
              {(Object.entries(IMPACT_WEIGHT) as [string, number][]).map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-3 py-0.5">
                  <span className="text-body-sm text-tertiary">{k === "functional" ? "functional, no regulatory test" : k}</span>
                  <span className="text-body-sm tabular text-secondary">{v.toFixed(1)}</span>
                </div>
              ))}
              <Label className="mt-4 mb-1">History adjustment, Jaccard overlap of condition tags with a failing report</Label>
              <div className="flex items-baseline justify-between gap-3 py-0.5">
                <span className="text-body-sm text-tertiary">overlap {HISTORY_ADJ.strong.jaccard} or more</span>
                <span className="text-body-sm tabular text-secondary">+{HISTORY_ADJ.strong.add}</span>
              </div>
              <div className="flex items-baseline justify-between gap-3 py-0.5">
                <span className="text-body-sm text-tertiary">overlap {HISTORY_ADJ.partial.jaccard} or more</span>
                <span className="text-body-sm tabular text-secondary">+{HISTORY_ADJ.partial.add}</span>
              </div>
              <Label className="mt-4 mb-1">Design risk index</Label>
              <p className="text-body-sm text-tertiary">
                min(100, round(0.45 × worst score + 0.55 × mean of the three worst + number of Highs)). One unresolved High keeps the index
                high; clearing them one at a time walks it down.
              </p>
            </Panel>
            <Panel title={`Rules · ${rows.length}`} padded={false} className="min-h-[30rem]">
              <DataTable rows={rows} columns={columns} rowKey={(r) => r.id} onRowClick={(r) => setOpenId(r.id)} isRowSelected={(r) => r.id === openId} defaultSort={{ key: "id", dir: "asc" }} searchPlaceholder="Search rules" exportName="tarang-rules" serial={false} />
            </Panel>
          </SplitRow>
        </div>
      </PageBody>

      <Drawer open={Boolean(open)} onClose={() => setOpenId(null)} title={open ? `${open.id} ${open.name}` : ""} subtitle={open ? `${open.path} path` : undefined}>
        {open ? (
          <div className="flex flex-col gap-4">
            <div>
              <Label>Rule factor</Label>
              <p className="mt-1 text-body-md text-primary">{open.factor}</p>
            </div>
            <div>
              <Label>Modifiers</Label>
              {open.modifiers.length ? (
                <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-5">
                  {open.modifiers.map((m) => (
                    <li key={m} className="text-body-sm text-secondary">
                      {m}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-body-sm text-tertiary">None.</p>
              )}
            </div>
            <div>
              <Label>Inputs it reads</Label>
              <p className="mt-1 text-body-sm text-secondary">{open.inputs}</p>
            </div>
            <div className="rounded-md border border-warning-stroke bg-warning-surface px-3 py-2">
              <Label>Assumption to keep in mind</Label>
              <p className="mt-1 text-body-sm text-secondary">{open.assumption}</p>
            </div>
            <div>
              <Label>
                Raised on {active.product} {active.version} · {raised.length}
              </Label>
              {raised.length ? (
                <ul className="mt-1.5 flex flex-col gap-1">
                  {raised.map((risk) => (
                    <li key={risk.key}>
                      <LinkButton href={`/risks?risk=${encodeURIComponent(risk.key)}`} variant="ghost" className="-ml-3 max-w-full">
                        <span className="tabular text-primary">{risk.score}</span>
                        <span className="truncate">
                          #{risk.num} {risk.aggressor} → {risk.victim}, {risk.coupling}
                        </span>
                      </LinkButton>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-body-sm text-tertiary">
                  Checked {analysis.rulesEvaluated[open.id].pairs} pair{analysis.rulesEvaluated[open.id].pairs === 1 ? "" : "s"}; nothing reached a score of 10.
                </p>
              )}
            </div>
            <div>
              <Label>Catalogue fixes for this rule</Label>
              <ul className="mt-1 flex flex-col gap-1">
                {fixes.map((f) => (
                  <li key={f.id} className="flex items-start gap-2 text-body-sm text-secondary">
                    <StatusBadge tone="neutral">{f.type}</StatusBadge>
                    <span className="min-w-0">{f.detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </Drawer>
    </>
  );
}

export default function RulesPage() {
  return (
    <Suspense>
      <RulesLibrary />
    </Suspense>
  );
}
