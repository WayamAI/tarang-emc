"use client";

/**
 * Lab Readiness: for every test in the pre-compliance plan, the predicted
 * first-pass probability, the risks behind it, the cheapest fix that moves it
 * and a go / no-go call for the chamber booking.
 */

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { PageBody, PageHeader } from "@/components/layout/page-header";
import { RiskDrawer } from "@/components/tarang/risk-drawer";
import { Button, DesignPicker, Drawer, KeyValue, Label, LevelBadge, LinkButton, M } from "@/components/tarang/ui";
import { DataTable, type Column } from "@/components/ui/data-table";
import { InfoPopover } from "@/components/ui/info-popover";
import { KpiTile, Panel, SplitRow, StatusBadge } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { MARKS } from "@/lib/marks";
import { TEST_BY_ID } from "@/lib/tarang/catalog";
import { useTarang } from "@/lib/tarang/context";
import { dateShort, daysBetween, pct, STATUS_TONE, TODAY, usd, usdCompact } from "@/lib/tarang/format";
import { planFor, type Recommendation } from "@/lib/tarang/planner";
import { BOOKINGS, PEOPLE } from "@/lib/tarang/portfolio";
import { CALL_TONE, labReadiness, type ReadinessRow } from "@/lib/tarang/selectors";

function PBar({ p }: { p: number }) {
  const tone = p >= 0.8 ? "bg-success" : p >= 0.5 ? "bg-warning" : "bg-error";
  return (
    <span className="inline-flex items-center gap-2">
      <span className="w-9 text-right text-body-sm tabular text-primary">{pct(p)}</span>
      <span className="block h-1.5 w-14 overflow-hidden rounded-full bg-raised-2">
        <span className={`block h-full rounded-full ${tone}`} style={{ width: `${p * 100}%` }} />
      </span>
    </span>
  );
}

