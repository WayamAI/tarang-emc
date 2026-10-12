"use client";

/** Materials library and the panel calculator that turns a material into an effective shielding estimate. */

import { useState } from "react";

import { PageBody, PageHeader } from "@/components/layout/page-header";
import { Button, Figure, Label, M, SELECT_CLASS, Toggle } from "@/components/tarang/ui";
import { DataTable, type Column } from "@/components/ui/data-table";
import { InfoPopover } from "@/components/ui/info-popover";
import { Panel, Select, SplitRow, StatusBadge } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { MARKS } from "@/lib/marks";
import { MATERIALS, MATERIAL_BY_ID } from "@/lib/tarang/catalog";
import { useTarang } from "@/lib/tarang/context";
import { panelShielding } from "@/lib/tarang/engine";
import type { Material, Panel as CabinetPanel } from "@/lib/tarang/types";

const INPUT =
  "h-8 w-24 rounded-full border border-muted bg-action px-3 text-right text-label-sm tabular text-secondary outline-none focus-visible:border-default focus-visible:ring-2 focus-visible:ring-active";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="min-w-0 truncate text-body-sm text-secondary">{label}</span>
      {children}
    </div>
  );
}

export default function MaterialsPage() {
  const toast = useToast();
  const { active, updateDesign, analysisOf } = useTarang();
  const [panelId, setPanelId] = useState("front");
  const source = active.panels.find((p) => p.id === panelId) ?? active.panels[0];
  const [edits, setEdits] = useState<{ id: string; draft: CabinetPanel } | null>(null);
  // Edits belong to one panel of one design; switching either starts from that panel again.
  const draft = edits && edits.id === `${active.id}:${source.id}` ? edits.draft : source;
  const setDraft = (patch: Partial<CabinetPanel>) => setEdits({ id: `${active.id}:${source.id}`, draft: { ...draft, ...patch } });
  const result = panelShielding(draft);
  const cabinet = analysisOf(active.id).shielding;
  const dirty = draft !== source;

  const columns: Column<Material>[] = [
    { key: "name", header: "Material", render: (m) => <span className="text-primary">{m.name}</span>, value: (m) => m.name },
    { key: "cls", header: "Class", render: (m) => m.cls, value: (m) => m.cls },
    { key: "se", header: "Shielding dB at 1 mm", align: "right", render: (m) => <span className="tabular">{m.shieldingDb}</span>, value: (m) => m.shieldingDb, card: "metric" },
    { key: "cond", header: "Conductive", render: (m) => <StatusBadge tone={m.conductive ? "success" : "neutral"}>{m.conductive ? "Yes" : "No"}</StatusBadge>, value: (m) => m.conductive },
    { key: "earth", header: "Earthable", render: (m) => <StatusBadge tone={m.earthable ? "success" : "neutral"}>{m.earthable ? "Yes" : "No"}</StatusBadge>, value: (m) => m.earthable },
    { key: "k", header: "k W/m·K", align: "right", render: (m) => <span className="tabular">{m.thermalK}</span>, value: (m) => m.thermalK },
    { key: "e", header: "Emissivity", align: "right", render: (m) => <span className="tabular">{m.emissivity.toFixed(2)}</span>, value: (m) => m.emissivity, hide: "md" },
    { key: "note", header: "Use", render: (m) => <span title={m.note}>{m.note}</span>, value: (m) => m.note, hide: "lg", card: false },
  ];

  const walk = result.steps.map((step, i) => ({
    ...step,
    after: Math.max(0, result.base + result.steps.slice(0, i + 1).reduce((sum, x) => sum + x.delta, 0)),
  }));

  return (
    <>
      <PageHeader
        title="Materials"
        description="Ten material classes and a calculator that walks one cabinet panel from its base shielding to what actually survives seams, fasteners and apertures."
        mark={<M mark={MARKS.materials} size={44} />}
        info={
          <InfoPopover label="First-order only">
            The calculator is a screening estimate: thickness as 20·log(t), seam and paint penalties from a table, screw pitch as
            20·log(pitch / 50 mm), aperture as 10·log(L / 50 mm). Above the leak frequency f = 150 / L(m) MHz the panel is credited 6 dB.
          </InfoPopover>
        }
      />
      <PageBody>
        <div className="flex flex-col gap-4">
          <SplitRow ratio="1/1.4">
            <Panel title="Panel calculator" action={<M mark={MARKS.panelCalc} size={24} />}>
              <div className="flex flex-col gap-1">
                <Row label={`Panel of ${active.product} ${active.version}`}>
                  <Select aria-label="Panel" value={source.id} onChange={(e) => setPanelId(e.target.value)} className={SELECT_CLASS}>
                    {active.panels.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </Row>
                <Row label="Material">
                  <Select aria-label="Material" value={draft.materialId} onChange={(e) => setDraft({ materialId: e.target.value })} className={SELECT_CLASS}>
                    {MATERIALS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </Select>
                </Row>
                <Row label="Thickness, mm">
                  <input aria-label="Thickness" type="number" step={0.1} min={0.3} max={4} value={draft.thicknessMm} onChange={(e) => setDraft({ thicknessMm: Math.max(0.3, Number(e.target.value) || 0.3) })} className={INPUT} />
                </Row>
                <Row label="Seams">
                  <Select aria-label="Seams" value={draft.seam} onChange={(e) => setDraft({ seam: e.target.value as CabinetPanel["seam"] })} className={SELECT_CLASS}>
                    <option value="welded">Welded</option>
                    <option value="overlapped">Overlapped</option>
                    <option value="butt">Butt joint</option>
                  </Select>
                </Row>
                <Row label="Screw pitch, mm">
                  <input aria-label="Screw pitch" type="number" step={10} min={20} max={400} value={draft.screwPitchMm} onChange={(e) => setDraft({ screwPitchMm: Math.max(20, Number(e.target.value) || 20) })} className={INPUT} />
                </Row>
                <Row label="Longest aperture, mm">
                  <input aria-label="Aperture" type="number" step={10} min={0} max={600} value={draft.apertureMm} onChange={(e) => setDraft({ apertureMm: Math.max(0, Number(e.target.value) || 0) })} className={INPUT} />
                </Row>
                <Toggle label="Paint masked at contact points" checked={draft.paintMasked} onChange={(v) => setDraft({ paintMasked: v })} />
                <Toggle label="Aperture screened with bonded mesh" checked={Boolean(draft.apertureScreened)} onChange={(v) => setDraft({ apertureScreened: v })} />
                <Toggle label="Earth bond fitted" hint="Does not change shielding; feeds R11 and R14" checked={draft.earthBonded} onChange={(v) => setDraft({ earthBonded: v })} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2 border-t border-muted pt-3">
                <Button
                  variant="primary"
                  disabled={!dirty}
                  onClick={() => {
                    updateDesign(active.id, (d) => ({ ...d, panels: d.panels.map((p) => (p.id === source.id ? draft : p)) }));
                    setEdits(null);
                    toast(`${source.name} updated in ${active.product} ${active.version}. The register has re-scored.`);
                  }}
                >
                  Apply to this panel
                </Button>
                <Button variant="ghost" disabled={!dirty} onClick={() => setEdits(null)}>
                  Revert
                </Button>
              </div>
            </Panel>

            <Panel title="From base shielding to what survives">
              {result.conductive ? (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <Figure label="Base at 1 mm" value={result.base} unit="dB" />
                    <Figure label="Effective" value={Math.round(result.effective)} unit="dB" tone={result.effective < 12 ? "text-error" : result.effective < 25 ? "text-warning" : "text-success"} />
                    <Figure label="Leak frequency" value={result.leakMHz ? Math.round(result.leakMHz) : "none"} unit={result.leakMHz ? "MHz" : undefined} hint={result.leakMHz ? "then 6 dB" : "no open aperture"} />
                  </div>
                  <ul className="mt-4 flex flex-col gap-2">
                    <li className="flex items-center gap-3">
                      <span className="w-44 shrink-0 truncate text-body-sm text-secondary">{MATERIAL_BY_ID[draft.materialId].name}</span>
                      <span className="block h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-raised-2">
                        <span className="block h-full rounded-full bg-info" style={{ width: `${(result.base / 50) * 100}%` }} />
                      </span>
                      <span className="w-16 shrink-0 text-right text-body-sm tabular text-primary">{result.base} dB</span>
                    </li>
                    {walk.map((step) => {
                      const after = step.after;
                      return (
                        <li key={step.label} className="flex items-center gap-3">
                          <span className="w-44 shrink-0 truncate text-body-sm text-tertiary">{step.label}</span>
                          <span className="block h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-raised-2">
                            <span className={`block h-full rounded-full ${step.delta < 0 ? "bg-warning" : "bg-info"}`} style={{ width: `${(after / 50) * 100}%` }} />
                          </span>
                          <span className="w-16 shrink-0 text-right text-body-sm tabular text-secondary">
                            {step.delta > 0 ? "+" : ""}
                            {step.delta.toFixed(1)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="mt-4 text-body-sm text-tertiary">
                    Cabinet as saved: {cabinet.effectiveDb} dB, limited by {cabinet.limitingPanel.toLowerCase()} ({cabinet.limitingAperture}). Below 12 dB the
                    engine raises aperture leakage (R12) for every clock source above 30 MHz.
                  </p>
                </>
              ) : (
                <p className="text-body-md text-tertiary">
                  {MATERIAL_BY_ID[draft.materialId].name} does not conduct, so the panel gives no shielding and cannot be earthed. Treat it as an
                  opening the size of the panel.
                </p>
              )}
              <Label className="mt-4">{dirty ? "Unsaved edits: apply to move the design" : "Showing the panel as saved"}</Label>
            </Panel>
          </SplitRow>

          <Panel title={`Material classes · ${MATERIALS.length}`} padded={false} className="h-[30rem]!">
            <DataTable
              rows={MATERIALS}
              columns={columns}
              rowKey={(m) => m.id}
              onRowClick={(m) => {
                setDraft({ materialId: m.id });
                toast(`${m.name} loaded into the calculator`, "info");
              }}
              isRowSelected={(m) => m.id === draft.materialId}
              searchPlaceholder="Search materials"
              exportName="tarang-materials"
              serial={false}
            />
          </Panel>
        </div>
      </PageBody>
    </>
  );
}
