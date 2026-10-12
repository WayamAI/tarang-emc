"use client";

/**
 * Design workspace: component library | cabinet canvas | inspector.
 * Each pane scrolls on its own. Below 1100 px the side panes become drawers.
 */

import {
  Check, ChevronDown, ChevronRight, Library, Loader, PanelRight, Play, Plus, Search, Trash2,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { InfoPopover } from "@/components/ui/info-popover";
import { EmptyState, Select, StatusBadge } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { MARKS } from "@/lib/marks";
import {
  CATEGORY_LABEL, CATEGORY_ORDER, CATEGORY_TOKEN, MARKETS, MATERIALS, MATERIAL_BY_ID, TEMPLATES, TEMPLATE_BY_ID,
} from "@/lib/tarang/catalog";
import { useTarang } from "@/lib/tarang/context";
import { LEVEL_TONE, TONE_TEXT, toneForIndex } from "@/lib/tarang/format";
import { boxGap, cableLength, polylineLength, strapPath } from "@/lib/tarang/geometry";
import type { Analysis, Design, Part, Vec3 } from "@/lib/tarang/types";

import { Cabinet3D, VIEW_PRESETS, type ViewPreset } from "./cabinet-3d";
import { DraftingViews } from "./drafting-views";
import { RiskDrawer } from "./risk-drawer";
import { Button, DesignPicker, KeyValue, Label, LinkButton, M, SELECT_CLASS, Tabs, Toggle } from "./ui";

const PIPELINE = [
  "Reading geometry: part boxes, loom trunk, strap path",
  "Tracing coupling paths: gaps, shared runs, rails, returns",
  "Scoring rules R1 to R14",
  "Matching condition tags against 30 lab reports",
  "Rolling up tests for the selected markets",
];

const CHIP =
  "inline-flex h-7 shrink-0 items-center gap-1 rounded-full border px-2.5 text-label-sm outline-none transition-colors duration-[150ms] focus-visible:ring-2 focus-visible:ring-active";
const chip = (active: boolean) =>
  `${CHIP} ${active ? "border-transparent bg-action-primary text-on-color" : "border-muted bg-action text-tertiary hover:border-default hover:text-primary"}`;

const INPUT =
  "h-8 w-full min-w-0 rounded-full border border-muted bg-action px-3 text-label-sm tabular text-secondary outline-none focus-visible:border-default focus-visible:ring-2 focus-visible:ring-active";

function Section({ title, mark, children, defaultOpen = true }: { title: string; mark?: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-muted">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left outline-none transition-colors duration-[150ms] hover:bg-raised focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-active"
      >
        {open ? <ChevronDown size={13} strokeWidth={1.75} className="icon-quaternary" aria-hidden /> : <ChevronRight size={13} strokeWidth={1.75} className="icon-quaternary" aria-hidden />}
        {mark}
        <span className="min-w-0 flex-1 truncate text-caption tracking-[0.08em] text-quaternary uppercase">{title}</span>
      </button>
      {open ? <div className="px-3 pb-3">{children}</div> : null}
    </section>
  );
}

function PartInspector({ design, part, analysis, onRisk }: { design: Design; part: Part; analysis: Analysis | null; onRisk: (key: string) => void }) {
  const { movePart, patchPart, removePart } = useTarang();
  const toast = useToast();
  const tpl = TEMPLATE_BY_ID[part.templateId];
  const risks = analysis?.risks.filter((r) => r.aggressor === part.ref || r.victim === part.ref) ?? [];
  const neighbours = design.parts
    .filter((other) => other.ref !== part.ref)
    .map((other) => {
      const otherTpl = TEMPLATE_BY_ID[other.templateId];
      const keepOut = tpl.sensitivity ? otherTpl.nearFieldMm : otherTpl.sensitivity ? tpl.nearFieldMm : undefined;
      return { ref: other.ref, gap: boxGap(part, other), keepOut };
    })
    .filter((n) => n.keepOut)
    .sort((a, b) => a.gap - b.gap)
    .slice(0, 4);

  const nudge = (axis: 0 | 1 | 2, delta: number) => {
    const next = [...part.pos] as Vec3;
    next[axis] += delta;
    movePart(design.id, part.ref, next);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-2.5">
        <M mark={MARKS.part} size={28} />
        <div className="min-w-0">
          <p className="truncate text-body-md text-primary">
            {part.ref} · {part.name}
          </p>
          <p className="truncate text-caption text-quaternary">
            {CATEGORY_LABEL[tpl.category]} · {tpl.freqLabel} · {part.size.join(" × ")} mm
          </p>
        </div>
      </div>

      <div>
        <Label className="mb-1.5">Position, mm (snaps to 5)</Label>
        <div className="grid grid-cols-3 gap-1.5">
          {(["X", "Y", "Z"] as const).map((axis, i) => (
            <label key={axis} className="min-w-0">
              <span className="sr-only">{axis}</span>
              <div className="flex items-center gap-1">
                <span className="w-3 shrink-0 text-caption text-quaternary">{axis}</span>
                <input
                  type="number"
                  step={5}
                  value={part.pos[i]}
                  onChange={(event) => {
                    const next = [...part.pos] as Vec3;
                    next[i] = Number(event.target.value) || 0;
                    movePart(design.id, part.ref, next);
                  }}
                  className={`${INPUT} px-2`}
                />
              </div>
              <div className="mt-1 flex gap-1 pl-4">
                <button type="button" aria-label={`${axis} minus 5`} onClick={() => nudge(i as 0 | 1 | 2, -5)} className={`${chip(false)} h-6 min-w-0 flex-1 shrink justify-center px-0`}>
                  −5
                </button>
                <button type="button" aria-label={`${axis} plus 5`} onClick={() => nudge(i as 0 | 1 | 2, 5)} className={`${chip(false)} h-6 min-w-0 flex-1 shrink justify-center px-0`}>
                  +5
                </button>
              </div>
            </label>
          ))}
        </div>
        <p className="mt-1.5 text-caption text-quaternary">Or drag the box in the 3D view: it moves in the plane facing the camera.</p>
      </div>

      {neighbours.length ? (
        <div>
          <Label className="mb-1">Edge-to-edge gaps</Label>
          {neighbours.map((n) => (
            <div key={n.ref} className="flex items-baseline justify-between gap-2 py-0.5">
              <span className="text-body-sm text-tertiary">to {n.ref}</span>
              <span className={`text-body-sm tabular ${n.gap < (n.keepOut ?? 0) ? "text-error" : "text-secondary"}`}>
                {Math.round(n.gap)} mm <span className="text-quaternary">/ {n.keepOut} mm keep-out</span>
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <div>
        <Label className="mb-1">Mitigations on this part</Label>
        {tpl.sensitivity === "radio" || tpl.sensitivity === "logic" ? (
          <Toggle label="Shield can" hint="R1 −0.25, R6 −0.20" checked={Boolean(part.shieldCan)} onChange={(v) => patchPart(design.id, part.ref, { shieldCan: v })} />
        ) : null}
        {tpl.sensitivity && part.rail ? (
          <Toggle label="Local LC filter on supply" hint={`Rail ${part.rail}, R4 −0.40`} checked={Boolean(part.localFilter)} onChange={(v) => patchPart(design.id, part.ref, { localFilter: v })} />
        ) : null}
        {tpl.switchKHz || tpl.clockMHz ? (
          <Toggle label={tpl.clockMHz ? "Spread-spectrum clock" : "Frequency jitter"} hint="R3 −6 dB quasi-peak, R6 −0.15" checked={Boolean(part.spreadSpectrum)} onChange={(v) => patchPart(design.id, part.ref, { spreadSpectrum: v })} />
        ) : null}
        {tpl.sensitivity === "touch" ? (
          <Toggle label="Scan frequency hopping" hint="Removes in-band PWM harmonics (R6)" checked={Boolean(part.freqHop)} onChange={(v) => patchPart(design.id, part.ref, { freqHop: v })} />
        ) : null}
        {tpl.userAccessible ? (
          <Toggle label="TVS array and guard ring" hint="R8 0.50 to 0.12" checked={Boolean(part.esdProtection)} onChange={(v) => patchPart(design.id, part.ref, { esdProtection: v })} />
        ) : null}
        {tpl.tempLimitC ? (
          <Toggle label="Thermal baffle" hint={`Derated limit ${tpl.tempLimitC}°C, coupled rise ×0.4`} checked={Boolean(part.thermalBaffle)} onChange={(v) => patchPart(design.id, part.ref, { thermalBaffle: v })} />
        ) : null}
        {tpl.heaterW ? (
          <>
            <Toggle label="Two staged elements" hint="Halves each voltage step (R9)" checked={Boolean(part.staged)} onChange={(v) => patchPart(design.id, part.ref, { staged: v })} />
            <div className="flex items-center justify-between gap-3 px-1.5 py-1.5">
              <span className="text-body-sm text-secondary">Switching period</span>
              <Select aria-label="Switching period" value={String(part.switchPeriodS ?? 20)} onChange={(e) => patchPart(design.id, part.ref, { switchPeriodS: Number(e.target.value) })} className={SELECT_CLASS}>
                {[10, 20, 45, 60, 120].map((s) => (
                  <option key={s} value={s}>
                    {s} s
                  </option>
                ))}
              </Select>
            </div>
          </>
        ) : null}
        {tpl.rectifierW ? (
          <div className="flex items-center justify-between gap-3 px-1.5 py-1.5">
            <span className="text-body-sm text-secondary">Power factor correction</span>
            <Select aria-label="PFC" value={part.pfc ?? "none"} onChange={(e) => patchPart(design.id, part.ref, { pfc: e.target.value as Part["pfc"] })} className={SELECT_CLASS}>
              <option value="none">None</option>
              <option value="passive">Passive choke</option>
              <option value="active">Active boost</option>
            </Select>
          </div>
        ) : null}
        {tpl.mainsPort ? (
          <div className="flex items-center justify-between gap-3 px-1.5 py-1.5">
            <span className="flex items-center gap-2 text-body-sm text-secondary">
              <M mark={MARKS.choke} size={20} /> EMI filter
            </span>
            <Select aria-label="Filter stages" value={String(part.filterStages ?? tpl.filterStages ?? 0)} onChange={(e) => patchPart(design.id, part.ref, { filterStages: Number(e.target.value) })} className={SELECT_CLASS}>
              <option value="0">No filter</option>
              <option value="1">Single stage</option>
              <option value="2">Two stage (+12 dB)</option>
            </Select>
          </div>
        ) : null}
      </div>

      <div>
        <Label className="mb-1">Risks through {part.ref}</Label>
        {!analysis ? (
          <p className="text-body-sm text-tertiary">Run the analysis to see callouts.</p>
        ) : risks.length ? (
          <ul className="flex flex-col gap-1">
            {risks.map((risk) => (
              <li key={risk.key}>
                <button type="button" onClick={() => onRisk(risk.key)} className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left outline-none transition-colors duration-[150ms] hover:bg-raised focus-visible:ring-2 focus-visible:ring-active">
                  <span className={`w-7 shrink-0 text-body-sm tabular ${TONE_TEXT[LEVEL_TONE[risk.level]]}`}>{risk.score}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body-sm text-secondary">
                      #{risk.num} {risk.aggressor} → {risk.victim} · {risk.mechanism}
                    </span>
                    <span className="block truncate text-caption text-quaternary">{risk.coupling}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body-sm text-tertiary">Nothing scores 10 or more.</p>
        )}
      </div>

      <Button
        variant="ghost"
        className="self-start"
        onClick={() => {
          removePart(design.id, part.ref);
          toast(`${part.ref} removed with its cables`, "info");
        }}
      >
        <Trash2 size={13} strokeWidth={1.75} aria-hidden /> Remove part
      </Button>
    </div>
  );
}

export function Workspace({ designId }: { designId: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const { designById, analysisOf, setActiveId, addPart, toggleMarket, updateDesign, movePart } = useTarang();
  const design = designById(designId);

  const [selected, setSelected] = useState<string | null>(params.get("select"));
  const [tab, setTab] = useState<"3d" | "drafting">("3d");
  const [view, setView] = useState<{ preset: ViewPreset; tick: number }>({ preset: "Iso", tick: 0 });
  const [showZones, setShowZones] = useState(true);
  const [showCables, setShowCables] = useState(true);
  const [showKeepOut, setShowKeepOut] = useState(false);
  const [live, setLive] = useState(true);
  const [snapshot, setSnapshot] = useState<{ analysis: Analysis; design: Design } | null>(null);
  const [step, setStep] = useState(-1);
  const [query, setQuery] = useState("");
  const [libOpen, setLibOpen] = useState(false);
  const [inspOpen, setInspOpen] = useState(false);
  const [riskKey, setRiskKey] = useState<string | null>(null);
  const latest = useRef(design);

  useEffect(() => {
    latest.current = design;
  });
  useEffect(() => {
    if (design) setActiveId(design.id);
  }, [design, setActiveId]);

  const liveAnalysis = design ? analysisOf(design.id) : null;
  const shown: Analysis | null = live ? liveAnalysis : snapshot?.analysis ?? null;
  const stale = !live && Boolean(snapshot) && snapshot?.design !== design;

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CATEGORY_ORDER.map((category) => ({
      category,
      items: TEMPLATES.filter((t) => t.category === category && (!q || `${t.name} ${t.freqLabel} ${CATEGORY_LABEL[category]}`.toLowerCase().includes(q))),
    })).filter((g) => g.items.length);
  }, [query]);

  if (!design || !liveAnalysis) {
    return (
      <>
        <PageHeader title="Workspace" description="This design is not in the current session." mark={<M mark={MARKS.workspace} size={44} />} actions={<LinkButton href="/designs">All designs</LinkButton>} />
        <EmptyState title="Design not found" detail="Versions saved from the Fix Planner live in this browser session only." mark={<M mark={MARKS.empty} size={44} />} />
      </>
    );
  }

  const run = () => {
    if (step >= 0) return;
    setStep(0);
    PIPELINE.forEach((_, i) => {
      window.setTimeout(() => {
        if (i < PIPELINE.length - 1) {
          setStep(i + 1);
          return;
        }
        const current = latest.current;
        if (current) {
          const analysis = analysisOf(current.id);
          setSnapshot({ analysis, design: current });
          toast(`Analysis complete: index ${analysis.index}, ${analysis.counts.High} High, ${analysis.counts.Medium} Medium, ${analysis.counts.Low} Low`);
        }
        setStep(-1);
      }, 420 * (i + 1));
    });
  };

  const part = design.parts.find((p) => p.ref === selected) ?? null;
  const shielding = liveAnalysis.shielding;
  const indexTone = shown ? TONE_TEXT[toneForIndex(shown.index)] : "text-quaternary";

  const paneBase = "absolute inset-y-0 z-30 flex-col border-muted bg-container shadow-lg min-[1100px]:static min-[1100px]:z-auto min-[1100px]:flex min-[1100px]:shadow-none";

  return (
    <>
      <PageHeader
        title="Workspace"
        mark={<M mark={MARKS.workspace} size={44} />}
        info={
          <InfoPopover label="How the workspace scores">
            Drag a part or type a position and the rule engine re-scores the whole cabinet: gaps feed radiated and thermal proximity, the loom
            feeds crosstalk, the strap feeds the ground loop, and the inlet filter feeds conducted emissions. With Live off, the callouts hold
            the last run until you press Run analysis.
          </InfoPopover>
        }
        description={`${design.product} ${design.version} · ${design.note} · ${design.enclosure.join(" × ")} mm · ${design.parts.length} parts, ${design.cables.length} cables, ${design.harnesses.length} harness`}
        actions={
          <>
            <DesignPicker value={design.id} onChange={(id) => router.push(`/workspace/${id}`)} />
            <Button variant={live ? "secondary" : "primary"} onClick={run} disabled={step >= 0}>
              {step >= 0 ? <Loader size={13} strokeWidth={1.75} className="animate-spin" aria-hidden /> : <Play size={13} strokeWidth={1.75} aria-hidden />}
              Run analysis
            </Button>
            <button
              type="button"
              role="switch"
              aria-checked={live}
              onClick={() => {
                if (live) setSnapshot({ analysis: liveAnalysis, design });
                setLive((v) => !v);
              }}
              className={chip(live)}
            >
              {live ? <Check size={12} strokeWidth={2} aria-hidden /> : null} Live analysis
            </button>
          </>
        }
      />

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {/* Library */}
        <aside className={`${paneBase} left-0 w-60 border-r ${libOpen ? "flex" : "hidden"}`}>
          <div className="shrink-0 border-b border-muted p-2.5">
            <label className="relative block">
              <span className="sr-only">Search components</span>
              <Search size={13} strokeWidth={1.75} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 icon-quaternary" aria-hidden />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search 22 templates" className={`${INPUT} pl-8`} />
            </label>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {groups.map((group) => (
              <div key={group.category} className="border-b border-muted px-2.5 py-2">
                <p className="mb-1 flex items-center gap-1.5 text-caption tracking-[0.08em] text-quaternary uppercase">
                  <span className="size-2 shrink-0 rounded-[2px]" style={{ background: `var(${CATEGORY_TOKEN[group.category]})` }} aria-hidden />
                  {CATEGORY_LABEL[group.category]}
                </p>
                <ul className="flex flex-col">
                  {group.items.map((tpl) => (
                    <li key={tpl.id}>
                      <button
                        type="button"
                        title={tpl.note}
                        onClick={() => {
                          const ref = addPart(design.id, tpl.id);
                          if (ref) {
                            setSelected(ref);
                            toast(`${ref} ${tpl.name} placed. Drag it into position.`);
                          }
                        }}
                        className="group flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left outline-none transition-colors duration-[150ms] hover:bg-raised focus-visible:ring-2 focus-visible:ring-active"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-body-sm text-secondary">{tpl.name}</span>
                          <span className="block truncate text-caption tabular text-quaternary">
                            {tpl.prefix} · {tpl.size.join("×")} · {tpl.freqLabel}
                          </span>
                        </span>
                        <Plus size={13} strokeWidth={1.75} className="shrink-0 icon-quaternary group-hover:text-primary" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {!groups.length ? <EmptyState title="No template matches" detail="Clear the search to see all 22." /> : null}
          </div>
        </aside>

        {/* Canvas */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-muted px-3 py-2">
            <button type="button" onClick={() => { setLibOpen((v) => !v); setInspOpen(false); }} aria-pressed={libOpen} className={`${chip(libOpen)} min-[1100px]:hidden`}>
              <Library size={13} strokeWidth={1.75} aria-hidden /> Library
            </button>
            <Tabs tabs={[{ id: "3d", label: "3D view" }, { id: "drafting", label: "Drafting views" }]} value={tab} onChange={setTab} />
            {tab === "3d" ? (
              <>
                <div className="flex min-w-0 gap-1 overflow-x-auto">
                  {VIEW_PRESETS.map((preset) => (
                    <button key={preset} type="button" onClick={() => setView((v) => ({ preset, tick: v.tick + 1 }))} aria-pressed={view.preset === preset} className={chip(view.preset === preset)}>
                      {preset}
                    </button>
                  ))}
                </div>
                <span className="hidden h-5 w-px bg-muted sm:block" aria-hidden />
                <button type="button" onClick={() => setShowZones((v) => !v)} aria-pressed={showZones} className={chip(showZones)}>Zones</button>
                <button type="button" onClick={() => setShowCables((v) => !v)} aria-pressed={showCables} className={chip(showCables)}>Cables</button>
                <button type="button" onClick={() => setShowKeepOut((v) => !v)} aria-pressed={showKeepOut} className={chip(showKeepOut)}>Keep-outs</button>
              </>
            ) : null}
            <button type="button" onClick={() => { setInspOpen((v) => !v); setLibOpen(false); }} aria-pressed={inspOpen} className={`${chip(inspOpen)} ml-auto min-[1100px]:hidden`}>
              <PanelRight size={13} strokeWidth={1.75} aria-hidden /> Inspector
            </button>
          </div>

          <div className="relative min-h-0 flex-1">
            {tab === "3d" ? (
              <Cabinet3D
                design={design}
                analysis={shown}
                selected={selected}
                onSelect={setSelected}
                onMove={(ref, pos) => movePart(design.id, ref, pos)}
                view={view}
                showZones={showZones}
                showCables={showCables}
                showKeepOut={showKeepOut}
              />
            ) : (
              <DraftingViews design={design} analysis={shown} selected={selected} onSelect={setSelected} />
            )}
            {step >= 0 ? (
              <div className="absolute top-3 left-1/2 w-[min(26rem,calc(100%-1.5rem))] -translate-x-1/2 rounded-lg border border-muted bg-container p-3 shadow-lg">
                <Label>Running analysis</Label>
                <ol className="mt-1.5 flex flex-col gap-1">
                  {PIPELINE.map((label, i) => (
                    <li key={label} className={`flex items-center gap-2 text-body-sm ${i < step ? "text-tertiary" : i === step ? "text-primary" : "text-quaternary"}`}>
                      {i < step ? <Check size={12} strokeWidth={2} className="text-success" aria-hidden /> : i === step ? <Loader size={12} strokeWidth={2} className="animate-spin" aria-hidden /> : <span className="size-3" />}
                      {label}
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t border-muted px-3 py-2">
            <span className="flex items-baseline gap-2">
              <span className="text-caption tracking-[0.08em] text-quaternary uppercase">Risk index</span>
              <span className={`font-display text-display-lg tabular ${indexTone}`}>{shown ? shown.index : "—"}</span>
            </span>
            {shown ? (
              <span className="flex items-center gap-1.5">
                <StatusBadge tone="error">{shown.counts.High} High</StatusBadge>
                <StatusBadge tone="warning">{shown.counts.Medium} Medium</StatusBadge>
                <StatusBadge tone="info">{shown.counts.Low} Low</StatusBadge>
              </span>
            ) : (
              <span className="text-body-sm text-tertiary">Not analysed yet. Press Run analysis.</span>
            )}
            {stale ? <StatusBadge tone="warning">Stale: design changed since the last run</StatusBadge> : null}
            {live ? <span className="text-caption text-quaternary">Live: every move re-scores</span> : null}
            <LinkButton href="/risks" variant="ghost" className="ml-auto">
              Open register
            </LinkButton>
          </div>
        </div>

        {/* Inspector */}
        <aside className={`${paneBase} right-0 w-72 border-l ${inspOpen ? "flex" : "hidden"}`}>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <Section title={part ? `Part ${part.ref}` : "Part"}>
              {part ? (
                <PartInspector design={design} part={part} analysis={shown} onRisk={setRiskKey} />
              ) : (
                <p className="text-body-sm text-tertiary">Click a box in the canvas to inspect it, move it and toggle its mitigations.</p>
              )}
            </Section>

            <Section title="Design">
              <KeyValue k="Product" v={design.product} />
              <KeyValue k="Version" v={`${design.version} · ${design.note}`} />
              <KeyValue k="Enclosure" v={`${design.enclosure.join(" × ")} mm`} />
              <div className="flex items-center justify-between gap-3 py-1">
                <span className="text-body-sm text-tertiary">Protection class</span>
                <Select aria-label="Protection class" value={design.protectionClass} onChange={(e) => updateDesign(design.id, (d) => ({ ...d, protectionClass: e.target.value as Design["protectionClass"] }))} className={SELECT_CLASS}>
                  <option value="I">Class I, earthed</option>
                  <option value="II">Class II, double insulated</option>
                </Select>
              </div>
              <Label className="mt-2 mb-1.5">Markets in scope</Label>
              <div className="flex flex-wrap gap-1.5">
                {MARKETS.map((m) => (
                  <button key={m.id} type="button" title={m.scheme} onClick={() => toggleMarket(design.id, m.id)} aria-pressed={design.markets.includes(m.id)} className={chip(design.markets.includes(m.id))}>
                    {m.id}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-caption text-quaternary">Changing a market changes which tests carry mandatory weight, so scores move.</p>
            </Section>

            <Section title="Cabinet shielding">
              <p className="font-display text-display-lg tabular text-primary">
                {shielding.effectiveDb} <span className="font-sans text-body-sm text-quaternary">dB first-order estimate</span>
              </p>
              <p className="mt-1 text-body-sm text-tertiary">
                {shielding.leakMHz
                  ? `Useful below about ${shielding.leakMHz} MHz, then ${shielding.aboveLeakDb} dB. Limiting aperture: ${shielding.limitingAperture}.`
                  : `No dominant aperture. Limited by ${shielding.limitingPanel.toLowerCase()}.`}
              </p>
              <LinkButton href="/libraries/materials" variant="ghost" className="mt-1 -ml-3">
                Open panel calculator
              </LinkButton>
            </Section>

            <Section title={`Panels · ${design.panels.length}`} defaultOpen={false}>
              <ul className="flex flex-col gap-2.5">
                {design.panels.map((panel) => {
                  const material = MATERIAL_BY_ID[panel.materialId];
                  const patch = (p: Partial<typeof panel>) => updateDesign(design.id, (d) => ({ ...d, panels: d.panels.map((x) => (x.id === panel.id ? { ...x, ...p } : x)) }));
                  return (
                    <li key={panel.id} className="rounded-md border border-muted p-2">
                      <p className="truncate text-body-sm text-secondary">{panel.name}</p>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <Select aria-label={`${panel.name} material`} value={panel.materialId} onChange={(e) => patch({ materialId: e.target.value })} className={`${SELECT_CLASS} w-full`}>
                          {MATERIALS.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </Select>
                        <span className="shrink-0 text-caption tabular text-quaternary">{panel.thicknessMm} mm</span>
                      </div>
                      {material.conductive ? (
                        <Toggle label="Earth bond" hint={panel.outsideWrap ? "Outside the shielded wrap" : "Star washer through masked paint"} checked={panel.earthBonded} onChange={(v) => patch({ earthBonded: v })} />
                      ) : (
                        <p className="mt-1 text-caption text-quaternary">Non-conductive: transparent to RF, cannot be earthed.</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Section>

            <Section title={`Harnesses · ${design.harnesses.length}`} mark={<M mark={MARKS.harness} size={20} />} defaultOpen={false}>
              {design.harnesses.map((harness) => (
                <div key={harness.id}>
                  <p className="text-body-sm text-secondary">
                    {harness.id} · {harness.name}
                  </p>
                  <p className="text-caption tabular text-quaternary">Trunk {Math.round(polylineLength(harness.trunk))} mm</p>
                  <ul className="mt-1 flex flex-col">
                    {harness.members.map((member) => {
                      const cable = design.cables.find((c) => c.id === member.cableId);
                      if (!cable) return null;
                      return (
                        <li key={member.cableId} className="flex items-center gap-2 py-1">
                          <span className={`size-1.5 shrink-0 rounded-full ${cable.noisy ? "bg-error" : cable.sensitive ? "bg-info" : "bg-neutral"}`} aria-hidden />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-body-sm text-secondary">
                              {cable.id} {cable.name}
                            </span>
                            <span className="block truncate text-caption tabular text-quaternary">
                              {member.from} to {member.to} mm · {cable.construction}
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              updateDesign(design.id, (d) => ({ ...d, harnesses: d.harnesses.map((h) => (h.id === harness.id ? { ...h, members: h.members.filter((m) => m.cableId !== member.cableId) } : h)) }));
                              toast(`${cable.id} pulled out of ${harness.id} into its own run`, "info");
                            }}
                            className={`${chip(false)} h-6`}
                          >
                            Pull out
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
              {!design.harnesses.length ? <p className="text-body-sm text-tertiary">No shared loom in this design.</p> : null}
              <p className="mt-1.5 text-caption tabular text-quaternary">
                {design.cables.length} cables, {Math.round(design.cables.reduce((s, c) => s + cableLength(design, c), 0) / 100) / 10} m routed
              </p>
            </Section>

            <Section title={`Ground nets · ${design.groundNets.length}`} mark={<M mark={MARKS.ground} size={20} />} defaultOpen={false}>
              <ul className="flex flex-col gap-2.5">
                {design.groundNets.map((net) => {
                  const length = polylineLength(strapPath(design, net));
                  return (
                    <li key={net.id} className="rounded-md border border-muted p-2">
                      <p className="truncate text-body-sm text-secondary">
                        {net.id} · {net.name}
                      </p>
                      <p className="text-caption tabular text-quaternary">
                        {net.members.join(", ")} · {Math.round(length)} mm · {Math.round((length * net.standoffMm) / 100)} cm² loop
                        {net.protectiveEarth ? " · protective earth" : ""}
                      </p>
                      {net.members.length > 1 ? (
                        <Toggle
                          label="Star ground"
                          hint="Separate short returns to the inlet stud"
                          checked={net.topology === "star"}
                          onChange={(v) => updateDesign(design.id, (d) => ({ ...d, groundNets: d.groundNets.map((n) => (n.id === net.id ? { ...n, topology: v ? "star" : "shared" } : n)) }))}
                        />
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </Section>
          </div>
        </aside>
      </div>

      <RiskDrawer designId={design.id} riskKey={riskKey} onClose={() => setRiskKey(null)} />
    </>
  );
}
