"use client";

/**
 * Compliance Matrix: test requirements against the markets the design ships
 * to. Each cell carries the requirement status, the standard and the outcome
 * predicted from the worst linked risk.
 */

import { useMemo, useState } from "react";

import { PageBody, PageHeader } from "@/components/layout/page-header";
import { RiskDrawer } from "@/components/tarang/risk-drawer";
import { DesignPicker, Drawer, KeyValue, Label, LevelBadge, LinkButton, M } from "@/components/tarang/ui";
import { DataTable, type Column } from "@/components/ui/data-table";
import { InfoPopover } from "@/components/ui/info-popover";
import { KpiTile, Panel, StatusBadge } from "@/components/ui/primitives";
import { MARKS } from "@/lib/marks";
import { MARKETS, MARKET_BY_ID } from "@/lib/tarang/catalog";
import { useTarang } from "@/lib/tarang/context";
import { pct, STATUS_TONE, usd } from "@/lib/tarang/format";
import { complianceMatrix, OUTCOME_TONE, passProbability, type ComplianceRow } from "@/lib/tarang/selectors";
import type { MarketId } from "@/lib/tarang/types";

const chip = (active: boolean) =>
  `inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-label-sm outline-none transition-colors duration-[150ms] focus-visible:ring-2 focus-visible:ring-active ${active ? "border-transparent bg-action-primary text-on-color" : "border-muted bg-action text-tertiary hover:border-default hover:text-primary"}`;

function prescanFor(row: ComplianceRow): string {
  const worst = row.worst;
  if (!worst) return "No pre-scan needed";
  if (row.test.group === "Emissions") return `LISN pre-scan with ${worst.aggressor} at full load`;
  if (row.test.group === "Radio") return `Near-field probe sweep around ${worst.victim} with the link active`;
  if (row.test.group === "Immunity") return `Bench ${row.test.short.replace(" immunity", "")} shot on ${worst.victim}`;
  return `Power analyser run on ${worst.aggressor}`;
}

