"use client";

/** Settings: session, appearance, notifications and the engine constants in force. */

import { useState } from "react";

import { PageBody, PageHeader } from "@/components/layout/page-header";
import { Button, KeyValue, Label, LinkButton, M, Toggle } from "@/components/tarang/ui";
import { Panel, SplitRow } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { useTheme } from "@/context/theme-context";
import { APP } from "@/lib/app";
import { MARKS } from "@/lib/marks";
import { HISTORY_ADJ, IMPACT_WEIGHT, LEVEL_BANDS, RULES, STANDARDS, TEMPLATES } from "@/lib/tarang/catalog";
import { useTarang } from "@/lib/tarang/context";
import { SEED_DESIGNS } from "@/lib/tarang/designs";
import { LAB_REPORTS } from "@/lib/tarang/history";
import { PEOPLE, TENANT } from "@/lib/tarang/portfolio";

const NOTIFY = [
  { id: "high", label: "A design gains a High risk", hint: "Sent to the responsible EMC engineer" },
  { id: "booking", label: "A chamber booking turns no-go", hint: "Sent to the EMC lead and the lab coordinator" },
  { id: "standards", label: "A watched standard changes", hint: "Sent to the EMC lead" },
  { id: "signoff", label: "A signed pack goes stale", hint: "Sent to whoever signed it" },
];

export default function SettingsPage() {
  const toast = useToast();
  const { theme, setTheme } = useTheme();
  const { designs, overrideActive, resetSession, signOffs } = useTarang();
  const [notify, setNotify] = useState<Record<string, boolean>>({ high: true, booking: true, standards: true, signoff: false });
  const added = designs.length - SEED_DESIGNS.length;

  return (
    <>
      <PageHeader title="Settings" description="Workspace preferences and the constants the rule engine runs on." mark={<M mark={MARKS.settings} size={44} />} />
      <PageBody>
        <div className="flex flex-col gap-4">
          <SplitRow ratio="1/1.4">
            <Panel title="Workspace">
              <KeyValue k="Tenant" v={TENANT} />
              <KeyValue k="Signed in as" v={APP.operator.name} />
              <KeyValue k="EMC lead" v={PEOPLE.lead.name} />
              <KeyValue k="Lab coordinator" v={PEOPLE.lab.name} />
              <Label className="mt-4 mb-1">Appearance</Label>
              <Toggle label="Dark theme" hint="The 3D view re-reads its colours when this changes" checked={theme === "dark"} onChange={(v) => setTheme(v ? "dark" : "light")} />
              <Label className="mt-4 mb-1">Notifications</Label>
              {NOTIFY.map((n) => (
                <Toggle
                  key={n.id}
                  label={n.label}
                  hint={n.hint}
                  checked={Boolean(notify[n.id])}
                  onChange={(v) => {
                    setNotify((m) => ({ ...m, [n.id]: v }));
                    toast(`${n.label}: ${v ? "on" : "off"}`, "info");
                  }}
                />
              ))}
            </Panel>

            <Panel title="Engine and session">
              <div className="grid grid-cols-2 gap-x-6 sm:grid-cols-4">
                <KeyValue k="Rules" v={RULES.length} />
                <KeyValue k="Templates" v={TEMPLATES.length} />
                <KeyValue k="Standards" v={STANDARDS.length} />
                <KeyValue k="Lab reports" v={LAB_REPORTS.length} />
              </div>
              <Label className="mt-4 mb-1">Constants in force</Label>
              <KeyValue k="High / Medium / Low thresholds" v={`${LEVEL_BANDS.high} / ${LEVEL_BANDS.medium} / ${LEVEL_BANDS.low}`} />
              <KeyValue k="Impact: mandatory / verify / voluntary / functional" v={`${IMPACT_WEIGHT.mandatory.toFixed(1)} / ${IMPACT_WEIGHT.verify} / ${IMPACT_WEIGHT.voluntary} / ${IMPACT_WEIGHT.functional}`} />
              <KeyValue k="History: overlap and points" v={`${HISTORY_ADJ.strong.jaccard} adds ${HISTORY_ADJ.strong.add}, ${HISTORY_ADJ.partial.jaccard} adds ${HISTORY_ADJ.partial.add}`} />
              <KeyValue k="Position snap" v="5 mm" />
              <LinkButton href="/libraries/rules" variant="ghost" className="-ml-3 mt-1">
                Open rules and assumptions
              </LinkButton>

              <Label className="mt-4 mb-1">This session</Label>
              <KeyValue k="Designs" v={`${designs.length}, ${added > 0 ? `${added} created here` : "all seeded"}`} />
              <KeyValue k="Simulated standards change" v={overrideActive ? "In force" : "None"} />
              <KeyValue k="Packs signed" v={Object.keys(signOffs).length} />
              <p className="mt-2 text-body-sm text-tertiary">
                Edits, saved versions, what-if trays and sign-offs live in this browser session. Resetting returns every design to its seeded
                layout.
              </p>
              <div className="mt-3">
                <Button
                  onClick={() => {
                    resetSession();
                    toast("Session reset to the seeded designs and the published standards", "info");
                  }}
                >
                  Reset session
                </Button>
              </div>
            </Panel>
          </SplitRow>
        </div>
      </PageBody>
    </>
  );
}
