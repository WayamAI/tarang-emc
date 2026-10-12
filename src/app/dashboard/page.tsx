"use client";

/**
 * Command Center.
 *
 * The EMC lead's view of the portfolio: which programmes will fail the lab as
 * they stand, which interference paths are behind it, what the fixes already
 * made have saved, and what to decide today. Every figure is computed from the
 * same designs the workspace edits.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { PageBody, PageHeader } from "@/components/layout/page-header";
import { RiskDrawer } from "@/components/tarang/risk-drawer";
import { Button, Confidence, Label, LevelBadge, LinkButton, M, ScoreBar } from "@/components/tarang/ui";
import { DataTable, type Column } from "@/components/ui/data-table";
import { InlineArrow, KpiTile, Panel, SplitRow, StatusBadge } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { MARKS, type MarkDef } from "@/lib/marks";
import { CATEGORY_LABEL, TEST_BY_ID } from "@/lib/tarang/catalog";
import { useTarang } from "@/lib/tarang/context";
import { parseFixInstance } from "@/lib/tarang/fixes";
import { dateShort, daysBetween, pct, TODAY, TONE_TEXT, toneForIndex, usdCompact } from "@/lib/tarang/format";
import { PROVEN_FIX, REPORT_BY_ID } from "@/lib/tarang/history";
import { recommendationsFor } from "@/lib/tarang/planner";
import { avoidedThisYear, BOOKINGS, latestDesign, PEOPLE, PROGRAMS, PROGRAM_BY_ID, type Program } from "@/lib/tarang/portfolio";
import { firstPassByMarket, passProbability } from "@/lib/tarang/selectors";
import type { Analysis, Category, Design, Risk } from "@/lib/tarang/types";

type FlowCol = "source" | "path" | "victim" | "test";
interface QueueRow {
  id: string;
  program: Program;
  design: Design;
  risk: Risk;
  source: string;
  path: string;
  victim: string;
  test: string;
}

const catLabel = (c: Risk["aggressorCat"]) => (c === "external" ? "Outside the cabinet" : c === "panel" ? "Cabinet panel" : CATEGORY_LABEL[c as Category]);

const FLOW: { col: FlowCol; title: string; mark: MarkDef }[] = [
  { col: "source", title: "Source", mark: MARKS.source },
  { col: "path", title: "Coupling path", mark: MARKS.path },
  { col: "victim", title: "Victim", mark: MARKS.victim },
  { col: "test", title: "Test at risk", mark: MARKS.test },
];

const SERIES = ["var(--analytics-series-1)", "var(--analytics-series-2)", "var(--analytics-series-3)", "var(--analytics-series-4)"];
const WEEKS = ["W36", "W37", "W38", "W39", "W40", "W41", "Now"];

interface Observation {
  id: string;
  observation: string;
  cause: string;
  evidence: { label: string; detail: string }[];
  confidence: number;
  impact: string;
  recommendation: string;
  signer: string;
  href: string;
  action: string;
}

function Spark({ values }: { values: number[] }) {
  const w = 64;
  const h = 18;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h - (v / 100) * h).toFixed(1)}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="shrink-0 text-tertiary">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

export default function CommandCenterPage() {
  const router = useRouter();
  const toast = useToast();
  const { designs, analysisOf, override, whatIfOf, setActiveId, statuses, setStatus } = useTarang();
  const [flow, setFlow] = useState<{ col: FlowCol; id: string } | null>(null);
  const [openRisk, setOpenRisk] = useState<{ designId: string; key: string } | null>(null);

  const portfolio = useMemo(
    () =>
      PROGRAMS.map((program) => {
        const design = latestDesign(designs, program.id) as Design;
        const analysis = analysisOf(design.id);
        return { program, design, analysis, firstPass: firstPassByMarket(design, analysis, override), trend: [...program.trend, analysis.index] };
      }),
    [designs, analysisOf, override],
  );

  const queue = useMemo<QueueRow[]>(
    () =>
      portfolio.flatMap(({ program, design, analysis }) =>
        analysis.risks.map((risk) => ({
          id: `${design.id}:${risk.key}`, program, design, risk,
          source: catLabel(risk.aggressorCat), path: risk.path, victim: catLabel(risk.victimCat),
          test: risk.testIds.length ? TEST_BY_ID[risk.testIds[0]].short : "Functional only",
        })),
      ),
    [portfolio],
  );
  const filtered = flow ? queue.filter((row) => row[flow.col] === flow.id) : queue;

  const avoided = useMemo(() => avoidedThisYear(designs, analysisOf), [designs, analysisOf]);
  const highs = queue.filter((r) => r.risk.level === "High");
  const atRisk = portfolio.filter((p) => p.analysis.index >= 60).length;
  const passValues = portfolio.flatMap((p) => Object.values(p.firstPass));
  const meanPass = passValues.reduce((s, v) => s + v, 0) / Math.max(1, passValues.length);

  // Fixes already folded into a latest version, or sitting in a tray, with no proving retest.
  const unproven = useMemo(() => {
    const proven = new Set(Object.values(PROVEN_FIX));
    return portfolio.flatMap(({ program, design }) =>
      [...design.appliedFixes.map((i) => ({ i, where: "folded in" })), ...whatIfOf(design.id).map((i) => ({ i, where: "in what-if" }))]
        .map(({ i, where }) => ({ parsed: parseFixInstance(i), where, instance: i }))
        .filter((x) => x.parsed && !proven.has(x.parsed.fix.id))
        .map((x) => ({ id: `${design.id}:${x.instance}`, program, design, where: x.where, title: x.parsed!.fix.title(x.parsed!.target, design), type: x.parsed!.fix.type })),
    );
  }, [portfolio, whatIfOf]);

  const bookings = useMemo(
    () =>
      [...BOOKINGS]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((booking) => {
          const entry = portfolio.find((p) => p.program.id === booking.programId);
          const analysis = entry?.analysis as Analysis;
          const p = booking.testIds.reduce((acc, id) => acc * passProbability(analysis.risks.filter((r) => r.testIds.includes(id))), 1);
          const blockers = analysis.risks.filter((r) => r.level === "High" && r.testIds.some((id) => booking.testIds.includes(id)));
          return { booking, entry, p, blockers };
        }),
    [portfolio],
  );

  const observations = useMemo<Observation[]>(() => {
    const out: Observation[] = [];
    const flagged = new Set<string>();
    for (const { booking, entry, p, blockers } of bookings) {
      // One observation per programme: its earliest slot with a High on a booked test.
      if (!entry || !blockers.length || flagged.has(entry.program.id)) continue;
      flagged.add(entry.program.id);
      out.push({
        id: `obs-booking-${booking.id}`,
        observation: `${booking.id} books ${entry.program.name} into the chamber on ${dateShort(booking.date)} with ${blockers.length} High risk${blockers.length > 1 ? "s" : ""} on the booked tests.`,
        cause: blockers.map((r) => `#${r.num} ${r.aggressor} → ${r.victim}: ${r.coupling}`).join("; "),
        evidence: [
          { label: "Predicted first-pass for the slot", detail: pct(p) },
          { label: "Free cancellation ends", detail: `${dateShort(booking.cancelBy)}, in ${daysBetween(TODAY, booking.cancelBy)} days` },
          ...blockers.filter((r) => r.historyAdj).slice(0, 1).map((r) => ({ label: "Same conditions failed before", detail: r.matches.filter((m) => m.result === "fail").map((m) => m.reportId).join(", ") })),
        ],
        confidence: 0.82,
        impact: usdCompact(booking.costUsd * (1 - p)),
        recommendation: `Apply the top fixes and re-run before ${dateShort(booking.cancelBy)}, or move the slot.`,
        signer: PEOPLE.lead.name,
        href: "/lab-readiness",
        action: "Open lab readiness",
      });
    }
    const repeat = queue.filter((r) => r.risk.historyAdj >= 10).sort((a, b) => b.risk.score - a.risk.score)[0];
    if (repeat) {
      const report = REPORT_BY_ID[repeat.risk.matches.find((m) => m.result === "fail")?.reportId ?? ""];
      const top = recommendationsFor(repeat.design, analysisOf(repeat.design.id), repeat.risk, override)[0];
      out.push({
        id: `obs-repeat-${repeat.id}`,
        observation: `${repeat.program.name} ${repeat.design.version} repeats the conditions of ${report?.id}: ${repeat.risk.aggressor} → ${repeat.risk.victim}, ${repeat.risk.coupling}.`,
        cause: report ? `${report.product}: ${report.rootCause}. It cost ${report.delayWeeks} weeks.` : "A past failure shares at least 80 % of this risk's condition tags.",
        evidence: [
          { label: "Tag overlap", detail: `Jaccard ${repeat.risk.matches[0]?.jaccard.toFixed(2)} with ${report?.id}` },
          { label: "Score", detail: `${repeat.risk.score}, of which +${repeat.risk.historyAdj} from history` },
          ...(top ? [{ label: "Top fix", detail: `${top.title}, to ${top.after}${top.provenBy ? `, proven by ${top.provenBy.id}` : ", unproven"}` }] : []),
        ],
        confidence: 0.88,
        impact: report ? `${report.delayWeeks} wk` : "4 wk",
        recommendation: top ? `${top.title}. ${top.provenBy ? "The same change passed retest." : "Confirm with a pre-scan."}` : "Raise at the design review.",
        signer: repeat.program.engineer,
        href: `/fixes?risk=${encodeURIComponent(repeat.risk.key)}`,
        action: "Open in Fix Planner",
      });
    }
    const cn = portfolio.find((p) => p.design.markets.includes("CN"));
    if (cn) {
      out.push({
        id: "obs-standards-gb4343",
        observation: `GB 4343.1 moves to its 2024 edition for CCC certificates renewed after August 2026. ${cn.program.name} ships to China.`,
        cause: "The new edition aligns with CISPR 14-1 Ed. 7. Conducted limits are unchanged, but a tighter line is under discussion for induction and inverter loads.",
        evidence: [
          { label: "Current margin", detail: `${cn.program.name} ${cn.design.version} has no conducted-emission risk listed` },
          { label: "Library entry", detail: "Standards, GB 4343.1, watch note" },
        ],
        confidence: 0.61,
        impact: "Watch",
        recommendation: "Run a 3 dB tightening in the standards watch and check that no CleanWave or AquaLine version moves.",
        signer: PEOPLE.lead.name,
        href: "/libraries/standards?std=gb4343-1",
        action: "Open standards watch",
      });
    }
    if (unproven.length) {
      out.push({
        id: `obs-unproven-${unproven.length}`,
        observation: `${unproven.length} fixes rest on the rule model alone: no passing retest in the lab history covers them.`,
        cause: `Largest group: ${unproven[0].program.name} ${unproven[0].design.version}, ${unproven.filter((u) => u.design.id === unproven[0].design.id).length} fixes.`,
        evidence: unproven.slice(0, 3).map((u) => ({ label: u.type, detail: u.title })),
        confidence: 0.74,
        impact: `${unproven.length} fixes`,
        recommendation: "Book a half-day in the pre-scan cell: LISN sweep, near-field probe around the radio, thermocouple on the SMPS.",
        signer: PEOPLE.lab.name,
        href: "/fixes",
        action: "Open Fix Planner",
      });
    }
    return out;
  }, [bookings, queue, portfolio, unproven, analysisOf, override]);
  const visibleObs = observations.filter((o) => statuses[o.id] !== "dismissed");

  const trendData = WEEKS.map((week, i) => {
    const row: Record<string, string | number> = { week };
    for (const p of portfolio) row[p.program.id] = p.trend[i];
    return row;
  });

  const queueColumns: Column<QueueRow>[] = [
    { key: "program", header: "Programme", render: (r) => <span className="text-primary">{r.program.name} {r.design.version}</span>, value: (r) => r.program.name },
    { key: "path", header: "Aggressor → victim", render: (r) => <span className="tabular">#{r.risk.num} {r.risk.aggressor} → {r.risk.victim}</span>, value: (r) => `${r.risk.aggressor} ${r.risk.victim}` },
    { key: "mechanism", header: "Mechanism", render: (r) => r.risk.mechanism, value: (r) => r.risk.mechanism },
    { key: "score", header: "Score", align: "right", card: "metric", render: (r) => <ScoreBar score={r.risk.score} level={r.risk.level} width="w-10" />, value: (r) => r.risk.score },
    { key: "level", header: "Level", render: (r) => <LevelBadge level={r.risk.level} />, value: (r) => r.risk.level, hide: "md" },
    { key: "test", header: "Test at risk", render: (r) => r.test, value: (r) => r.test, hide: "md" },
  ];

  const programColumns: Column<(typeof portfolio)[number]>[] = [
    { key: "name", header: "Programme", render: (p) => <span className="text-primary">{p.program.name}</span>, value: (p) => p.program.name },
    { key: "version", header: "Latest", render: (p) => `${p.design.version} · ${p.design.note}`, value: (p) => p.design.version },
    {
      key: "index", header: "Risk index", align: "right", card: "metric",
      render: (p) => (
        <span className="inline-flex items-center gap-2">
          <Spark values={p.trend} />
          <span className={`w-7 text-right tabular ${TONE_TEXT[toneForIndex(p.analysis.index)]}`}>{p.analysis.index}</span>
        </span>
      ),
      value: (p) => p.analysis.index,
    },
    {
      key: "trend", header: "6 wk", align: "right",
      render: (p) => {
        const d = p.analysis.index - p.trend[0];
        return <span className={`tabular ${d < 0 ? "text-success" : d > 0 ? "text-error" : "text-quaternary"}`}>{d > 0 ? "+" : ""}{d}</span>;
      },
      value: (p) => p.analysis.index - p.trend[0],
    },
    { key: "high", header: "High", align: "right", render: (p) => <span className="tabular">{p.analysis.counts.High}</span>, value: (p) => p.analysis.counts.High },
    {
      key: "pass", header: "Predicted first-pass by market",
      render: (p) => (
        <span className="inline-flex flex-wrap gap-1">
          {Object.entries(p.firstPass).map(([m, v]) => (
            <StatusBadge key={m} tone={v >= 0.7 ? "success" : v >= 0.4 ? "warning" : "error"}>
              {m} {pct(v)}
            </StatusBadge>
          ))}
        </span>
      ),
      value: (p) => Math.min(...Object.values(p.firstPass)),
    },
    { key: "gate", header: "Next gate", render: (p) => `${p.program.gate}, ${dateShort(p.program.gateDate)}`, value: (p) => p.program.gateDate, hide: "md" },
    { key: "eng", header: "EMC engineer", render: (p) => p.program.engineer, value: (p) => p.program.engineer, hide: "lg" },
  ];

  return (
    <>
      <PageHeader
        title="Command Center"
        description="Which programmes would fail the chamber as they stand, which interference paths are behind it, and what to decide today."
        mark={<M mark={MARKS.command} size={44} />}
        actions={
          flow ? (
            <Button onClick={() => setFlow(null)}>
              Scoped to {flow.id} · clear
            </Button>
          ) : (
            <LinkButton href="/fixes" variant="primary">
              Plan fixes
            </LinkButton>
          )
        }
      />
      <PageBody>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 @6xl:grid-cols-6">
            <Link href="/designs" className="min-w-0">
              <KpiTile label="Programmes at risk" value={`${atRisk} / ${portfolio.length}`} hint="latest index 60 or above" tone={atRisk ? "error" : "success"} mark={<M mark={MARKS.riskIndex} />} />
            </Link>
            <Link href="/risks" className="min-w-0">
              <KpiTile label="Open High risks" value={String(highs.length)} hint="across latest versions" tone={highs.length ? "error" : "success"} mark={<M mark={MARKS.highRisk} />} />
            </Link>
            <Link href="/lab-readiness" className="min-w-0">
              <KpiTile label="Predicted first-pass" value={pct(meanPass)} hint="mean over programme and market" tone="info" mark={<M mark={MARKS.firstPass} />} />
            </Link>
            <Link href="/compare" className="min-w-0">
              <KpiTile label="Lab weeks avoided" value={`${Math.round(avoided.weeks)} wk`} hint={`${avoided.resolved.length} Highs cleared at layout, 2026`} tone="success" mark={<M mark={MARKS.labWeeks} />} />
            </Link>
            <Link href="/test-history" className="min-w-0">
              <KpiTile label="Re-spin cost avoided" value={usdCompact(avoided.usd)} hint="priced from past failures" tone="success" mark={<M mark={MARKS.respin} />} />
            </Link>
            <Link href="/fixes" className="min-w-0">
              <KpiTile label="Unproven fixes" value={String(unproven.length)} hint="no passing retest yet" tone={unproven.length ? "warning" : "success"} mark={<M mark={MARKS.unproven} />} />
            </Link>
          </div>

          <Panel title="Interference paths" padded={false} action={<span className="text-caption text-quaternary">Select a node to scope the queue below</span>} className="h-auto">
            <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
              {FLOW.map(({ col, title, mark }, ci) => {
                const groups = new Map<string, { count: number; worst: number; live: number }>();
                for (const row of queue) {
                  const g = groups.get(row[col]) ?? { count: 0, worst: 0, live: 0 };
                  g.count += 1;
                  g.worst = Math.max(g.worst, row.risk.score);
                  if (filtered.includes(row)) g.live += 1;
                  groups.set(row[col], g);
                }
                const nodes = [...groups.entries()].sort((a, b) => b[1].worst - a[1].worst);
                return (
                  <div key={col} className="min-w-0">
                    <p className="mb-2 flex items-center gap-2 text-caption tracking-[0.08em] text-quaternary uppercase">
                      <M mark={mark} size={24} />
                      {title}
                      {ci < FLOW.length - 1 ? <InlineArrow className="ml-auto hidden xl:inline-block" /> : null}
                    </p>
                    <ul className="flex flex-col gap-1.5">
                      {nodes.map(([id, g]) => {
                        const selected = flow?.col === col && flow.id === id;
                        const dimmed = Boolean(flow) && !selected && g.live === 0;
                        return (
                          <li key={id}>
                            <button
                              type="button"
                              aria-pressed={selected}
                              onClick={() => setFlow(selected ? null : { col, id })}
                              className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left outline-none transition-[background-color,border-color,opacity] duration-[180ms] focus-visible:ring-2 focus-visible:ring-active ${selected ? "border-default bg-raised" : "border-muted bg-page hover:border-default hover:bg-raised"} ${dimmed ? "opacity-40" : ""}`}
                            >
                              <span className="min-w-0 flex-1 truncate text-body-sm text-secondary">{id}</span>
                              <span className="shrink-0 text-caption tabular text-quaternary">{flow && !selected ? `${g.live}/${g.count}` : g.count}</span>
                              <span className={`w-7 shrink-0 text-right font-display text-display-base tabular ${g.worst >= 60 ? "text-error" : g.worst >= 30 ? "text-warning" : "text-info"}`}>{g.worst}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
            <p className="border-t border-muted px-4 py-2 text-caption text-quaternary">Count of risks through each node and the worst score on it, over the latest version of every programme.</p>
          </Panel>

          <SplitRow className="lg:h-[34rem] lg:max-h-[34rem]">
            <Panel title={`Risk queue · ${filtered.length}`} padded={false} action={<span className="text-caption text-quaternary">ranked by score</span>}>
              <DataTable
                rows={filtered}
                columns={queueColumns}
                rowKey={(r) => r.id}
                onRowClick={(r) => {
                  setActiveId(r.design.id);
                  setOpenRisk({ designId: r.design.id, key: r.risk.key });
                }}
                isRowSelected={(r) => openRisk?.designId === r.design.id && openRisk.key === r.risk.key}
                defaultSort={{ key: "score", dir: "desc" }}
                pageSize={25}
                searchPlaceholder="Search the queue"
                exportName="tarang-risk-queue"
                reorderable={false}
                serial={false}
              />
            </Panel>

            <Panel title={`Agent observations · ${visibleObs.length}`} padded={false}>
              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
                {visibleObs.map((obs) => (
                  <article key={obs.id} className="flex flex-col gap-3 rounded-lg border border-muted bg-container p-4">
                    <div className="flex items-start gap-3">
                      <M mark={MARKS.observation} size={32} className="mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <Label>Observation</Label>
                        <p className="mt-1 text-body-md text-primary">{obs.observation}</p>
                      </div>
                    </div>
                    <div>
                      <Label>Primary cause</Label>
                      <p className="mt-1 text-body-sm text-secondary">{obs.cause}</p>
                    </div>
                    <div>
                      <Label>Evidence</Label>
                      <ul className="mt-1 flex flex-col gap-1">
                        {obs.evidence.map((e) => (
                          <li key={e.label} className="text-body-sm text-secondary">
                            <span className="text-primary">{e.label}</span>
                            <span className="text-quaternary"> · </span>
                            <span className="text-tertiary">{e.detail}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="flex flex-wrap items-end justify-between gap-4">
                      <Confidence value={obs.confidence} />
                      <div className="text-right">
                        <Label>At stake</Label>
                        <p className="font-display text-display-lg tabular text-warning">{obs.impact}</p>
                      </div>
                    </div>
                    <div className="rounded-md border border-muted bg-raised px-3 py-2">
                      <Label>Recommendation</Label>
                      <p className="mt-1 text-body-sm text-secondary">{obs.recommendation}</p>
                      <p className="mt-1 text-caption text-quaternary">{obs.signer} signs off before anything changes.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <LinkButton href={obs.href} variant="primary">
                        {obs.action}
                      </LinkButton>
                      <Button
                        onClick={() => {
                          setStatus(obs.id, "review task created");
                          toast(`Review task created for ${obs.signer}`);
                        }}
                      >
                        Create review task
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setStatus(obs.id, "dismissed");
                          toast("Observation dismissed", "info");
                        }}
                      >
                        Dismiss
                      </Button>
                    </div>
                    {statuses[obs.id] ? (
                      <p className="inline-flex items-center gap-1 text-caption text-success">
                        Status <InlineArrow /> {statuses[obs.id]}
                      </p>
                    ) : null}
                  </article>
                ))}
                {!visibleObs.length ? <p className="p-3 text-body-md text-tertiary">Nothing needs a decision right now.</p> : null}
              </div>
            </Panel>
          </SplitRow>

          <Panel title={`Programmes · ${portfolio.length}`} padded={false} className="h-auto">
            <DataTable
              rows={portfolio}
              columns={programColumns}
              rowKey={(p) => p.program.id}
              onRowClick={(p) => {
                setActiveId(p.design.id);
                router.push("/risks");
              }}
              searchable={false}
              exportable={false}
              reorderable={false}
              pageSize={0}
              serial={false}
            />
          </Panel>

          <SplitRow>
            <Panel title="Is each programme converging before its lab date">
              <div className="h-56 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 6, right: 12, bottom: 0, left: -22 }}>
                    <CartesianGrid stroke="var(--stroke-muted)" vertical={false} />
                    <XAxis dataKey="week" tick={{ fill: "var(--text-quaternary)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} ticks={[0, 30, 60, 100]} tick={{ fill: "var(--text-quaternary)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <ReferenceLine y={60} stroke="var(--feedback-error-icon)" strokeDasharray="4 4" />
                    <Tooltip
                      cursor={{ stroke: "var(--stroke-default)" }}
                      content={({ active: on, payload, label }) =>
                        on && payload?.length ? (
                          <div className="rounded-lg border border-muted bg-container px-2.5 py-1.5">
                            <p className="text-caption text-quaternary">{label}</p>
                            {payload.map((entry) => (
                              <p key={String(entry.dataKey)} className="text-body-sm tabular text-secondary">
                                {PROGRAM_BY_ID[String(entry.dataKey)]?.name} · {entry.value}
                              </p>
                            ))}
                          </div>
                        ) : null
                      }
                    />
                    {portfolio.map((p, i) => (
                      <Line key={p.program.id} dataKey={p.program.id} type="monotone" stroke={SERIES[i % SERIES.length]} strokeWidth={2} dot={false} isAnimationActive={false} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-quaternary">
                {portfolio.map((p, i) => (
                  <span key={p.program.id} className="inline-flex items-center gap-1.5">
                    <span className="h-0.5 w-4" style={{ background: SERIES[i % SERIES.length] }} /> {p.program.name}
                  </span>
                ))}
                <span>Dashed line: index 60, the lab-entry bar.</span>
              </p>
            </Panel>

            <Panel title={`Chamber bookings · ${bookings.length}`} action={<M mark={MARKS.booking} size={24} />} padded={false}>
              <ul className="min-h-0 flex-1 overflow-y-auto">
                {bookings.map(({ booking, entry, p, blockers }) => (
                  <li key={booking.id} className="border-b border-muted last:border-b-0">
                    <button
                      type="button"
                      onClick={() => {
                        if (entry) setActiveId(entry.design.id);
                        router.push("/lab-readiness");
                      }}
                      className="flex w-full items-start gap-3 px-4 py-2.5 text-left outline-none transition-colors duration-[150ms] hover:bg-raised focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-active"
                    >
                      <span className="w-16 shrink-0">
                        <span className="block text-body-sm tabular text-primary">{dateShort(booking.date).replace(" 2026", "")}</span>
                        <span className="block text-caption tabular text-quaternary">{booking.days} d</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body-sm text-secondary">
                          {booking.id} · {entry?.program.name} {entry?.design.version}
                        </span>
                        <span className="block truncate text-caption text-quaternary">
                          {booking.lab} · {booking.testIds.length} tests · {usdCompact(booking.costUsd)}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-0.5">
                        <StatusBadge tone={blockers.length ? "error" : p >= 0.5 ? "success" : "warning"}>{blockers.length ? "No-go" : p >= 0.5 ? "Go" : "Pre-scan"}</StatusBadge>
                        <span className="text-caption tabular text-quaternary">first-pass {pct(p)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Panel>
          </SplitRow>

          <Panel title={`Fixes still unproven · ${unproven.length}`} action={<M mark={MARKS.unproven} size={24} />} className="h-auto">
            {unproven.length ? (
              <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                {unproven.map((u) => (
                  <li key={u.id} className="flex items-start gap-3 rounded-md border border-muted bg-page px-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block text-body-sm text-secondary">{u.title}</span>
                      <span className="block text-caption text-quaternary">
                        {u.program.name} {u.design.version} · {u.type} · {u.where}
                      </span>
                    </span>
                    {statuses[u.id] ? (
                      <StatusBadge tone="info">{statuses[u.id]}</StatusBadge>
                    ) : (
                      <Button
                        onClick={() => {
                          setStatus(u.id, "Pre-scan booked");
                          toast(`Pre-scan requested from ${PEOPLE.lab.name} for: ${u.title}`);
                        }}
                      >
                        Book pre-scan
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-body-md text-tertiary">Every fix in a latest version or a what-if tray has a passing retest behind it.</p>
            )}
          </Panel>
        </div>
      </PageBody>
      <RiskDrawer designId={openRisk?.designId ?? designs[0].id} riskKey={openRisk?.key ?? null} onClose={() => setOpenRisk(null)} />
    </>
  );
}
