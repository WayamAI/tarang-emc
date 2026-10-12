"use client";

/** Component library: the 22 templates the workspace places, with the electrical properties the rules read. */

import { Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { PageBody, PageHeader } from "@/components/layout/page-header";
import { Button, Drawer, KeyValue, Label, LinkButton, M } from "@/components/tarang/ui";
import { DataTable, FilterChips, type Column } from "@/components/ui/data-table";
import { Panel, StatusBadge } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { MARKS } from "@/lib/marks";
import { CATEGORY_LABEL, CATEGORY_ORDER, CATEGORY_TOKEN, TEMPLATES } from "@/lib/tarang/catalog";
import { useTarang } from "@/lib/tarang/context";
import type { ComponentTemplate } from "@/lib/tarang/types";

function role(t: ComponentTemplate): string {
  const aggressor = Boolean(t.nearFieldMm || t.conductedE0 || t.rippleClass || t.heaterW || t.rectifierW);
  const victim = Boolean(t.sensitivity);
  return aggressor && victim ? "Aggressor and victim" : aggressor ? "Aggressor" : victim ? "Victim" : "Passive";
}

function ComponentsLibrary() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const { designs, active, addPart } = useTarang();
  const [category, setCategory] = useState("all");
  const [openId, setOpenId] = useState<string | null>(TEMPLATES.find((t) => t.name === params.get("q"))?.id ?? null);
  const rows = category === "all" ? TEMPLATES : TEMPLATES.filter((t) => t.category === category);
  const open = TEMPLATES.find((t) => t.id === openId);
  const usedIn = open ? designs.filter((d) => d.parts.some((p) => p.templateId === open.id)) : [];

  const columns: Column<ComponentTemplate>[] = [
    {
      key: "name", header: "Template",
      render: (t) => (
        <span className="inline-flex items-center gap-2 text-primary">
          <span className="size-2 shrink-0 rounded-[2px]" style={{ background: `var(${CATEGORY_TOKEN[t.category]})` }} aria-hidden />
          {t.name}
        </span>
      ),
      value: (t) => t.name,
    },
    { key: "category", header: "Group", render: (t) => CATEGORY_LABEL[t.category], value: (t) => CATEGORY_LABEL[t.category] },
    { key: "prefix", header: "Ref", render: (t) => <span className="tabular">{t.prefix}</span>, value: (t) => t.prefix },
    { key: "size", header: "Size mm", render: (t) => <span className="tabular">{t.size.join(" × ")}</span>, value: (t) => t.size[0] * t.size[1] * t.size[2] },
    { key: "freq", header: "Switching / clock", render: (t) => t.freqLabel, value: (t) => t.freqLabel },
    { key: "power", header: "Power W", align: "right", render: (t) => <span className="tabular">{t.powerW ?? ""}</span>, value: (t) => t.powerW ?? 0, card: "metric" },
    { key: "keepout", header: "Keep-out mm", align: "right", render: (t) => <span className="tabular">{t.nearFieldMm ?? ""}</span>, value: (t) => t.nearFieldMm ?? 0, hide: "md" },
    { key: "role", header: "Role", render: (t) => <StatusBadge tone={role(t) === "Aggressor" ? "error" : role(t) === "Victim" ? "info" : role(t) === "Passive" ? "neutral" : "warning"}>{role(t)}</StatusBadge>, value: (t) => role(t) },
    { key: "used", header: "In designs", align: "right", render: (t) => <span className="tabular">{designs.filter((d) => d.parts.some((p) => p.templateId === t.id)).length}</span>, value: (t) => designs.filter((d) => d.parts.some((p) => p.templateId === t.id)).length, hide: "md" },
  ];

  return (
    <>
      <PageHeader
        title="Components"
        description="Templates carry the properties the rules read: switching and clock frequencies, keep-out distance, dissipation, sensitivity. Edit the instance in the workspace, not the template."
        mark={<M mark={MARKS.components} size={44} />}
        actions={<LinkButton href={`/workspace/${active.id}`}>Open workspace</LinkButton>}
      >
        <FilterChips
          options={[{ id: "all", label: "All", count: TEMPLATES.length }, ...CATEGORY_ORDER.map((c) => ({ id: c, label: CATEGORY_LABEL[c], count: TEMPLATES.filter((t) => t.category === c).length }))]}
          value={category}
          onChange={setCategory}
        />
      </PageHeader>
      <PageBody>
        <Panel title={`Templates · ${rows.length}`} padded={false} className="h-full min-h-[28rem]">
          <DataTable rows={rows} columns={columns} rowKey={(t) => t.id} onRowClick={(t) => setOpenId(t.id)} isRowSelected={(t) => t.id === openId} searchPlaceholder="Search templates" exportName="tarang-components" serial={false} />
        </Panel>
      </PageBody>

      <Drawer
        open={Boolean(open)}
        onClose={() => setOpenId(null)}
        title={open?.name ?? ""}
        subtitle={open ? `${CATEGORY_LABEL[open.category]} · ref prefix ${open.prefix}` : undefined}
        footer={
          open ? (
            <Button
              variant="primary"
              onClick={() => {
                const ref = addPart(active.id, open.id);
                if (ref) {
                  toast(`${ref} ${open.name} placed in ${active.product} ${active.version}`);
                  router.push(`/workspace/${active.id}?select=${ref}`);
                }
              }}
            >
              <Plus size={13} strokeWidth={1.75} aria-hidden /> Place in {active.product} {active.version}
            </Button>
          ) : null
        }
      >
        {open ? (
          <div className="flex flex-col gap-4">
            <p className="text-body-md text-secondary">{open.note}</p>
            <div className="rounded-md border border-muted bg-raised px-3 py-2">
              <KeyValue k="Envelope" v={`${open.size.join(" × ")} mm`} />
              <KeyValue k="Switching / clock" v={open.freqLabel} />
              {open.powerW ? <KeyValue k="Rated power" v={`${open.powerW} W`} /> : null}
              {open.dissipW ? <KeyValue k="Dissipation to air" v={`${open.dissipW} W`} /> : null}
              {open.nearFieldMm ? <KeyValue k="Near-field keep-out (R1)" v={`${open.nearFieldMm} mm`} /> : null}
              {open.conductedE0 ? <KeyValue k="Unfiltered fundamental (R3)" v={`${open.conductedE0} dBµV`} /> : null}
              {open.rippleClass ? <KeyValue k="Rail ripple class (R4)" v={open.rippleClass.toFixed(1)} /> : null}
              {open.victimBand ? <KeyValue k="Victim band (R6)" v={`${open.victimBand.lo} to ${open.victimBand.hi} ${open.victimBand.unit}`} /> : null}
              {open.tempLimitC ? <KeyValue k="Derated limit (R7)" v={`${open.tempLimitC}°C, self rise ${open.selfRiseC ?? 0}°C`} /> : null}
              {open.sensitivity ? <KeyValue k="Sensitivity" v={open.sensitivity} /> : null}
              {open.userAccessible ? <KeyValue k="User accessible (R8)" v="Yes" /> : null}
              {open.rectifierW ? <KeyValue k="Rectifier input (R10)" v={`${open.rectifierW} W`} /> : null}
              {open.heaterW ? <KeyValue k="Switched load (R9)" v={`${open.heaterW} W`} /> : null}
              {open.mainsPort ? <KeyValue k="Filter stages (R3)" v={String(open.filterStages ?? 0)} /> : null}
            </div>
            <div>
              <Label>Used in</Label>
              {usedIn.length ? (
                <ul className="mt-1.5 flex flex-col gap-1">
                  {usedIn.map((d) => (
                    <li key={d.id}>
                      <LinkButton href={`/workspace/${d.id}`} variant="ghost" className="-ml-3">
                        {d.product} {d.version} · {d.parts.filter((p) => p.templateId === open.id).map((p) => p.ref).join(", ")}
                      </LinkButton>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-body-sm text-tertiary">Not placed in any design yet.</p>
              )}
            </div>
          </div>
        ) : null}
      </Drawer>
    </>
  );
}

export default function ComponentsPage() {
  return (
    <Suspense>
      <ComponentsLibrary />
    </Suspense>
  );
}
