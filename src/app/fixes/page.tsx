"use client";

/**
 * Fix Planner: ranked fixes per risk, each one measured by re-running the
 * engine, a what-if tray that walks the index down, and save-as-version.
 */

import { ChevronDown, ChevronRight, Save, Sparkles, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { PageBody, PageHeader } from "@/components/layout/page-header";
import { RecommendationRow } from "@/components/tarang/risk-drawer";
import { Button, DesignPicker, Figure, Label, LevelBadge, LinkButton, M, ScoreBar } from "@/components/tarang/ui";
import { FilterChips } from "@/components/ui/data-table";
import { InfoPopover } from "@/components/ui/info-popover";
import { EmptyState, Panel, StatusBadge } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { MARKS } from "@/lib/marks";
import { analyzeCached, useTarang } from "@/lib/tarang/context";
import { applyFixes, FIX_TYPES, parseFixInstance } from "@/lib/tarang/fixes";
import { TONE_TEXT, toneForIndex, usd } from "@/lib/tarang/format";
import { PROVEN_FIX } from "@/lib/tarang/history";
import { ENGINEER_RATE_USD, planFor } from "@/lib/tarang/planner";
import type { Design } from "@/lib/tarang/types";

function FixPlanner() {
  const params = useSearchParams();
  const toast = useToast();
  const { active, analysisOf, plannedOf, whatIf, toggleWhatIf, clearWhatIf, saveWhatIf, override } = useTarang();
  const analysis = analysisOf(active.id);
  const planned = plannedOf(active.id);
  const [type, setType] = useState("all");
  const [open, setOpen] = useState<string | null>(params.get("risk") ?? analysis.risks[0]?.key ?? null);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState<{ base: Design; created: Design } | null>(null);

  const plan = useMemo(() => planFor(active, analysis, override), [active, analysis, override]);
  const provenIds = useMemo(() => new Set(Object.values(PROVEN_FIX)), []);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const { recs } of plan) for (const rec of recs) counts[rec.fix.type] = (counts[rec.fix.type] ?? 0) + 1;
    return counts;
  }, [plan]);

  // Index after each fix in the order it was added to the tray.
  const trajectory = useMemo(() => {
    const points = [{ step: active.version, index: analysis.index, label: "As saved" }];
    whatIf.forEach((instance, i) => {
      const design = applyFixes(active, whatIf.slice(0, i + 1));
      const parsed = parseFixInstance(instance);
      points.push({
        step: `+${i + 1}`,
        index: analyzeCached(design, override).index,
        label: parsed ? parsed.fix.title(parsed.target, active) : instance,
      });
    });
    return points;
  }, [active, analysis.index, whatIf, override]);

  const tray = whatIf.map((instance) => {
    const parsed = parseFixInstance(instance);
    const risk = analysis.risks.find((r) => r.key === parsed?.riskKey);
    const proven = Boolean(parsed && risk?.matches.some((m) => m.result === "pass" && PROVEN_FIX[m.reportId] === parsed.fix.id));
    return { instance, parsed, risk, proven };
  });
  const designCost = tray.reduce((s, t) => s + (t.parsed ? t.parsed.fix.effortHours * ENGINEER_RATE_USD + t.parsed.fix.designCostUsd : 0), 0);
  const labCost = tray.reduce((s, t) => s + (t.parsed?.fix.postLabCostUsd ?? 0), 0);
  const labWeeks = tray.reduce((m, t) => Math.max(m, t.parsed?.fix.postLabWeeks ?? 0), 0);
  const hours = tray.reduce((s, t) => s + (t.parsed?.fix.effortHours ?? 0), 0);
  const unproven = tray.filter((t) => !t.proven).length;

  const applyRecommended = () => {
    let added = 0;
    for (const { risk, recs } of plan) {
      if (risk.level === "Low" || !recs.length) continue;
      const already = recs.some((r) => whatIf.includes(r.instance));
      if (!already) {
        toggleWhatIf(active.id, recs[0].instance);
        added += 1;
      }
    }
    toast(added ? `${added} top-ranked fixes added to the what-if tray` : "The top fix for every High and Medium risk is already in the tray", added ? "success" : "info");
  };

  const visible = plan
    .map((entry) => ({ ...entry, recs: type === "all" ? entry.recs : entry.recs.filter((r) => r.fix.type === type) }))
    .filter((entry) => type === "all" || entry.recs.length);

  return (
    <>
      <PageHeader
        title="Fix Planner"
        description={`${active.product} ${active.version}. Each fix edits the layout and the engine re-scores it, so the reduction shown is measured, not quoted.`}
        mark={<M mark={MARKS.fixes} size={44} />}
        info={
          <InfoPopover label="How fixes are ranked">
            Fixes are ranked by the score they leave behind, then by engineering hours. A fix is marked proven only when a passing retest in
            the lab history shares at least half of the risk&apos;s condition tags and records that same fix.
          </InfoPopover>
        }
        actions={
          <>
            <DesignPicker />
            <Button variant="primary" onClick={applyRecommended}>
              <Sparkles size={13} strokeWidth={1.75} aria-hidden /> Apply top fixes
            </Button>
          </>
        }
      />

      <PageBody>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
          {/* Risks and ranked fixes */}
          <div className="min-w-0 xl:flex-[1.5]">
            <Panel title={`Risks and ranked fixes · ${visible.length}`} padded={false} className="h-auto">
              <div className="border-b border-muted p-3">
                <FilterChips
                  options={[{ id: "all", label: "All types" }, ...FIX_TYPES.filter((t) => typeCounts[t]).map((t) => ({ id: t, label: t, count: typeCounts[t] }))]}
                  value={type}
                  onChange={setType}
                />
              </div>
              {visible.length ? (
                <ul>
                  {visible.map(({ risk, recs }) => {
                    const expanded = open === risk.key;
                    const after = planned.analysis.risks.find((r) => r.key === risk.key);
                    const moved = (after?.score ?? 0) !== risk.score;
                    return (
                      <li key={risk.key} className="border-b border-muted last:border-b-0">
                        <button
                          type="button"
                          onClick={() => setOpen(expanded ? null : risk.key)}
                          aria-expanded={expanded}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left outline-none transition-colors duration-[150ms] hover:bg-raised focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-active"
                        >
                          {expanded ? <ChevronDown size={14} strokeWidth={1.75} className="shrink-0 icon-tertiary" aria-hidden /> : <ChevronRight size={14} strokeWidth={1.75} className="shrink-0 icon-tertiary" aria-hidden />}
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="text-body-md text-primary">
                                #{risk.num} {risk.aggressor} → {risk.victim}
                              </span>
                              <LevelBadge level={risk.level} />
                              {recs[0] ? <StatusBadge tone="neutral">{recs[0].fix.type}</StatusBadge> : null}
                            </span>
                            <span className="mt-0.5 block truncate text-body-sm text-tertiary">
                              {risk.mechanism}: {risk.coupling}
                            </span>
                          </span>
                          <span className="hidden shrink-0 items-center gap-2 sm:flex">
                            <ScoreBar score={risk.score} level={risk.level} />
                            {moved ? (
                              <span className="text-body-sm tabular text-success">to {after?.score ?? 0}</span>
                            ) : null}
                          </span>
                        </button>
                        {expanded ? (
                          <div className="flex flex-col gap-2 px-4 pb-4 sm:pl-11">
                            {recs.length ? (
                              recs.map((rec, i) => (
                                <div key={rec.instance}>
                                  <Label className="mb-1">{i === 0 ? "Recommended" : `Alternative ${i}`}</Label>
                                  <RecommendationRow rec={rec} designId={active.id} />
                                </div>
                              ))
                            ) : (
                              <p className="text-body-sm text-tertiary">No catalogue fix of this type lowers the score.</p>
                            )}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <EmptyState title="Nothing to fix" detail="No risk scores 10 or more in this design." mark={<M mark={MARKS.empty} size={44} />} />
              )}
            </Panel>
          </div>

          {/* What-if tray */}
          <div className="min-w-0 xl:sticky xl:top-0 xl:flex-1">
            <Panel title={`What-if tray · ${whatIf.length}`} action={<M mark={MARKS.whatIf} size={24} />} className="h-auto">
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-3 gap-3">
                  <Figure label="Saved" value={analysis.index} tone={TONE_TEXT[toneForIndex(analysis.index)]} hint={`${analysis.counts.High} High`} />
                  <Figure label="What-if" value={planned.analysis.index} tone={TONE_TEXT[toneForIndex(planned.analysis.index)]} hint={`${planned.analysis.counts.High} High`} />
                  <Figure label="Change" value={planned.analysis.index - analysis.index} tone={planned.analysis.index < analysis.index ? "text-success" : "text-tertiary"} hint="index points" />
                </div>

                <div>
                  <Label className="mb-1">How far does each fix move the index</Label>
                  <div className="h-40 w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trajectory} margin={{ top: 6, right: 8, bottom: 0, left: -22 }}>
                        <CartesianGrid stroke="var(--stroke-muted)" vertical={false} />
                        <XAxis dataKey="step" tick={{ fill: "var(--text-quaternary)", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis domain={[0, 100]} ticks={[0, 30, 60, 100]} tick={{ fill: "var(--text-quaternary)", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <ReferenceLine y={60} stroke="var(--feedback-error-icon)" strokeDasharray="4 4" />
                        <ReferenceLine y={30} stroke="var(--feedback-warning-icon)" strokeDasharray="4 4" />
                        <Tooltip
                          cursor={{ stroke: "var(--stroke-default)" }}
                          content={({ active: on, payload }) =>
                            on && payload?.length ? (
                              <div className="max-w-[16rem] rounded-lg border border-muted bg-container px-2.5 py-1.5">
                                <p className="text-body-sm text-primary">Index {payload[0].payload.index}</p>
                                <p className="text-caption text-tertiary">{payload[0].payload.label}</p>
                              </div>
                            ) : null
                          }
                        />
                        <Area type="stepAfter" dataKey="index" stroke="var(--analytics-series-1)" fill="var(--analytics-series-1)" fillOpacity={0.12} strokeWidth={2} dot={{ r: 3, fill: "var(--analytics-series-1)", strokeWidth: 0 }} isAnimationActive={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {tray.length ? (
                  <ul className="flex flex-col gap-1.5">
                    {tray.map(({ instance, parsed, risk, proven }, i) => (
                      <li key={instance} className="flex items-start gap-2 rounded-md border border-muted bg-page px-2.5 py-2">
                        <span className="mt-0.5 w-5 shrink-0 text-caption tabular text-quaternary">+{i + 1}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-body-sm text-secondary">{parsed ? parsed.fix.title(parsed.target, active) : instance}</span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-caption text-quaternary">
                            {risk ? `for #${risk.num}` : "risk already cleared"} · {parsed?.fix.type}
                            <StatusBadge tone={proven ? "success" : "warning"}>{proven ? "Proven" : "Unproven"}</StatusBadge>
                            <span className="tabular">index {trajectory[i + 1]?.index}</span>
                          </span>
                        </span>
                        <button type="button" aria-label="Remove from what-if" onClick={() => toggleWhatIf(active.id, instance)} className="shrink-0 rounded-full p-1 text-quaternary outline-none transition-colors duration-[150ms] hover:bg-action-tertiary-hover hover:text-primary focus-visible:ring-2 focus-visible:ring-active">
                          <X size={13} strokeWidth={1.75} aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-md border border-muted bg-raised px-3 py-2.5 text-body-sm text-tertiary">
                    Nothing applied yet. Open a risk and press Apply to what-if, or use Apply top fixes to take the recommended fix for every
                    High and Medium risk.
                  </p>
                )}

                {tray.length ? (
                  <div className="rounded-md border border-muted bg-raised px-3 py-2">
                    <div className="flex items-baseline justify-between gap-3 py-0.5">
                      <span className="text-body-sm text-tertiary">Cost now, at layout</span>
                      <span className="text-body-sm tabular text-primary">
                        {usd(designCost)} · {hours} h
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between gap-3 py-0.5">
                      <span className="text-body-sm text-tertiary">Same changes after a lab fail</span>
                      <span className="text-body-sm tabular text-warning">
                        {usd(labCost)} · up to {labWeeks} wk
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between gap-3 py-0.5">
                      <span className="text-body-sm text-tertiary">Fixes without a proving retest</span>
                      <span className={`text-body-sm tabular ${unproven ? "text-warning" : "text-success"}`}>{unproven}</span>
                    </div>
                    {unproven ? (
                      <p className="mt-1 flex items-start gap-2 text-caption text-quaternary">
                        <M mark={MARKS.unproven} size={18} />
                        Unproven fixes rest on the rule model alone. Book a pre-scan before the chamber slot.
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div className="flex flex-col gap-2 border-t border-muted pt-3">
                  <label className="min-w-0">
                    <span className="sr-only">Version note</span>
                    <input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder={`Version note, e.g. ${whatIf.length || "Top"} fixes from planner`}
                      className="h-8 w-full rounded-full border border-muted bg-action px-3 text-label-sm text-secondary outline-none placeholder:text-quaternary focus-visible:border-default focus-visible:ring-2 focus-visible:ring-active"
                    />
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="primary"
                      disabled={!whatIf.length}
                      onClick={() => {
                        const count = whatIf.length;
                        const created = saveWhatIf(active.id, note.trim() || `${count} fixes from planner`);
                        if (created) {
                          setSaved({ base: active, created });
                          setNote("");
                          toast(`${created.product} ${created.version} saved with ${count} fixes. It is now in Designs and Compare.`);
                        }
                      }}
                    >
                      <Save size={13} strokeWidth={1.75} aria-hidden /> Save as new version
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={!whatIf.length}
                      onClick={() => {
                        clearWhatIf(active.id);
                        toast("What-if tray cleared", "info");
                      }}
                    >
                      Clear
                    </Button>
                  </div>
                  {saved ? (
                    <div className="flex flex-wrap items-center gap-2 rounded-md border border-success-stroke bg-success-surface px-3 py-2">
                      <span className="min-w-0 flex-1 text-body-sm text-success">
                        {saved.created.product} {saved.created.version} created from {saved.base.version}.
                      </span>
                      <LinkButton href={`/compare?a=${saved.base.id}&b=${saved.created.id}`}>Compare</LinkButton>
                      <LinkButton href={`/workspace/${saved.created.id}`}>Open</LinkButton>
                    </div>
                  ) : null}
                  <p className="text-caption text-quaternary">
                    {provenIds.size} catalogue fixes carry a proving retest. A saved version is a proposal: the responsible EMC engineer signs it off
                    in the Review Pack.
                  </p>
                </div>
              </div>
            </Panel>
          </div>
        </div>
      </PageBody>
    </>
  );
}

export default function FixesPage() {
  return (
    <Suspense>
      <FixPlanner />
    </Suspense>
  );
}
