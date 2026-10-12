"use client";

/**
 * Standards library and standards watch. Tighten a limit line or change a
 * requirement status, see which designs and risks move, then put the change
 * in force across every page or discard it.
 */

import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { PageBody, PageHeader } from "@/components/layout/page-header";
import { Button, Label, LevelBadge, M, SELECT_CLASS } from "@/components/tarang/ui";
import { FilterChips } from "@/components/ui/data-table";
import { InfoPopover } from "@/components/ui/info-popover";
import { Panel, Select, SplitRow, StatusBadge } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { MARKS } from "@/lib/marks";
import { MARKETS, MARKET_BY_ID, STANDARDS, STANDARD_BY_ID, TEMPLATE_BY_ID, TESTS, TEST_BY_ID } from "@/lib/tarang/catalog";
import { useTarang } from "@/lib/tarang/context";
import { analyze, conductedSpectrum, limitLineFor, statusFor } from "@/lib/tarang/engine";
import { STATUS_TONE } from "@/lib/tarang/format";
import { EMPTY_OVERRIDE, type LimitPoint, type MarketId, type ReqStatus, type StandardsOverride } from "@/lib/tarang/types";

const INPUT =
  "h-8 w-20 rounded-full border border-muted bg-action px-2 text-right text-label-sm tabular text-secondary outline-none focus-visible:border-default focus-visible:ring-2 focus-visible:ring-active";

const LOG_TICKS = [0.15, 0.5, 1, 5, 10, 30];

