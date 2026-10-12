"use client";

/** Designs: every programme, its version lineage and where each version stands. */

import { GitBranch, Trash2 } from "lucide-react";
import { useState } from "react";

import { PageBody, PageHeader } from "@/components/layout/page-header";
import { Button, Drawer, KeyValue, Label, LinkButton, M } from "@/components/tarang/ui";
import { DataTable, FilterChips, type Column } from "@/components/ui/data-table";
import { InlineArrow, KpiTile, Panel, StatusBadge } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { MARKS } from "@/lib/marks";
import { useTarang } from "@/lib/tarang/context";
import { SEED_DESIGNS } from "@/lib/tarang/designs";
import { parseFixInstance } from "@/lib/tarang/fixes";
import { dateShort, TONE_TEXT, toneForIndex } from "@/lib/tarang/format";
import { designsOf, PROGRAMS, PROGRAM_BY_ID } from "@/lib/tarang/portfolio";
import type { Design } from "@/lib/tarang/types";

const SEEDED = new Set(SEED_DESIGNS.map((d) => d.id));

export default function DesignsPage() {
  const toast = useToast();
  const { designs, activeId, setActiveId, analysisOf, branchDesign, deleteDesign, signOffs, designById } = useTarang();
  const [program, setProgram] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const rows = program === "all" ? designs : designs.filter((d) => d.programId === program);
  const open = openId ? designById(openId) : undefined;
  const openAnalysis = open ? analysisOf(open.id) : undefined;
  const best = Math.min(...designs.map((d) => analysisOf(d.id).index));

  const columns: Column<Design>[] = [
    {
      key: "design", header: "Design",
      render: (d) => (
        <span className="inline-flex items-center gap-2 text-primary">
          {d.product} {d.version}
          {d.id === activeId ? <StatusBadge tone="info">In scope</StatusBadge> : null}
        </span>
      ),
      value: (d) => `${d.product} ${d.version}`,
    },
    { key: "note", header: "Note", render: (d) => d.note, value: (d) => d.note },
    { key: "markets", header: "Markets", render: (d) => d.markets.join(" + "), value: (d) => d.markets.join(" ") },
    { key: "index", header: "Risk index", align: "right", card: "metric", render: (d) => <span className={`tabular ${TONE_TEXT[toneForIndex(analysisOf(d.id).index)]}`}>{analysisOf(d.id).index}</span>, value: (d) => analysisOf(d.id).index },
    { key: "h", header: "High", align: "right", render: (d) => <span className="tabular">{analysisOf(d.id).counts.High}</span>, value: (d) => analysisOf(d.id).counts.High },
    { key: "m", header: "Medium", align: "right", render: (d) => <span className="tabular">{analysisOf(d.id).counts.Medium}</span>, value: (d) => analysisOf(d.id).counts.Medium },
    { key: "l", header: "Low", align: "right", render: (d) => <span className="tabular">{analysisOf(d.id).counts.Low}</span>, value: (d) => analysisOf(d.id).counts.Low, hide: "md" },
    { key: "parts", header: "Parts", align: "right", render: (d) => <span className="tabular">{d.parts.length}</span>, value: (d) => d.parts.length, hide: "md" },
    { key: "fixes", header: "Fixes folded in", align: "right", render: (d) => <span className="tabular">{d.appliedFixes.length}</span>, value: (d) => d.appliedFixes.length, hide: "lg" },
    { key: "created", header: "Created", render: (d) => <span className="tabular">{dateShort(d.createdAt)}</span>, value: (d) => d.createdAt, hide: "md" },
    { key: "author", header: "Author", render: (d) => d.author, value: (d) => d.author, hide: "lg" },
    { key: "signed", header: "Sign-off", render: (d) => (signOffs[d.id] ? <StatusBadge tone="success">Signed</StatusBadge> : <StatusBadge tone="neutral">Open</StatusBadge>), value: (d) => (signOffs[d.id] ? "Signed" : "Open") },
  ];

  return (
    <>
      <PageHeader
        title="Designs"
        description="Each version is a full cabinet layout scored by the same engine. Pick one to put it in scope for the register, the planner and the matrix."
        mark={<M mark={MARKS.designs} size={44} />}
        actions={
          <>
            <LinkButton href={`/workspace/${activeId}`} variant="primary">
              Open scope in workspace
            </LinkButton>
            <LinkButton href="/compare">Compare versions</LinkButton>
          </>
        }
      >
        <FilterChips
          options={[{ id: "all", label: "All programmes", count: designs.length }, ...PROGRAMS.map((p) => ({ id: p.id, label: p.name, count: designsOf(designs, p.id).length }))]}
          value={program}
          onChange={setProgram}
        />
      </PageHeader>
      <PageBody>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiTile label="Designs" value={String(designs.length)} hint={`${PROGRAMS.length} programmes`} mark={<M mark={MARKS.version} />} />
            <KpiTile label="Lowest index" value={String(best)} hint="best version on file" tone="success" />
            <KpiTile label="Versions with a High" value={String(designs.filter((d) => analysisOf(d.id).counts.High).length)} hint="not ready for lab entry" tone="error" mark={<M mark={MARKS.highRisk} />} />
            <KpiTile label="Signed off" value={String(designs.filter((d) => signOffs[d.id]).length)} hint="by the EMC lead" tone="info" />
          </div>

          <Panel title="Version lineage" className="h-auto">
            <ul className="flex flex-col gap-3">
              {PROGRAMS.filter((p) => program === "all" || p.id === program).map((p) => (
                <li key={p.id} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="w-56 shrink-0">
                    <p className="truncate text-body-md text-primary">{p.name}</p>
                    <p className="truncate text-caption text-quaternary">
                      {p.kind} · {p.gate} {dateShort(p.gateDate)}
                    </p>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                    {designsOf(designs, p.id).map((d, i) => {
                      const index = analysisOf(d.id).index;
                      return (
                        <span key={d.id} className="inline-flex items-center gap-1.5">
                          {i > 0 ? <InlineArrow className="text-quaternary" /> : null}
                          <button
                            type="button"
                            onClick={() => setOpenId(d.id)}
                            title={d.note}
                            className={`inline-flex h-8 items-center gap-2 rounded-full border px-3 text-label-sm outline-none transition-colors duration-[150ms] focus-visible:ring-2 focus-visible:ring-active ${d.id === activeId ? "border-default bg-raised text-primary" : "border-muted bg-action text-secondary hover:border-default"}`}
                          >
                            {d.version}
                            <span className={`tabular ${TONE_TEXT[toneForIndex(index)]}`}>{index}</span>
                          </button>
                        </span>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title={`All versions · ${rows.length}`} padded={false} className="h-[30rem]!">
            <DataTable rows={rows} columns={columns} rowKey={(d) => d.id} onRowClick={(d) => setOpenId(d.id)} isRowSelected={(d) => d.id === openId} searchPlaceholder="Search designs" exportName="tarang-designs" serial={false} />
          </Panel>
        </div>
      </PageBody>

      <Drawer
        open={Boolean(open)}
        onClose={() => setOpenId(null)}
        title={open ? `${open.product} ${open.version}` : ""}
        subtitle={open ? `${open.note} · ${PROGRAM_BY_ID[open.programId].kind}` : undefined}
        footer={
          open ? (
            <>
              <LinkButton href={`/workspace/${open.id}`} variant="primary">
                Open in workspace
              </LinkButton>
              <Button
                disabled={open.id === activeId}
                onClick={() => {
                  setActiveId(open.id);
                  toast(`${open.product} ${open.version} is now in scope on every page`);
                }}
              >
                {open.id === activeId ? "In scope" : "Put in scope"}
              </Button>
              <Button
                onClick={() => {
                  const created = branchDesign(open.id, `Branched from ${open.version}`);
                  if (created) {
                    toast(`${created.product} ${created.version} created from ${open.version}`);
                    setOpenId(created.id);
                  }
                }}
              >
                <GitBranch size={13} strokeWidth={1.75} aria-hidden /> Branch
              </Button>
              {open.parentId ? <LinkButton href={`/compare?a=${open.parentId}&b=${open.id}`}>Compare with parent</LinkButton> : null}
              {!SEEDED.has(open.id) ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    deleteDesign(open.id);
                    setOpenId(null);
                    toast(`${open.product} ${open.version} deleted`, "info");
                  }}
                >
                  <Trash2 size={13} strokeWidth={1.75} aria-hidden /> Delete
                </Button>
              ) : null}
            </>
          ) : null
        }
      >
        {open && openAnalysis ? (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Risk index</Label>
                <p className={`font-display text-display-2xl tabular ${TONE_TEXT[toneForIndex(openAnalysis.index)]}`}>{openAnalysis.index}</p>
              </div>
              <div>
                <Label>High / Medium / Low</Label>
                <p className="font-display text-display-2xl tabular text-primary">
                  {openAnalysis.counts.High} / {openAnalysis.counts.Medium} / {openAnalysis.counts.Low}
                </p>
              </div>
            </div>
            <div className="rounded-md border border-muted bg-raised px-3 py-2">
              <KeyValue k="Enclosure" v={`${open.enclosure.join(" × ")} mm`} />
              <KeyValue k="Markets" v={open.markets.join(" + ")} />
              <KeyValue k="Protection class" v={`Class ${open.protectionClass}`} />
              <KeyValue k="Parts / cables / harnesses" v={`${open.parts.length} / ${open.cables.length} / ${open.harnesses.length}`} />
              <KeyValue k="Zones" v={open.zones.map((z) => z.name).join(", ")} />
              <KeyValue k="Created" v={`${dateShort(open.createdAt)} by ${open.author}`} />
              <KeyValue k="Parent" v={open.parentId ? `${designById(open.parentId)?.version ?? "removed"}` : "None, first layout"} />
              <KeyValue k="PLM record" v={PROGRAM_BY_ID[open.programId].plm} />
            </div>
            <div>
              <Label>Top risks</Label>
              <ul className="mt-1.5 flex flex-col gap-1">
                {openAnalysis.risks.slice(0, 4).map((risk) => (
                  <li key={risk.key} className="flex items-baseline gap-2.5">
                    <span className="w-7 shrink-0 text-body-sm tabular text-primary">{risk.score}</span>
                    <span className="min-w-0 truncate text-body-sm text-secondary">
                      #{risk.num} {risk.aggressor} → {risk.victim} · {risk.mechanism}
                    </span>
                  </li>
                ))}
                {!openAnalysis.risks.length ? <li className="text-body-sm text-tertiary">Nothing scores 10 or more.</li> : null}
              </ul>
            </div>
            <div>
              <Label>Fixes folded into this version · {open.appliedFixes.length}</Label>
              {open.appliedFixes.length ? (
                <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-5">
                  {open.appliedFixes.map((instance, i) => {
                    const parsed = parseFixInstance(instance);
                    return (
                      <li key={`${instance}-${i}`} className="text-body-sm text-secondary">
                        {parsed ? parsed.fix.title(parsed.target, open) : instance}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-1 text-body-sm text-tertiary">None. This is the layout as designed.</p>
              )}
            </div>
          </div>
        ) : null}
      </Drawer>
    </>
  );
}
