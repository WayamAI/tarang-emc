"use client";

/** Compare two versions: index change, risks resolved, new and moved, layout and wiring edits, compliance changes. */

import { ArrowLeftRight } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";

import { PageBody, PageHeader } from "@/components/layout/page-header";
import { RiskDrawer } from "@/components/tarang/risk-drawer";
import { Button, DesignPicker, Figure, Label, LevelBadge, LinkButton, M } from "@/components/tarang/ui";
import { DataTable, FilterChips, type Column } from "@/components/ui/data-table";
import { InlineArrow, Panel, SplitRow, StatusBadge, type StatusTone } from "@/components/ui/primitives";
import { MARKS } from "@/lib/marks";
import { useTarang } from "@/lib/tarang/context";
import { TONE_TEXT, toneForIndex } from "@/lib/tarang/format";
import { compareRisks, complianceMatrix, diffDesigns, OUTCOME_TONE, type RiskDelta } from "@/lib/tarang/selectors";

const KIND_LABEL: Record<RiskDelta["kind"], string> = { resolved: "Resolved", new: "New", level: "Level changed", score: "Score changed", same: "Unchanged" };
const KIND_TONE: Record<RiskDelta["kind"], StatusTone> = { resolved: "success", new: "error", level: "info", score: "neutral", same: "neutral" };

