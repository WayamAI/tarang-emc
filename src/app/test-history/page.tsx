"use client";

/**
 * Test History: past lab reports. Failing reports whose condition tags match a
 * risk raise its score; passing retests mark the fix they record as proven.
 */

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";

import { PageBody, PageHeader } from "@/components/layout/page-header";
import { DesignPicker, Drawer, KeyValue, Label, LevelBadge, M } from "@/components/tarang/ui";
import { DataTable, FilterChips, type Column } from "@/components/ui/data-table";
import { InfoPopover } from "@/components/ui/info-popover";
import { BarList, KpiTile, Panel, SplitRow, StatusBadge } from "@/components/ui/primitives";
import { MARKS } from "@/lib/marks";
import { useTarang } from "@/lib/tarang/context";
import { FIX_BY_ID } from "@/lib/tarang/fixes";
import { dateShort, usd, usdCompact } from "@/lib/tarang/format";
import { LAB_REPORTS, PROVEN_FIX, REPORT_BY_ID } from "@/lib/tarang/history";
import type { LabReport } from "@/lib/tarang/types";

const mechanismOf = (r: LabReport) => r.tags[0].replace(/-/g, " ");
const FAMILIES = [...new Set(LAB_REPORTS.map((r) => r.family))];

function TestHistory() {
  const params = useSearchParams();
  const { active, analysisOf } = useTarang();
  const analysis = analysisOf(active.id);
  const [result, setResult] = useState("all");
  const [family, setFamily] = useState("all");
  const [mechanism, setMechanism] = useState<string | undefined>();
  const [openId, setOpenId] = useState<string | null>(params.get("report"));

  const fails = LAB_REPORTS.filter((r) => r.result === "fail");
  const rows = LAB_REPORTS.filter(
    (r) => (result === "all" || r.result === result) && (family === "all" || r.family === family) && (!mechanism || mechanismOf(r) === mechanism),
  );
  const byMechanism = useMemo(() => {
    const weeks = new Map<string, number>();
    for (const r of LAB_REPORTS) if (r.result === "fail") weeks.set(mechanismOf(r), (weeks.get(mechanismOf(r)) ?? 0) + r.delayWeeks);
    return [...weeks.entries()].map(([id, value]) => ({ id, label: id, value })).sort((a, b) => b.value - a.value);
  }, []);
  const matchCount = (id: string) => analysis.risks.filter((r) => r.matches.some((m) => m.reportId === id)).length;

  const open = openId ? REPORT_BY_ID[openId] : undefined;
  const linked = open ? analysis.risks.filter((r) => r.matches.some((m) => m.reportId === open.id)) : [];

  const columns: Column<LabReport>[] = [
    { key: "id", header: "Report", render: (r) => <span className="tabular text-primary">{r.id}</span>, value: (r) => r.id },
    { key: "date", header: "Date", render: (r) => <span className="tabular">{dateShort(r.date)}</span>, value: (r) => r.date },
    { key: "product", header: "Product", render: (r) => r.product, value: (r) => r.product },
    { key: "test", header: "Test", render: (r) => r.test, value: (r) => r.test },
    { key: "standard", header: "Standard", render: (r) => r.standard, value: (r) => r.standard, hide: "md" },
    { key: "result", header: "Result", render: (r) => <StatusBadge tone={r.result === "fail" ? "error" : "success"}>{r.result === "fail" ? "Fail" : "Pass"}</StatusBadge>, value: (r) => r.result },
    { key: "margin", header: "Margin dB", align: "right", render: (r) => <span className={`tabular ${r.marginDb < 0 ? "text-error" : ""}`}>{r.marginDb > 0 ? "+" : ""}{r.marginDb}</span>, value: (r) => r.marginDb, card: "metric" },
    { key: "freq", header: "Failing freq", render: (r) => r.failFreq ?? <span className="text-quaternary">n/a</span>, value: (r) => r.failFreq ?? "", hide: "md" },
    { key: "cause", header: "Root cause", render: (r) => <span title={r.rootCause}>{r.rootCause}</span>, value: (r) => r.rootCause, card: false },
    { key: "fix", header: "Fix applied", render: (r) => <span title={r.fixApplied}>{r.fixApplied}</span>, value: (r) => r.fixApplied, hide: "lg", card: false },
    { key: "delay", header: "Delay wk", align: "right", render: (r) => <span className="tabular">{r.delayWeeks}</span>, value: (r) => r.delayWeeks },
    { key: "cost", header: "Cost band", render: (r) => r.costBand, value: (r) => r.costUsd, hide: "md" },
    { key: "lab", header: "Lab", render: (r) => r.lab, value: (r) => r.lab, hide: "lg" },
    { key: "match", header: `Matches ${active.version}`, align: "right", render: (r) => <span className="tabular">{matchCount(r.id) || ""}</span>, value: (r) => matchCount(r.id) },
  ];

  return (
    <>
      <PageHeader
        title="Test History"
        description="Thirty lab reports across five product families. This is the evidence the engine leans on when it raises a score or calls a fix proven."
        mark={<M mark={MARKS.history} size={44} />}
        info={
          <InfoPopover label="How history changes a score">
            Each report carries condition tags. A risk carries tags for its own conditions. Jaccard overlap of 0.8 or more with a failing
            report adds 10 to the score; 0.5 or more adds 6. A passing retest with 0.5 or more marks its recorded fix as proven for that risk.
          </InfoPopover>
        }
        actions={<DesignPicker />}
      >
        <FilterChips
          options={[
            { id: "all", label: "All results", count: LAB_REPORTS.length },
            { id: "fail", label: "Fail", count: fails.length },
            { id: "pass", label: "Pass", count: LAB_REPORTS.length - fails.length },
          ]}
          value={result}
          onChange={setResult}
        />
      </PageHeader>
      <PageBody>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiTile label="Reports" value={String(LAB_REPORTS.length)} hint="Nov 2024 to Sep 2026" />
            <KpiTile label="Failed first time" value={String(fails.length)} hint={`${Math.round((fails.length / LAB_REPORTS.length) * 100)}% of reports`} tone="error" />
            <KpiTile label="Schedule lost" value={`${fails.reduce((s, r) => s + r.delayWeeks, 0)} wk`} hint="sum of retest delays" tone="warning" mark={<M mark={MARKS.labWeeks} />} />
            <KpiTile label="Cost of failures" value={usdCompact(fails.reduce((s, r) => s + r.costUsd, 0))} hint="re-spin, retest, expedite" tone="warning" mark={<M mark={MARKS.respin} />} />
          </div>

          <SplitRow ratio="1/2" className="lg:h-[36rem]">
            <Panel title="Which mechanisms cost the most lab weeks" action={mechanism ? <button type="button" onClick={() => setMechanism(undefined)} className="text-caption text-tertiary hover:text-primary">Clear</button> : undefined}>
              <BarList rows={byMechanism} selectedId={mechanism} onSelect={(id) => setMechanism(mechanism === id ? undefined : id)} formatValue={(v) => `${v} wk`} />
              <Label className="mt-4 mb-1.5">Product family</Label>
              <FilterChips options={[{ id: "all", label: "All" }, ...FAMILIES.map((f) => ({ id: f, label: f, count: LAB_REPORTS.filter((r) => r.family === f).length }))]} value={family} onChange={setFamily} />
            </Panel>
            <Panel title={`Lab reports · ${rows.length}`} padded={false}>
              <DataTable
                rows={rows}
                columns={columns}
                rowKey={(r) => r.id}
                onRowClick={(r) => setOpenId(r.id)}
                isRowSelected={(r) => r.id === openId}
                defaultSort={{ key: "date", dir: "desc" }}
                searchPlaceholder="Search reports, causes, fixes"
                getSearchText={(r) => `${r.symptom} ${r.tags.join(" ")}`}
                exportName="tarang-lab-history"
                serial={false}
              />
            </Panel>
          </SplitRow>
        </div>
      </PageBody>

      <Drawer
        open={Boolean(open)}
        onClose={() => setOpenId(null)}
        title={open ? `${open.id} · ${open.product}` : ""}
        subtitle={open ? `${open.test} · ${open.standard} · ${dateShort(open.date)}` : undefined}
      >
        {open ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={open.result === "fail" ? "error" : "success"}>{open.result === "fail" ? "Fail" : "Pass"}</StatusBadge>
              <span className="text-body-sm tabular text-secondary">
                margin {open.marginDb > 0 ? "+" : ""}
                {open.marginDb} dB{open.failFreq ? ` at ${open.failFreq}` : ""}
              </span>
            </div>
            <div>
              <Label>Symptom</Label>
              <p className="mt-1 text-body-md text-secondary">{open.symptom}</p>
            </div>
            <div>
              <Label>Root cause</Label>
              <p className="mt-1 text-body-md text-primary">{open.rootCause}</p>
            </div>
            <div>
              <Label>Fix applied</Label>
              <p className="mt-1 text-body-md text-secondary">
                {open.fixApplied}
                {open.fixType ? <span className="ml-2 inline-flex align-middle"><StatusBadge tone="neutral">{open.fixType}</StatusBadge></span> : null}
              </p>
              {PROVEN_FIX[open.id] ? (
                <p className="mt-1 flex items-center gap-2 text-body-sm text-success">
                  <M mark={MARKS.proven} size={20} /> Proves the catalogue fix: {FIX_BY_ID[PROVEN_FIX[open.id]].detail}
                </p>
              ) : null}
            </div>
            <div className="rounded-md border border-muted bg-raised px-3 py-2">
              <KeyValue k="Lab" v={open.lab} />
              <KeyValue k="Delay" v={`${open.delayWeeks} weeks`} />
              <KeyValue k="Cost" v={`${usd(open.costUsd)} · ${open.costBand}`} />
              <KeyValue k="Condition tags" v={open.tags.join(" · ")} />
            </div>
            <div>
              <Label>
                What it means for {active.product} {active.version}
              </Label>
              {linked.length ? (
                <ul className="mt-1.5 flex flex-col gap-1.5">
                  {linked.map((risk) => {
                    const match = risk.matches.find((m) => m.reportId === open.id);
                    return (
                      <li key={risk.key}>
                        <Link
                          href={`/risks?risk=${encodeURIComponent(risk.key)}`}
                          className="flex items-start gap-2.5 rounded-md border border-muted px-2.5 py-2 transition-colors duration-[150ms] hover:bg-raised"
                        >
                          <span className="w-7 shrink-0 text-body-md tabular text-primary">{risk.score}</span>
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-1.5 text-body-sm text-primary">
                              #{risk.num} {risk.aggressor} → {risk.victim} <LevelBadge level={risk.level} />
                            </span>
                            <span className="block text-caption text-quaternary">
                              Tag overlap {match?.jaccard.toFixed(2)}.{" "}
                              {open.result === "fail"
                                ? `This failure adds ${(match?.jaccard ?? 0) >= 0.8 ? 10 : 6} to the score.`
                                : "This retest counts as proof for the matching fix."}
                            </span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-1 text-body-sm text-tertiary">No risk in the design in scope shares half of this report&apos;s condition tags.</p>
              )}
            </div>
          </div>
        ) : null}
      </Drawer>
    </>
  );
}

export default function TestHistoryPage() {
  return (
    <Suspense>
      <TestHistory />
    </Suspense>
  );
}
