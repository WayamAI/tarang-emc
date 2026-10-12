"use client";

/**
 * Risk Register: every aggressor → victim coupling the engine scored at 10 or
 * more for the design in scope, with the lab history and top fix beside it.
 */

import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";

import { PageBody, PageHeader } from "@/components/layout/page-header";
import { Heatmap } from "@/components/tarang/heatmap";
import { RiskDrawer } from "@/components/tarang/risk-drawer";
import { DesignPicker, Label, LevelBadge, LinkButton, M, ScoreBar } from "@/components/tarang/ui";
import { DataTable, FilterChips, type Column } from "@/components/ui/data-table";
import { InfoPopover } from "@/components/ui/info-popover";
import { KpiTile, Panel, SplitRow, StatusBadge } from "@/components/ui/primitives";
import { MARKS } from "@/lib/marks";
import { useTarang } from "@/lib/tarang/context";
import { toneForIndex } from "@/lib/tarang/format";
import { planFor } from "@/lib/tarang/planner";
import type { Risk } from "@/lib/tarang/types";

type Row = Risk & { topFix?: string; proven: boolean };

function RiskRegister() {
  const params = useSearchParams();
  const { active, analysisOf, override, overrideActive } = useTarang();
  const analysis = analysisOf(active.id);
  const [level, setLevel] = useState("all");
  const [selected, setSelected] = useState<string | null>(params.get("risk"));

  const rows = useMemo<Row[]>(
    () =>
      planFor(active, analysis, override).map(({ risk, recs }) => ({
        ...risk,
        topFix: recs[0]?.fix.type,
        proven: Boolean(recs[0]?.provenBy),
      })),
    [active, analysis, override],
  );
  const filtered = level === "all" ? rows : rows.filter((r) => r.level === level);
  const top = analysis.risks.slice(0, 3);

  const columns: Column<Row>[] = [
    { key: "num", header: "ID", width: "w-14", render: (r) => <span className="tabular text-primary">#{r.num}</span>, value: (r) => r.num },
    { key: "aggressor", header: "Aggressor", render: (r) => <span className="tabular">{r.aggressor}</span>, value: (r) => r.aggressor },
    { key: "victim", header: "Victim", render: (r) => <span className="tabular">{r.victim}</span>, value: (r) => r.victim },
    { key: "mechanism", header: "Mechanism", render: (r) => r.mechanism, value: (r) => r.mechanism },
    { key: "coupling", header: "Coupling path", render: (r) => <span title={r.coupling}>{r.coupling}</span>, value: (r) => r.coupling, card: false },
    { key: "score", header: "Score", align: "right", render: (r) => <ScoreBar score={r.score} level={r.level} />, value: (r) => r.score, card: "metric" },
    { key: "level", header: "Level", render: (r) => <LevelBadge level={r.level} />, value: (r) => r.level },
    { key: "tests", header: "Affected tests", hide: "md", render: (r) => (r.standards.length ? r.standards.join(", ") : <span className="text-quaternary">Functional</span>), value: (r) => r.standards.join(", ") },
    { key: "history", header: "Lab history", align: "right", hide: "lg", render: (r) => <span className="tabular">{r.matches.length}</span>, value: (r) => r.matches.length },
    {
      key: "fix", header: "Top fix", hide: "md",
      render: (r) => (r.topFix ? <StatusBadge tone={r.proven ? "success" : "neutral"}>{r.topFix}</StatusBadge> : <span className="text-quaternary">None</span>),
      value: (r) => r.topFix ?? "",
    },
  ];

  return (
    <>
      <PageHeader
        title="Risk Register"
        description={`${active.product} ${active.version}, scored against ${active.markets.join(" + ")}. Open a row to see how the score was built and which fix moves it.`}
        mark={<M mark={MARKS.register} size={44} />}
        info={
          <InfoPopover label="How scores are built">
            score = min(100, round(100 × clamp(rule factor + modifiers, 0, 1) × impact) + history adjustment). High is 60 and above, Medium
            30 to 59, Low 10 to 29. Anything under 10 is not listed.
          </InfoPopover>
        }
        actions={
          <>
            <DesignPicker />
            <LinkButton href="/fixes" variant="primary">
              Plan fixes
            </LinkButton>
          </>
        }
      >
        {overrideActive ? (
          <p className="text-body-sm text-warning">A simulated standards change is in force. Scores reflect it. Reset it in Libraries, Standards.</p>
        ) : null}
      </PageHeader>

      <PageBody>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiTile label="Risk index" value={String(analysis.index)} hint="worst, top three, High count" tone={toneForIndex(analysis.index)} mark={<M mark={MARKS.riskIndex} />} />
            <KpiTile label="High" value={String(analysis.counts.High)} hint="score 60 and above" tone="error" mark={<M mark={MARKS.highRisk} />} />
            <KpiTile label="Medium" value={String(analysis.counts.Medium)} hint="score 30 to 59" tone="warning" />
            <KpiTile label="Low" value={String(analysis.counts.Low)} hint="score 10 to 29" tone="info" />
          </div>

          <SplitRow ratio="1/1.4">
            <Panel title="Top three risks">
              {top.length ? (
                <ul className="flex flex-col gap-2">
                  {top.map((risk) => (
                    <li key={risk.key}>
                      <button
                        type="button"
                        onClick={() => setSelected(risk.key)}
                        className="flex w-full items-start gap-3 rounded-md border border-muted bg-page px-3 py-2.5 text-left outline-none transition-colors duration-[150ms] hover:border-default hover:bg-raised focus-visible:ring-2 focus-visible:ring-active"
                      >
                        <span className="font-display text-display-lg tabular text-primary">{risk.score}</span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-body-md text-primary">
                              #{risk.num} {risk.aggressor} → {risk.victim}
                            </span>
                            <LevelBadge level={risk.level} />
                          </span>
                          <span className="mt-0.5 block text-body-sm text-tertiary">
                            {risk.mechanism}: {risk.coupling}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-body-md text-tertiary">Nothing scores 10 or more. This layout is clear to book.</p>
              )}
            </Panel>
            <Panel title="Which aggressor reaches which victim" action={<M mark={MARKS.heatmap} size={24} />}>
              <Heatmap analysis={analysis} onSelect={setSelected} selectedKey={selected} />
              <Label className="mt-3">Cell shows the worst score for the pair; a superscript counts stacked mechanisms.</Label>
            </Panel>
          </SplitRow>

          <Panel title={`Register · ${filtered.length}`} padded={false} className="h-[34rem]!">
            <div className="flex h-full min-h-0 flex-col">
              <div className="shrink-0 border-b border-muted p-3">
                <FilterChips
                  options={[
                    { id: "all", label: "All", count: rows.length },
                    { id: "High", label: "High", count: analysis.counts.High },
                    { id: "Medium", label: "Medium", count: analysis.counts.Medium },
                    { id: "Low", label: "Low", count: analysis.counts.Low },
                  ]}
                  value={level}
                  onChange={setLevel}
                />
              </div>
              <div className="min-h-0 flex-1">
                <DataTable
                  rows={filtered}
                  columns={columns}
                  rowKey={(r) => r.key}
                  onRowClick={(r) => setSelected(r.key)}
                  isRowSelected={(r) => r.key === selected}
                  defaultSort={{ key: "score", dir: "desc" }}
                  searchPlaceholder="Search risks, parts, standards"
                  exportName={`tarang-risks-${active.id}`}
                  emptyTitle="No risks at this level"
                  serial={false}
                />
              </div>
            </div>
          </Panel>
        </div>
      </PageBody>

      <RiskDrawer designId={active.id} riskKey={selected} onClose={() => setSelected(null)} />
    </>
  );
}

export default function RisksPage() {
  return (
    <Suspense>
      <RiskRegister />
    </Suspense>
  );
}