function Compare() {
  const params = useSearchParams();
  const { designs, designById, analysisOf, override } = useTarang();
  const [aId, setAId] = useState(designById(params.get("a") ?? "")?.id ?? designs[0].id);
  const [bId, setBId] = useState(designById(params.get("b") ?? "")?.id ?? designs.find((d) => d.id === "aqualine-fl8-v2")?.id ?? designs[designs.length - 1].id);
  const [kind, setKind] = useState("changed");
  const [riskKey, setRiskKey] = useState<{ designId: string; key: string } | null>(null);

  const a = designById(aId) ?? designs[0];
  const b = designById(bId) ?? designs[0];
  const analysisA = analysisOf(a.id);
  const analysisB = analysisOf(b.id);

  const deltas = useMemo(() => compareRisks(analysisA, analysisB), [analysisA, analysisB]);
  const diffs = useMemo(() => diffDesigns(a, b), [a, b]);
  const matrixChanges = useMemo(() => {
    const ma = complianceMatrix(a, analysisA, override);
    const mb = complianceMatrix(b, analysisB, override);
    const ids = [...new Set([...ma.map((r) => r.test.id), ...mb.map((r) => r.test.id)])];
    return ids
      .map((id) => {
        const ra = ma.find((r) => r.test.id === id);
        const rb = mb.find((r) => r.test.id === id);
        const oa = ra ? Object.values(ra.cells)[0].outcome : undefined;
        const ob = rb ? Object.values(rb.cells)[0].outcome : undefined;
        return { id, name: (ra ?? rb)!.test.name, before: oa, after: ob, worstA: ra?.worst?.score, worstB: rb?.worst?.score };
      })
      .filter((c) => c.before !== c.after);
  }, [a, b, analysisA, analysisB, override]);

  const count = (k: RiskDelta["kind"]) => deltas.filter((d) => d.kind === k).length;
  const rows = kind === "all" ? deltas : kind === "changed" ? deltas.filter((d) => d.kind !== "same") : deltas.filter((d) => d.kind === kind);
  const change = analysisB.index - analysisA.index;
  const sameProgram = a.programId === b.programId;

  const columns: Column<RiskDelta>[] = [
    { key: "num", header: "ID", render: (d) => <span className="tabular text-primary">#{d.num}</span>, value: (d) => d.num },
    { key: "label", header: "Path", render: (d) => <span className="tabular">{d.label}</span>, value: (d) => d.label },
    { key: "mechanism", header: "Mechanism", render: (d) => d.mechanism, value: (d) => d.mechanism },
    { key: "before", header: `${a.version} score`, align: "right", render: (d) => <span className="tabular">{d.before ?? ""}</span>, value: (d) => d.before ?? 0 },
    { key: "after", header: `${b.version} score`, align: "right", render: (d) => <span className="tabular">{d.after ?? ""}</span>, value: (d) => d.after ?? 0 },
    {
      key: "delta", header: "Change", align: "right", card: "metric",
      render: (d) => {
        const diff = (d.after ?? 0) - (d.before ?? 0);
        return <span className={`tabular ${diff < 0 ? "text-success" : diff > 0 ? "text-error" : "text-quaternary"}`}>{diff > 0 ? "+" : ""}{diff}</span>;
      },
      value: (d) => (d.after ?? 0) - (d.before ?? 0),
    },
    {
      key: "level", header: "Level",
      render: (d) => (
        <span className="inline-flex items-center gap-1">
          {d.levelBefore ? <LevelBadge level={d.levelBefore} /> : <span className="text-quaternary">none</span>}
          <InlineArrow className="text-quaternary" />
          <LevelBadge level={d.levelAfter} />
        </span>
      ),
      value: (d) => d.levelAfter ?? "",
    },
    { key: "kind", header: "Outcome", render: (d) => <StatusBadge tone={KIND_TONE[d.kind]}>{KIND_LABEL[d.kind]}</StatusBadge>, value: (d) => KIND_LABEL[d.kind] },
  ];

  return (
    <>
      <PageHeader
        title="Compare"
        description="Two versions side by side: what the edits bought, what they cost, and whether anything new appeared."
        mark={<M mark={MARKS.compare} size={44} />}
        actions={
          <>
            <DesignPicker value={aId} onChange={setAId} />
            <Button
              aria-label="Swap versions"
              onClick={() => {
                setAId(bId);
                setBId(aId);
              }}
            >
              <ArrowLeftRight size={13} strokeWidth={1.75} aria-hidden />
            </Button>
            <DesignPicker value={bId} onChange={setBId} />
          </>
        }
      >
        {!sameProgram ? <p className="text-body-sm text-warning">These are different products. Risk ids are matched by rule and reference designator, so read the diff with care.</p> : null}
      </PageHeader>
      <PageBody>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-muted bg-container px-4 py-3.5 sm:grid-cols-3 lg:grid-cols-6">
            <Figure label={`${a.product} ${a.version}`} value={analysisA.index} tone={TONE_TEXT[toneForIndex(analysisA.index)]} hint={`${analysisA.counts.High} H · ${analysisA.counts.Medium} M · ${analysisA.counts.Low} L`} />
            <Figure label={`${b.product} ${b.version}`} value={analysisB.index} tone={TONE_TEXT[toneForIndex(analysisB.index)]} hint={`${analysisB.counts.High} H · ${analysisB.counts.Medium} M · ${analysisB.counts.Low} L`} />
            <Figure label="Index change" value={`${change > 0 ? "+" : ""}${change}`} tone={change < 0 ? "text-success" : change > 0 ? "text-error" : "text-primary"} hint="lower is better" />
            <Figure label="Resolved" value={count("resolved")} tone="text-success" hint="no longer score 10" />
            <Figure label="New" value={count("new")} tone={count("new") ? "text-error" : "text-primary"} hint="introduced by the edits" />
            <Figure label="Level changed" value={count("level")} hint="still listed" />
          </div>

          <Panel title={`Risk changes · ${rows.length}`} padded={false} className="h-[30rem]!">
            <div className="flex h-full min-h-0 flex-col">
              <div className="shrink-0 border-b border-muted p-3">
                <FilterChips
                  options={[
                    { id: "changed", label: "Changed", count: deltas.filter((d) => d.kind !== "same").length },
                    { id: "resolved", label: "Resolved", count: count("resolved") },
                    { id: "new", label: "New", count: count("new") },
                    { id: "level", label: "Level changed", count: count("level") },
                    { id: "score", label: "Score changed", count: count("score") },
                    { id: "all", label: "All", count: deltas.length },
                  ]}
                  value={kind}
                  onChange={setKind}
                />
              </div>
              <div className="min-h-0 flex-1">
                <DataTable
                  rows={rows}
                  columns={columns}
                  rowKey={(d) => d.key}
                  onRowClick={(d) => setRiskKey(d.kind === "resolved" ? { designId: a.id, key: d.key } : { designId: b.id, key: d.key })}
                  defaultSort={{ key: "delta", dir: "asc" }}
                  searchable={false}
                  exportName={`tarang-compare-${a.id}-${b.id}`}
                  emptyTitle="No risk differs between these versions"
                  serial={false}
                />
              </div>
            </div>
          </Panel>

          <SplitRow ratio="1.4/1">
            <Panel title={`Layout and wiring edits · ${diffs.length}`}>
              {diffs.length ? (
                <ul className="flex flex-col">
                  {diffs.map((d, i) => (
                    <li key={`${d.subject}-${i}`} className="flex items-start gap-3 border-b border-muted py-2 last:border-b-0">
                      <span className="w-24 shrink-0"><StatusBadge tone="neutral">{d.area}</StatusBadge></span>
                      <span className="w-12 shrink-0 truncate text-body-sm tabular text-primary">{d.subject}</span>
                      <span className="min-w-0 flex-1 text-body-sm text-secondary">{d.change}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-body-md text-tertiary">The two versions have the same layout, wiring, grounding and markets.</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <LinkButton href={`/workspace/${a.id}`}>Open {a.version}</LinkButton>
                <LinkButton href={`/workspace/${b.id}`} variant="primary">Open {b.version}</LinkButton>
              </div>
            </Panel>
            <Panel title={`Compliance changes · ${matrixChanges.length}`}>
              {matrixChanges.length ? (
                <ul className="flex flex-col">
                  {matrixChanges.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-muted py-2 last:border-b-0">
                      <span className="min-w-0 flex-1 truncate text-body-sm text-secondary">{c.name}</span>
                      <span className="inline-flex shrink-0 items-center gap-1">
                        {c.before ? <StatusBadge tone={OUTCOME_TONE[c.before]}>{c.before}</StatusBadge> : <span className="text-caption text-quaternary">not in scope</span>}
                        <InlineArrow className="text-quaternary" />
                        {c.after ? <StatusBadge tone={OUTCOME_TONE[c.after]}>{c.after}</StatusBadge> : <span className="text-caption text-quaternary">not in scope</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-body-md text-tertiary">Every test keeps the same predicted outcome.</p>
              )}
              <Label className="mt-3">Predicted from the worst linked risk in each version.</Label>
            </Panel>
          </SplitRow>
        </div>
      </PageBody>
      <RiskDrawer designId={riskKey?.designId ?? a.id} riskKey={riskKey?.key ?? null} onClose={() => setRiskKey(null)} />
    </>
  );
}

export default function ComparePage() {
  return (
    <Suspense>
      <Compare />
    </Suspense>
  );
}