function StandardsLibrary() {
  const params = useSearchParams();
  const toast = useToast();
  const { designs, active, override, setOverride, overrideActive } = useTarang();
  const [market, setMarket] = useState("all");
  const [stdId, setStdId] = useState(STANDARD_BY_ID[params.get("std") ?? ""]?.id ?? "en55014-1");
  const [draft, setDraft] = useState<StandardsOverride>(override);
  const [flipTest, setFlipTest] = useState("ESD");
  const [flipMarket, setFlipMarket] = useState<MarketId>("US");
  const flipPublished = TEST_BY_ID[flipTest].markets[flipMarket]?.status;

  const std = STANDARD_BY_ID[stdId];
  const list = market === "all" ? STANDARDS : STANDARDS.filter((s) => s.market === market);
  const baseLine = std.limitLine;
  const draftLine = limitLineFor(std.id, draft);
  const delta = draft.limitDeltaDb[std.id] ?? 0;
  const dirty = draft !== override;

  const setDelta = (value: number) => setDraft((d) => ({ ...d, limitDeltaDb: { ...d.limitDeltaDb, [std.id]: value } }));
  const setPoint = (index: number, qp: number) =>
    setDraft((d) => {
      const line = (d.limitLines[std.id] ?? baseLine ?? []).map((p, i): LimitPoint => (i === index ? { ...p, qp } : p));
      return { ...d, limitLines: { ...d.limitLines, [std.id]: line } };
    });

  // Predicted spectrum of the design in scope against this standard's line.
  const spectrum = useMemo(() => {
    if (!draftLine) return [];
    const inlet = active.parts.find((p) => TEMPLATE_BY_ID[p.templateId].mainsPort);
    return active.parts.flatMap((part) =>
      conductedSpectrum(part, inlet, draftLine)
        .filter((h) => h.level > 20)
        .slice(0, 40)
        .map((h) => ({ f: h.fMHz, level: Math.round(h.level * 10) / 10, ref: part.ref, n: h.n, over: h.level - h.limit })),
    );
  }, [active, draftLine]);

  // One series on a shared log-frequency axis: both limit lines and the predicted harmonics.
  const chartData = useMemo(() => {
    const rows: { f: number; base?: number; limit?: number; level?: number; ref?: string; n?: number; over?: number }[] = [
      ...(baseLine ?? []).map((p, i) => ({ f: p.fMHz, base: p.qp, limit: draftLine?.[i]?.qp })),
      ...spectrum,
    ];
    return rows.sort((a, b) => a.f - b.f);
  }, [baseLine, draftLine, spectrum]);

  // Impact of the draft against the library as published.
  const impact = useMemo(() => {
    const out: { designId: string; name: string; before: number; after: number; moves: { key: string; num: number; label: string; mechanism: string; before: number; after: number; levelBefore?: string; levelAfter?: string }[] }[] = [];
    for (const design of designs) {
      const a = analyze(design, EMPTY_OVERRIDE);
      const b = analyze(design, draft);
      const keys = new Set([...a.risks.map((r) => r.key), ...b.risks.map((r) => r.key)]);
      const moves = [...keys]
        .map((key) => {
          const ra = a.risks.find((r) => r.key === key);
          const rb = b.risks.find((r) => r.key === key);
          const ref = (rb ?? ra)!;
          return { key, num: ref.num, label: `${ref.aggressor} → ${ref.victim}`, mechanism: ref.mechanism, before: ra?.score ?? 0, after: rb?.score ?? 0, levelBefore: ra?.level, levelAfter: rb?.level };
        })
        .filter((m) => m.before !== m.after);
      out.push({ designId: design.id, name: `${design.product} ${design.version}`, before: a.index, after: b.index, moves });
    }
    return out;
  }, [designs, draft]);
  const movedDesigns = impact.filter((i) => i.moves.length);
  const totalMoves = movedDesigns.reduce((s, i) => s + i.moves.length, 0);

  const flipCurrent = statusFor(flipTest, flipMarket, draft);

  return (
    <>
      <PageHeader
        title="Standards"
        description="Twenty standards across five markets, and a watch bench: change a limit or a requirement and see which designs move before the regulation does."
        mark={<M mark={MARKS.standards} size={44} />}
        info={
          <InfoPopover label="What a simulated change does">
            A draft stays on this page. Put in force applies it to every page: the register, the compliance matrix, lab readiness and the
            command center re-score from it until you reset. The published library is never edited.
          </InfoPopover>
        }
        actions={overrideActive ? <StatusBadge tone="warning">A simulated change is in force</StatusBadge> : undefined}
      >
        <FilterChips
          options={[{ id: "all", label: "All markets", count: STANDARDS.length }, ...MARKETS.map((m) => ({ id: m.id, label: m.id, count: STANDARDS.filter((s) => s.market === m.id).length }))]}
          value={market}
          onChange={setMarket}
        />
      </PageHeader>
      <PageBody>
        <div className="flex flex-col gap-4">
          <SplitRow ratio="1/2" className="lg:h-[40rem]">
            <Panel title={`Library · ${list.length}`} padded={false}>
              <ul className="min-h-0 flex-1 overflow-y-auto">
                {list.map((s) => (
                  <li key={s.id} className="border-b border-muted last:border-b-0">
                    <button
                      type="button"
                      onClick={() => setStdId(s.id)}
                      aria-pressed={s.id === stdId}
                      className={`flex w-full items-start gap-2.5 px-4 py-2.5 text-left outline-none transition-colors duration-[150ms] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-active ${s.id === stdId ? "bg-raised" : "hover:bg-raised"}`}
                    >
                      <span className="mt-0.5 w-7 shrink-0 text-caption tabular text-quaternary">{s.market}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body-md text-primary">{s.code}</span>
                        <span className="block truncate text-body-sm text-tertiary">{s.title}</span>
                      </span>
                      {s.watch ? <StatusBadge tone="warning">Watch</StatusBadge> : null}
                      {draft.limitDeltaDb[s.id] || draft.limitLines[s.id] ? <StatusBadge tone="info">Edited</StatusBadge> : null}
                    </button>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel title={`${std.code} · ${MARKET_BY_ID[std.market].label}`}>
              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-body-md text-primary">{std.title}</p>
                  <p className="mt-0.5 text-body-sm text-tertiary">
                    Edition {std.edition}. {std.scope}
                  </p>
                  {std.watch ? <p className="mt-1.5 rounded-md border border-warning-stroke bg-warning-surface px-3 py-2 text-body-sm text-warning">{std.watch}</p> : null}
                </div>

                <div>
                  <Label className="mb-1.5">Test requirements under this standard</Label>
                  <ul className="flex flex-col">
                    {std.testIds.map((id) => {
                      const status = statusFor(id, std.market, draft);
                      return (
                        <li key={id} className="flex items-start justify-between gap-3 border-b border-muted py-1.5 last:border-b-0">
                          <span className="min-w-0">
                            <span className="block text-body-sm text-secondary">{TEST_BY_ID[id].name}</span>
                            <span className="block text-caption text-quaternary">{TEST_BY_ID[id].method}</span>
                          </span>
                          {status ? <StatusBadge tone={STATUS_TONE[status]}>{status}</StatusBadge> : <StatusBadge tone="neutral">referenced</StatusBadge>}
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {baseLine && draftLine ? (
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Label>
                        Does {active.product} {active.version} clear the conducted limit
                      </Label>
                      <span className="text-caption text-quaternary">quasi-peak, dBµV vs MHz</span>
                    </div>
                    <div className="mt-1.5 h-60 w-full min-w-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData} margin={{ top: 6, right: 12, bottom: 0, left: -18 }}>
                          <CartesianGrid stroke="var(--stroke-muted)" />
                          <XAxis dataKey="f" type="number" scale="log" domain={[0.15, 30]} ticks={LOG_TICKS} tick={{ fill: "var(--text-quaternary)", fontSize: 11 }} axisLine={false} tickLine={false} />
                          <YAxis type="number" domain={[20, 90]} ticks={[20, 40, 60, 80]} tick={{ fill: "var(--text-quaternary)", fontSize: 11 }} axisLine={false} tickLine={false} />
                          <Tooltip
                            cursor={false}
                            content={({ active: on, payload }) => {
                              const p = payload?.find((x) => x.payload?.ref)?.payload;
                              return on && p ? (
                                <div className="rounded-lg border border-muted bg-container px-2.5 py-1.5">
                                  <p className="text-body-sm text-primary">
                                    {p.ref} harmonic {p.n} at {Number(p.f).toFixed(3)} MHz
                                  </p>
                                  <p className="text-caption tabular text-tertiary">
                                    {p.level} dBµV, {p.over >= 0 ? `${p.over.toFixed(1)} dB over` : `${(-p.over).toFixed(1)} dB under`}
                                  </p>
                                </div>
                              ) : null;
                            }}
                          />
                          <Line dataKey="base" type="linear" connectNulls stroke="var(--text-quaternary)" strokeDasharray="5 4" strokeWidth={1.5} dot={false} activeDot={false} isAnimationActive={false} />
                          <Line dataKey="limit" type="linear" connectNulls stroke="var(--feedback-error-icon)" strokeWidth={2} dot={false} activeDot={false} isAnimationActive={false} />
                          <Line dataKey="level" stroke="none" dot={{ r: 2.5, fill: "var(--analytics-series-1)", strokeWidth: 0 }} activeDot={{ r: 4 }} isAnimationActive={false} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-quaternary">
                      <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 bg-error" /> Limit in this draft</span>
                      <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 bg-quaternary" /> Published limit</span>
                      <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-info" /> Predicted harmonics</span>
                    </p>

                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-md border border-muted p-3">
                        <Label>Tighten the whole line</Label>
                        <div className="mt-2 flex items-center gap-3">
                          <input aria-label="Tighten by dB" type="range" min={0} max={10} step={1} value={delta} onChange={(e) => setDelta(Number(e.target.value))} className="min-w-0 flex-1 accent-[var(--action-primary-default)]" />
                          <span className="w-14 shrink-0 text-right font-display text-display-base tabular text-primary">−{delta} dB</span>
                        </div>
                      </div>
                      <div className="rounded-md border border-muted p-3">
                        <Label>Edit breakpoints, dBµV</Label>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(draft.limitLines[std.id] ?? baseLine).map((p, i) => (
                            <label key={i} className="flex items-center gap-1.5">
                              <span className="text-caption tabular text-quaternary">{p.fMHz >= 5 && p.fMHz < 5.01 ? "5+" : p.fMHz}</span>
                              <input aria-label={`Limit at ${p.fMHz} MHz`} type="number" value={p.qp} onChange={(e) => setPoint(i, Number(e.target.value) || 0)} className={INPUT} />
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-body-sm text-tertiary">This standard carries no conducted-emission limit line. Its requirement status can still be changed in the watch bench below.</p>
                )}
              </div>
            </Panel>
          </SplitRow>

          <Panel title="Standards watch: simulate a change" action={<M mark={MARKS.standardsWatch} size={24} />} className="h-auto">
            <div className="flex flex-col gap-4 lg:flex-row">
              <div className="min-w-0 lg:w-80 lg:shrink-0">
                <Label className="mb-1.5">Change a requirement status</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Select aria-label="Test" value={flipTest} onChange={(e) => setFlipTest(e.target.value)} className={SELECT_CLASS}>
                    {TESTS.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.short}
                      </option>
                    ))}
                  </Select>
                  <Select aria-label="Market" value={flipMarket} onChange={(e) => setFlipMarket(e.target.value as MarketId)} className={SELECT_CLASS}>
                    {MARKETS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.id}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(["mandatory", "verify", "voluntary"] as ReqStatus[]).map((st) => (
                    <button
                      key={st}
                      type="button"
                      aria-pressed={flipCurrent === st}
                      onClick={() => setDraft((d) => ({ ...d, status: { ...d.status, [`${flipTest}:${flipMarket}`]: st } }))}
                      className={`inline-flex h-8 items-center rounded-full border px-3 text-label-sm outline-none transition-colors duration-[150ms] focus-visible:ring-2 focus-visible:ring-active ${flipCurrent === st ? "border-transparent bg-action-primary text-on-color" : "border-muted bg-action text-tertiary hover:border-default hover:text-primary"}`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-caption text-quaternary">
                  {TEST_BY_ID[flipTest].short} in {flipMarket} is {flipPublished ?? "not required"} as published. Raising it to mandatory turns
                  functional risks on that test into regulatory ones at full weight.
                </p>
                <div className="mt-3 flex flex-wrap gap-2 border-t border-muted pt-3">
                  <Button
                    variant="primary"
                    disabled={!dirty}
                    onClick={() => {
                      setOverride(draft);
                      toast(`Simulated change in force: ${totalMoves} risks moved across ${movedDesigns.length} designs`);
                    }}
                  >
                    Put in force on all pages
                  </Button>
                  <Button
                    disabled={!overrideActive && draft === EMPTY_OVERRIDE}
                    onClick={() => {
                      setDraft(EMPTY_OVERRIDE);
                      setOverride(EMPTY_OVERRIDE);
                      toast("Standards reset to the published library", "info");
                    }}
                  >
                    Reset to published
                  </Button>
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <Label className="mb-1.5">
                  What moves against the published library · {totalMoves} risks in {movedDesigns.length} designs
                </Label>
                {movedDesigns.length ? (
                  <ul className="flex flex-col gap-2">
                    {movedDesigns.map((d) => (
                      <li key={d.designId} className="rounded-md border border-muted bg-page p-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="text-body-md text-primary">{d.name}</span>
                          <span className="text-body-sm tabular text-secondary">
                            index {d.before} to <span className={d.after > d.before ? "text-error" : "text-success"}>{d.after}</span>
                          </span>
                        </div>
                        <ul className="mt-1.5 flex flex-col">
                          {d.moves.map((m) => (
                            <li key={m.key} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 py-0.5">
                              <span className="w-8 shrink-0 text-body-sm tabular text-quaternary">#{m.num}</span>
                              <span className="min-w-0 flex-1 truncate text-body-sm text-secondary">
                                {m.label} · {m.mechanism}
                              </span>
                              <span className="shrink-0 text-body-sm tabular text-secondary">
                                {m.before} to <span className={m.after > m.before ? "text-error" : "text-success"}>{m.after}</span>
                              </span>
                              {m.levelBefore !== m.levelAfter ? <LevelBadge level={m.levelAfter as "High" | "Medium" | "Low" | undefined} /> : null}
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-md border border-muted bg-raised px-3 py-2.5 text-body-sm text-tertiary">
                    Nothing moves yet. Tighten the conducted limit of EN IEC 55014-1 by 6 dB, or make ESD immunity mandatory in the US, and the
                    affected designs and risks list here.
                  </p>
                )}
              </div>
            </div>
          </Panel>
        </div>
      </PageBody>
    </>
  );
}

export default function StandardsPage() {
  return (
    <Suspense>
      <StandardsLibrary />
    </Suspense>
  );
}