export default function LabReadinessPage() {
  const toast = useToast();
  const { active, analysisOf, plannedOf, override, whatIf, toggleWhatIf, statuses, setStatus } = useTarang();
  const analysis = analysisOf(active.id);
  const planned = plannedOf(active.id);
  const [openTest, setOpenTest] = useState<string | null>(null);
  const [riskKey, setRiskKey] = useState<string | null>(null);

  const rows = useMemo(() => {
    const recs = new Map<string, Recommendation[]>(planFor(active, analysis, override).map((p) => [p.risk.key, p.recs]));
    return labReadiness(active, analysis, planned.analysis, recs, override);
  }, [active, analysis, planned.analysis, override]);

  const expectedNow = rows.reduce((s, r) => s + r.expectedNow, 0);
  const expectedPlanned = rows.reduce((s, r) => s + r.expectedPlanned, 0);
  const allPassNow = rows.reduce((p, r) => p * r.pNow, 1);
  const allPassPlanned = rows.reduce((p, r) => p * r.pPlanned, 1);
  const holds = rows.filter((r) => r.call === "Hold").length;
  const gos = rows.filter((r) => r.call === "Go").length;
  const bookings = BOOKINGS.filter((b) => b.programId === active.programId);
  const open = rows.find((r) => r.test.id === openTest);

  const chart = rows
    .filter((r) => r.expectedNow > 500)
    .sort((a, b) => b.expectedNow - a.expectedNow)
    .map((r) => ({ name: r.test.short, now: Math.round(r.expectedNow), planned: Math.round(r.expectedPlanned) }));

  const columns: Column<ReadinessRow>[] = [
    { key: "test", header: "Test", render: (r) => <span className="text-primary">{r.test.name}</span>, value: (r) => r.test.name },
    { key: "status", header: "Status", render: (r) => <StatusBadge tone={STATUS_TONE[r.status]}>{r.status}</StatusBadge>, value: (r) => r.status, hide: "md" },
    { key: "pNow", header: "First-pass now", align: "right", render: (r) => <PBar p={r.pNow} />, value: (r) => r.pNow, card: "metric" },
    { key: "pPlanned", header: "With what-if", align: "right", render: (r) => (whatIf.length ? <PBar p={r.pPlanned} /> : <span className="text-quaternary">No fixes planned</span>), value: (r) => r.pPlanned },
    { key: "risks", header: "Risks behind it", render: (r) => (r.risks.length ? r.risks.map((x) => `#${x.num}`).join(" ") : <span className="text-quaternary">None</span>), value: (r) => r.risks.length },
    { key: "fix", header: "Cheapest fix that moves it", render: (r) => (r.cheapest ? `${r.cheapest.title} · ${usd(r.cheapest.designStageUsd)}` : <span className="text-quaternary">{r.risks.length ? "No single fix" : "Not needed"}</span>), value: (r) => r.cheapest?.title ?? "" },
    { key: "cost", header: "Lab cost", align: "right", render: (r) => <span className="tabular">{usd(r.labCostUsd)}</span>, value: (r) => r.labCostUsd, hide: "md" },
    { key: "exp", header: "Expected re-test", align: "right", render: (r) => <span className="tabular">{usd(r.expectedNow)}</span>, value: (r) => r.expectedNow, hide: "lg" },
    { key: "call", header: "Call", render: (r) => <StatusBadge tone={CALL_TONE[r.call]}>{r.call}</StatusBadge>, value: (r) => r.call },
  ];

  return (
    <>
      <PageHeader
        title="Lab Readiness"
        description={`${active.product} ${active.version}. Should the chamber be booked, and what does a failed slot cost if it is.`}
        mark={<M mark={MARKS.lab} size={44} />}
        info={
          <InfoPopover label="How the call is made">
            First-pass probability falls with the worst linked risk score and with each extra risk on the same test. Go at 80 % or better.
            Go after fix when the what-if tray lifts it to 80 %. Pre-scan first between 50 % and 80 %. Hold below 50 %. Expected re-test cost
            is (1 − probability) × (lab fee + re-spin cost of the top fix).
          </InfoPopover>
        }
        actions={
          <>
            <DesignPicker />
            <LinkButton href="/fixes" variant="primary">
              Plan fixes{whatIf.length ? ` · ${whatIf.length} in tray` : ""}
            </LinkButton>
          </>
        }
      />
      <PageBody>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiTile label="Expected re-test cost" value={usdCompact(expectedNow)} hint="as the design stands" tone="error" mark={<M mark={MARKS.respin} />} />
            <KpiTile
              label="After planned fixes"
              value={usdCompact(expectedPlanned)}
              delta={whatIf.length ? `−${usdCompact(expectedNow - expectedPlanned)}` : undefined}
              hint={whatIf.length ? `${whatIf.length} fixes in what-if` : "what-if tray is empty"}
              tone="success"
            />
            <KpiTile label="All tests first time" value={pct(allPassNow)} delta={whatIf.length ? `to ${pct(allPassPlanned)}` : undefined} hint={`${rows.length} tests in the plan`} tone="info" mark={<M mark={MARKS.firstPass} />} />
            <KpiTile label="Go / hold" value={`${gos} / ${holds}`} hint="tests ready to book vs held" tone={holds ? "warning" : "success"} mark={<M mark={MARKS.goNoGo} />} />
          </div>

          <SplitRow ratio="1.4/1">
            <Panel title="Where the re-test money is at risk">
              {chart.length ? (
                <div className="h-64 w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chart} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 8 }} barGap={2}>
                      <CartesianGrid stroke="var(--stroke-muted)" horizontal={false} />
                      <XAxis type="number" tick={{ fill: "var(--text-quaternary)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => usdCompact(v)} />
                      <YAxis type="category" interval={0} dataKey="name" width={132} tick={{ fill: "var(--text-quaternary)", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        cursor={{ fill: "var(--surface-raised)" }}
                        content={({ active: on, payload, label }) =>
                          on && payload?.length ? (
                            <div className="rounded-lg border border-muted bg-container px-2.5 py-1.5">
                              <p className="text-body-sm text-primary">{label}</p>
                              <p className="text-caption tabular text-tertiary">Now {usd(Number(payload[0].payload.now))}</p>
                              <p className="text-caption tabular text-tertiary">With what-if {usd(Number(payload[0].payload.planned))}</p>
                            </div>
                          ) : null
                        }
                      />
                      <Bar dataKey="now" name="Now" fill="var(--feedback-error-icon)" radius={[0, 3, 3, 0]} barSize={9} isAnimationActive={false} />
                      <Bar dataKey="planned" name="With what-if" fill="var(--feedback-success-icon)" radius={[0, 3, 3, 0]} barSize={9} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-body-md text-tertiary">No test carries more than $500 of expected re-test cost.</p>
              )}
              <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-quaternary">
                <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-[2px] bg-error" /> As the design stands</span>
                <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-[2px] bg-success" /> With the what-if tray applied</span>
              </p>
            </Panel>

            <Panel title={`Chamber bookings · ${bookings.length}`} action={<M mark={MARKS.booking} size={24} />}>
              {bookings.length ? (
                <ul className="flex flex-col gap-2.5">
                  {bookings.map((booking) => {
                    const booked = rows.filter((r) => booking.testIds.includes(r.test.id));
                    const held = booked.filter((r) => r.call === "Hold" || r.call === "Pre-scan first");
                    const status = statuses[booking.id];
                    const daysLeft = daysBetween(TODAY, booking.cancelBy);
                    return (
                      <li key={booking.id} className="rounded-md border border-muted bg-page p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-body-md text-primary">
                            {booking.id} · {dateShort(booking.date)} · {booking.days} days
                          </p>
                          <StatusBadge tone={status ? "info" : held.length ? "error" : "success"}>{status ?? (held.length ? "No-go as it stands" : "Go")}</StatusBadge>
                        </div>
                        <p className="mt-0.5 text-body-sm text-tertiary">
                          {booking.lab} · {booking.facility} · {usd(booking.costUsd)} · {booking.status.toLowerCase()}
                        </p>
                        <p className="mt-1.5 text-body-sm text-secondary">
                          {held.length
                            ? `${held.length} of ${booked.length} booked tests are not ready: ${held.map((r) => r.test.short).join(", ")}. Free cancellation ends ${dateShort(booking.cancelBy)}, in ${daysLeft} days.`
                            : `All ${booked.length} booked tests are at 80 % or better${booked.some((r) => r.call === "Go after fix") ? ", provided the what-if fixes are saved into the build that goes to the lab" : ""}.`}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Button
                            variant={held.length ? "primary" : "secondary"}
                            onClick={() => {
                              setStatus(booking.id, "Move requested");
                              toast(`Move request for ${booking.id} sent to ${PEOPLE.lab.name}, lab coordinator`);
                            }}
                          >
                            Request move
                          </Button>
                          <Button
                            onClick={() => {
                              setStatus(booking.id, "Slot kept");
                              toast(`${booking.id} kept. ${PEOPLE.lead.name} is recorded as accepting the risk.`, "info");
                            }}
                          >
                            Keep slot
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-body-md text-tertiary">No chamber slot is booked for this programme yet.</p>
              )}
            </Panel>
          </SplitRow>

          <Panel title={`Test-by-test readiness · ${rows.length}`} padded={false} className="h-[32rem]!">
            <DataTable
              rows={rows}
              columns={columns}
              rowKey={(r) => r.test.id}
              onRowClick={(r) => setOpenTest(r.test.id)}
              isRowSelected={(r) => r.test.id === openTest}
              defaultSort={{ key: "pNow", dir: "asc" }}
              searchPlaceholder="Search tests, fixes"
              exportName={`tarang-lab-readiness-${active.id}`}
              serial={false}
            />
          </Panel>
        </div>
      </PageBody>

      <Drawer
        open={Boolean(open)}
        onClose={() => setOpenTest(null)}
        title={open?.test.name ?? ""}
        subtitle={open ? `${open.standards.join(" · ")} · ${open.markets.join(" + ")}` : undefined}
        footer={
          open?.cheapest ? (
            <Button
              variant="primary"
              onClick={() => {
                const rec = open.cheapest;
                if (!rec) return;
                const applied = whatIf.includes(rec.instance);
                toggleWhatIf(active.id, rec.instance);
                toast(applied ? `Removed from what-if: ${rec.title}` : `Added to what-if: ${rec.title}`, applied ? "info" : "success");
              }}
            >
              {whatIf.includes(open.cheapest.instance) ? "Remove cheapest fix from what-if" : "Apply cheapest fix to what-if"}
            </Button>
          ) : (
            <LinkButton href="/fixes">Open Fix Planner</LinkButton>
          )
        }
      >
        {open ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={CALL_TONE[open.call]}>{open.call}</StatusBadge>
              <StatusBadge tone={STATUS_TONE[open.status]}>{open.status}</StatusBadge>
            </div>
            <p className="text-body-md text-secondary">{TEST_BY_ID[open.test.id].method}</p>
            <div className="rounded-md border border-muted bg-raised px-3 py-2">
              <KeyValue k="First-pass now" v={pct(open.pNow)} />
              <KeyValue k="With what-if tray" v={pct(open.pPlanned)} />
              <KeyValue k="Lab fee" v={usd(open.labCostUsd)} />
              <KeyValue k="Re-spin if it fails" v={`${usd(open.respinUsd)} · ${open.delayWeeks} wk`} />
              <KeyValue k="Expected re-test cost" v={usd(open.expectedNow)} />
              <KeyValue k="Facility" v={open.test.facility} />
            </div>
            <div>
              <Label>Risks behind the number</Label>
              {open.risks.length ? (
                <ul className="mt-1.5 flex flex-col gap-1.5">
                  {open.risks.map((risk) => (
                    <li key={risk.key}>
                      <button
                        type="button"
                        onClick={() => {
                          setOpenTest(null);
                          setRiskKey(risk.key);
                        }}
                        className="flex w-full items-start gap-2.5 rounded-md border border-muted px-2.5 py-2 text-left outline-none transition-colors duration-[150ms] hover:bg-raised focus-visible:ring-2 focus-visible:ring-active"
                      >
                        <span className="w-7 shrink-0 text-body-md tabular text-primary">{risk.score}</span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-1.5 text-body-sm text-primary">
                            #{risk.num} {risk.aggressor} → {risk.victim} <LevelBadge level={risk.level} />
                          </span>
                          <span className="block text-caption text-quaternary">{risk.coupling}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-body-sm text-tertiary">No scored risk links to this test.</p>
              )}
            </div>
            {open.cheapest ? (
              <div>
                <Label>Cheapest fix that moves it</Label>
                <p className="mt-1 text-body-md text-primary">{open.cheapest.title}</p>
                <p className="mt-0.5 text-body-sm text-tertiary">
                  {usd(open.cheapest.designStageUsd)} at layout, risk #{open.cheapest.riskNum} from {open.cheapest.before} to {open.cheapest.after}.{" "}
                  {open.cheapest.provenBy ? `Proven by ${open.cheapest.provenBy.id}.` : "Not yet proven by a retest: pre-scan before booking."}
                </p>
              </div>
            ) : null}
            <p className="text-caption text-quaternary">
              The call is a recommendation. {PEOPLE.lead.name}, {PEOPLE.lead.role}, decides whether the slot is kept.
            </p>
          </div>
        ) : null}
      </Drawer>
      <RiskDrawer designId={active.id} riskKey={riskKey} onClose={() => setRiskKey(null)} />
    </>
  );
}