export default function CompliancePage() {
  const { active, analysisOf, override, overrideActive, toggleMarket } = useTarang();
  const analysis = analysisOf(active.id);
  const rows = useMemo(() => complianceMatrix(active, analysis, override), [active, analysis, override]);
  const [cell, setCell] = useState<{ testId: string; market: MarketId } | null>(null);
  const [riskKey, setRiskKey] = useState<string | null>(null);

  const fail = rows.filter((r) => r.worst?.level === "High").length;
  const marginal = rows.filter((r) => r.worst?.level === "Medium").length;
  const clear = rows.length - fail - marginal;
  const openRow = cell ? rows.find((r) => r.test.id === cell.testId) : undefined;
  const openCell = cell && openRow ? openRow.cells[cell.market] : undefined;

  const planColumns: Column<ComplianceRow>[] = [
    { key: "test", header: "Test", render: (r) => <span className="text-primary">{r.test.name}</span>, value: (r) => r.test.name },
    { key: "group", header: "Group", render: (r) => r.test.group, value: (r) => r.test.group, hide: "md" },
    { key: "facility", header: "Facility", render: (r) => r.test.facility, value: (r) => r.test.facility },
    { key: "outcome", header: "Predicted", render: (r) => <StatusBadge tone={OUTCOME_TONE[r.cells[Object.keys(r.cells)[0] as MarketId]!.outcome]}>{r.cells[Object.keys(r.cells)[0] as MarketId]!.outcome}</StatusBadge>, value: (r) => r.worst?.score ?? 0 },
    { key: "p", header: "First-pass", align: "right", render: (r) => <span className="tabular">{pct(passProbability(r.risks))}</span>, value: (r) => passProbability(r.risks), card: "metric" },
    { key: "risks", header: "Risks", align: "right", render: (r) => <span className="tabular">{r.risks.length}</span>, value: (r) => r.risks.length },
    { key: "prescan", header: "Pre-compliance step", render: (r) => prescanFor(r), value: (r) => prescanFor(r) },
    { key: "cost", header: "Lab cost", align: "right", render: (r) => <span className="tabular">{usd(r.test.labCostUsd)}</span>, value: (r) => r.test.labCostUsd, hide: "md" },
  ];

  return (
    <>
      <PageHeader
        title="Compliance Matrix"
        description={`${active.product} ${active.version}. What each market requires, under which standard, and whether this layout is predicted to pass it.`}
        mark={<M mark={MARKS.compliance} size={44} />}
        info={
          <InfoPopover label="Reading the matrix">
            Mandatory tests weigh 1.0 in the score, verify 0.8, voluntary 0.6. The predicted outcome is the level of the worst risk linked to
            the test: High reads likely fail, Medium marginal, Low likely pass. A prediction, not a test result.
          </InfoPopover>
        }
        actions={
          <>
            <DesignPicker />
            <LinkButton href="/lab-readiness" variant="primary">
              Lab readiness
            </LinkButton>
            <LinkButton href="/review-pack">Review pack</LinkButton>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <Label className="mr-1">Markets</Label>
          {MARKETS.map((m) => (
            <button key={m.id} type="button" title={m.scheme} aria-pressed={active.markets.includes(m.id)} onClick={() => toggleMarket(active.id, m.id)} className={chip(active.markets.includes(m.id))}>
              {m.id} · {m.scheme.split(" ")[0]}
            </button>
          ))}
          {overrideActive ? <StatusBadge tone="warning">Simulated standards change in force</StatusBadge> : null}
        </div>
      </PageHeader>

      <PageBody>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiTile label="Tests in scope" value={String(rows.length)} hint={`${active.markets.length} markets`} />
            <KpiTile label="Likely fail" value={String(fail)} hint="a High risk is linked" tone="error" mark={<M mark={MARKS.highRisk} />} />
            <KpiTile label="Marginal" value={String(marginal)} hint="a Medium risk is linked" tone="warning" />
            <KpiTile label="Likely pass or clear" value={String(clear)} hint="Low or no linked risk" tone="success" mark={<M mark={MARKS.firstPass} />} />
          </div>

          <Panel title="Test requirements by market" padded={false} className="h-auto">
            <div className="min-w-0 overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-muted">
                    <th className="px-4 py-2 text-caption font-medium tracking-[0.08em] text-quaternary uppercase">Test requirement</th>
                    {active.markets.map((m) => (
                      <th key={m} className="px-3 py-2 text-caption font-medium tracking-[0.08em] text-quaternary uppercase">
                        {m} · {MARKET_BY_ID[m].label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.test.id} className="border-b border-muted last:border-b-0">
                      <th scope="row" className="max-w-[16rem] px-4 py-2.5 align-top font-normal">
                        <span className="block text-body-md text-primary">{row.test.name}</span>
                        <span className="block text-caption text-quaternary">
                          {row.test.group} · {row.test.facility}
                        </span>
                      </th>
                      {active.markets.map((m) => {
                        const c = row.cells[m];
                        if (!c) {
                          return (
                            <td key={m} className="px-3 py-2.5 align-top text-body-sm text-quaternary">
                              Not required
                            </td>
                          );
                        }
                        return (
                          <td key={m} className="p-1.5 align-top">
                            <button
                              type="button"
                              onClick={() => setCell({ testId: row.test.id, market: m })}
                              className="flex w-full min-w-[9.5rem] flex-col gap-1 rounded-md border border-transparent px-2 py-1.5 text-left outline-none transition-colors duration-[150ms] hover:border-muted hover:bg-raised focus-visible:ring-2 focus-visible:ring-active"
                            >
                              <span className="flex flex-wrap items-center gap-1.5">
                                <StatusBadge tone={STATUS_TONE[c.status]}>{c.status}</StatusBadge>
                                <StatusBadge tone={OUTCOME_TONE[c.outcome]}>{c.outcome}</StatusBadge>
                              </span>
                              <span className="text-body-sm text-secondary">{c.standard}</span>
                              <span className="text-caption tabular text-quaternary">
                                {c.risks.length ? `${c.risks.length} linked risk${c.risks.length > 1 ? "s" : ""}, worst ${c.worst?.score}` : "No linked risk"}
                              </span>
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Pre-compliance test plan" padded={false} className="h-[30rem]!">
            <DataTable
              rows={rows}
              columns={planColumns}
              rowKey={(r) => r.test.id}
              onRowClick={(r) => setCell({ testId: r.test.id, market: Object.keys(r.cells)[0] as MarketId })}
              defaultSort={{ key: "outcome", dir: "desc" }}
              searchPlaceholder="Search tests"
              exportName={`tarang-test-plan-${active.id}`}
              serial={false}
            />
          </Panel>
        </div>
      </PageBody>

      <Drawer
        open={Boolean(openRow && openCell)}
        onClose={() => setCell(null)}
        title={openRow?.test.name ?? ""}
        subtitle={openCell ? `${MARKET_BY_ID[openCell.market].label} · ${openCell.standard}` : undefined}
        footer={
          <>
            <LinkButton href="/lab-readiness" variant="primary">
              Go / no-go for this test
            </LinkButton>
            {openCell ? <LinkButton href={`/libraries/standards?std=${openCell.standardId}`}>Open standard</LinkButton> : null}
          </>
        }
      >
        {openRow && openCell ? (
          <div className="flex flex-col gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-1.5">
                <StatusBadge tone={STATUS_TONE[openCell.status]}>{openCell.status}</StatusBadge>
                <StatusBadge tone={OUTCOME_TONE[openCell.outcome]}>{openCell.outcome}</StatusBadge>
              </div>
              <p className="mt-2 text-body-md text-secondary">{openRow.test.method}</p>
            </div>
            <div className="rounded-md border border-muted bg-raised px-3 py-2">
              <KeyValue k="Scheme" v={MARKET_BY_ID[openCell.market].scheme} />
              <KeyValue k="Facility" v={openRow.test.facility} />
              <KeyValue k="Lab time" v={`${openRow.test.labDays} day${openRow.test.labDays === 1 ? "" : "s"}`} />
              <KeyValue k="Lab cost" v={usd(openRow.test.labCostUsd)} />
              <KeyValue k="Predicted first-pass" v={pct(passProbability(openRow.risks))} />
            </div>
            <div>
              <Label>Risks behind the prediction</Label>
              {openRow.risks.length ? (
                <ul className="mt-1.5 flex flex-col gap-1.5">
                  {openRow.risks.map((risk) => (
                    <li key={risk.key}>
                      <button
                        type="button"
                        onClick={() => {
                          setCell(null);
                          setRiskKey(risk.key);
                        }}
                        className="flex w-full items-start gap-2.5 rounded-md border border-muted px-2.5 py-2 text-left outline-none transition-colors duration-[150ms] hover:bg-raised focus-visible:ring-2 focus-visible:ring-active"
                      >
                        <span className="w-7 shrink-0 text-body-md tabular text-primary">{risk.score}</span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-1.5 text-body-sm text-primary">
                            #{risk.num} {risk.aggressor} → {risk.victim} <LevelBadge level={risk.level} />
                          </span>
                          <span className="block text-caption text-quaternary">
                            {risk.mechanism}: {risk.coupling}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-body-sm text-tertiary">No scored risk links to this test. The engine has no reason to expect a failure.</p>
              )}
            </div>
            <div>
              <Label>Pre-compliance step</Label>
              <p className="mt-1 text-body-md text-secondary">{prescanFor(openRow)}</p>
            </div>
          </div>
        ) : null}
      </Drawer>
      <RiskDrawer designId={active.id} riskKey={riskKey} onClose={() => setRiskKey(null)} />
    </>
  );
}
