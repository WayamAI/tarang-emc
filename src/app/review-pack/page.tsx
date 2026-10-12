"use client";

/** Design review pack: a print-ready document generated from the current state of the design in scope. */

import { Printer, Send } from "lucide-react";
import { useMemo } from "react";

import { PageBody, PageHeader } from "@/components/layout/page-header";
import { Heatmap } from "@/components/tarang/heatmap";
import { Button, DesignPicker, Label, LevelBadge, LinkButton, M } from "@/components/tarang/ui";
import { StatusBadge } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { MARKS } from "@/lib/marks";
import { MARKET_BY_ID, RULE_BY_ID } from "@/lib/tarang/catalog";
import { useTarang } from "@/lib/tarang/context";
import { parseFixInstance } from "@/lib/tarang/fixes";
import { dateShort, pct, STATUS_TONE, TODAY, TONE_TEXT, toneForIndex } from "@/lib/tarang/format";
import { planFor } from "@/lib/tarang/planner";
import { PEOPLE, PROGRAM_BY_ID, TENANT } from "@/lib/tarang/portfolio";
import { complianceMatrix, firstPassByMarket, OUTCOME_TONE } from "@/lib/tarang/selectors";

function Heading({ n, children }: { n: number; children: string }) {
  return (
    <h3 className="mt-7 mb-2 flex items-baseline gap-2 border-b border-muted pb-1.5 text-heading-sm text-primary">
      <span className="tabular text-quaternary">{n}</span> {children}
    </h3>
  );
}

const TH = "px-2 py-1.5 text-left text-caption font-medium tracking-[0.08em] text-quaternary uppercase";
const TD = "px-2 py-1.5 align-top text-body-sm text-secondary";

export default function ReviewPackPage() {
  const toast = useToast();
  const { active, analysisOf, override, overrideActive, whatIf, signOffs, signOff, statuses, setStatus } = useTarang();
  const analysis = analysisOf(active.id);
  const plan = useMemo(() => planFor(active, analysis, override), [active, analysis, override]);
  const matrix = useMemo(() => complianceMatrix(active, analysis, override), [active, analysis, override]);
  const firstPass = firstPassByMarket(active, analysis, override);
  const program = PROGRAM_BY_ID[active.programId];
  const signed = signOffs[active.id];
  const signedStale = signed && signed.index !== analysis.index;
  const sent = statuses[`pack-${active.id}`];
  const docNo = `DRP-${active.id.toUpperCase()}-${TODAY.replace(/-/g, "")}`;
  const rulesUsed = [...new Set(analysis.risks.map((r) => r.rule))].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));

  const verdict =
    analysis.counts.High > 0
      ? `Not ready for lab entry. ${analysis.counts.High} High risk${analysis.counts.High > 1 ? "s" : ""} would more likely than not fail a mandatory test.`
      : analysis.counts.Medium > 0
        ? `Ready for pre-scan. No High risk remains; ${analysis.counts.Medium} Medium risk${analysis.counts.Medium > 1 ? "s" : ""} should be confirmed on the bench before the chamber slot.`
        : "Ready for lab entry. No risk scores above Low.";

  return (
    <>
      <PageHeader
        title="Review Pack"
        description="The document that goes to the design review. It is generated from the live state, so it never disagrees with the register."
        mark={<M mark={MARKS.reviewPack} size={44} />}
        actions={
          <>
            <DesignPicker />
            <Button
              onClick={() => {
                setStatus(`pack-${active.id}`, `Sent ${dateShort(TODAY)}`);
                toast(`${docNo} sent to ${PEOPLE.lead.name}, ${PEOPLE.architect.name} and ${program.engineer}`);
              }}
            >
              <Send size={13} strokeWidth={1.75} aria-hidden /> {sent ? "Send again" : "Send for review"}
            </Button>
            <Button variant="primary" onClick={() => window.print()}>
              <Printer size={13} strokeWidth={1.75} aria-hidden /> Print
            </Button>
          </>
        }
      />
      <PageBody>
        <article className="mx-auto w-full max-w-[56rem] min-w-0 rounded-lg border border-muted bg-container px-5 py-6 sm:px-10 sm:py-9">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-default pb-4">
            <div className="min-w-0">
              <Label>{TENANT} · EMC design review pack</Label>
              <h2 className="mt-1 font-display text-display-xl text-primary">
                {active.product} {active.version}
              </h2>
              <p className="mt-1 text-body-md text-tertiary">
                {program.kind} · {active.note} · {active.markets.map((m) => MARKET_BY_ID[m].label).join(", ")}
              </p>
            </div>
            <dl className="grid shrink-0 grid-cols-[auto_auto] gap-x-4 gap-y-0.5 text-body-sm">
              <dt className="text-quaternary">Document</dt>
              <dd className="tabular text-secondary">{docNo}</dd>
              <dt className="text-quaternary">Generated</dt>
              <dd className="tabular text-secondary">{dateShort(TODAY)}</dd>
              <dt className="text-quaternary">Prepared by</dt>
              <dd className="text-secondary">{program.engineer}</dd>
              <dt className="text-quaternary">PLM record</dt>
              <dd className="tabular text-secondary">{program.plm}</dd>
              <dt className="text-quaternary">Status</dt>
              <dd>{sent ? <StatusBadge tone="info">{sent}</StatusBadge> : <StatusBadge tone="neutral">Draft</StatusBadge>}</dd>
            </dl>
          </header>

          <Heading n={1}>Summary</Heading>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <Label>Risk index</Label>
              <p className={`font-display text-display-2xl tabular ${TONE_TEXT[toneForIndex(analysis.index)]}`}>{analysis.index}</p>
            </div>
            <div>
              <Label>High / Medium / Low</Label>
              <p className="font-display text-display-2xl tabular text-primary">
                {analysis.counts.High} / {analysis.counts.Medium} / {analysis.counts.Low}
              </p>
            </div>
            {active.markets.slice(0, 2).map((m) => (
              <div key={m}>
                <Label>First-pass, {m}</Label>
                <p className="font-display text-display-2xl tabular text-primary">{pct(firstPass[m] ?? 0)}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-body-md text-secondary">{verdict}</p>
          {overrideActive ? <p className="mt-1 text-body-sm text-warning">Scores include a simulated standards change. Reset it before issuing this pack.</p> : null}
          {whatIf.length ? (
            <p className="mt-1 text-body-sm text-tertiary">
              {whatIf.length} what-if fixes are planned but not saved. They are listed in section 6 and are not counted in the figures above.
            </p>
          ) : null}

          <Heading n={2}>Top risks</Heading>
          <div className="min-w-0 overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse">
              <thead>
                <tr className="border-b border-muted">
                  <th className={TH}>ID</th>
                  <th className={TH}>Path</th>
                  <th className={TH}>Mechanism and evidence</th>
                  <th className={`${TH} text-right`}>Score</th>
                  <th className={TH}>Level</th>
                  <th className={TH}>Recommended fix</th>
                </tr>
              </thead>
              <tbody>
                {plan.slice(0, 6).map(({ risk, recs }) => (
                  <tr key={risk.key} className="border-b border-muted last:border-b-0">
                    <td className={`${TD} tabular`}>#{risk.num}</td>
                    <td className={`${TD} whitespace-nowrap tabular text-primary`}>
                      {risk.aggressor} → {risk.victim}
                    </td>
                    <td className={TD}>
                      {risk.mechanism}: {risk.coupling}
                      {risk.standards.length ? <span className="block text-caption text-quaternary">{risk.standards.join(", ")}</span> : null}
                    </td>
                    <td className={`${TD} text-right tabular text-primary`}>{risk.score}</td>
                    <td className={TD}>
                      <LevelBadge level={risk.level} />
                    </td>
                    <td className={TD}>
                      {recs[0] ? (
                        <>
                          {recs[0].title}
                          <span className="block text-caption text-quaternary">
                            {recs[0].fix.type}, to {recs[0].after}, {recs[0].provenBy ? `proven by ${recs[0].provenBy.id}` : "unproven"}
                          </span>
                        </>
                      ) : (
                        "None in catalogue"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!plan.length ? <p className="text-body-md text-tertiary">No risk scores 10 or more.</p> : null}

          <Heading n={3}>Aggressor × victim heatmap</Heading>
          <Heatmap analysis={analysis} />

          <Heading n={4}>Compliance outcome</Heading>
          <div className="min-w-0 overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse">
              <thead>
                <tr className="border-b border-muted">
                  <th className={TH}>Test</th>
                  {active.markets.map((m) => (
                    <th key={m} className={TH}>
                      {m}
                    </th>
                  ))}
                  <th className={TH}>Predicted</th>
                </tr>
              </thead>
              <tbody>
                {matrix.map((row) => (
                  <tr key={row.test.id} className="border-b border-muted last:border-b-0">
                    <td className={`${TD} text-primary`}>{row.test.name}</td>
                    {active.markets.map((m) => {
                      const c = row.cells[m];
                      return (
                        <td key={m} className={TD}>
                          {c ? (
                            <span className="flex flex-col items-start gap-0.5">
                              <StatusBadge tone={STATUS_TONE[c.status]}>{c.status}</StatusBadge>
                              <span className="text-caption text-quaternary">{c.standard}</span>
                            </span>
                          ) : (
                            <span className="text-quaternary">Not required</span>
                          )}
                        </td>
                      );
                    })}
                    <td className={TD}>
                      <StatusBadge tone={OUTCOME_TONE[Object.values(row.cells)[0].outcome]}>{Object.values(row.cells)[0].outcome}</StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Heading n={5}>Open assumptions</Heading>
          <ul className="flex flex-col gap-1.5">
            <li className="text-body-sm text-secondary">
              <span className="text-primary">Cabinet shielding.</span> {analysis.shielding.effectiveDb} dB first-order estimate
              {analysis.shielding.leakMHz ? `, useful below about ${analysis.shielding.leakMHz} MHz then ${analysis.shielding.aboveLeakDb} dB` : ""}. Limiting aperture:{" "}
              {analysis.shielding.limitingAperture}. Not a measured value.
            </li>
            {rulesUsed.map((id) => (
              <li key={id} className="text-body-sm text-secondary">
                <span className="text-primary">
                  {id} {RULE_BY_ID[id].name}.
                </span>{" "}
                {RULE_BY_ID[id].assumption}
              </li>
            ))}
            <li className="text-body-sm text-secondary">
              <span className="text-primary">Lab history.</span> Adjustments rest on 30 reports from five product families; a match is a shared
              set of condition tags, not an identical build.
            </li>
          </ul>

          <Heading n={6}>Changes in this version and planned</Heading>
          {active.appliedFixes.length ? (
            <ul className="flex list-disc flex-col gap-0.5 pl-5">
              {active.appliedFixes.map((instance) => {
                const parsed = parseFixInstance(instance);
                return (
                  <li key={instance} className="text-body-sm text-secondary">
                    {parsed ? `${parsed.fix.type}: ${parsed.fix.title(parsed.target, active)}` : instance}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-body-sm text-tertiary">No fixes are folded into this version. It is the layout as designed.</p>
          )}
          {whatIf.length ? (
            <>
              <Label className="mt-3 mb-1">Planned in the what-if tray, not saved</Label>
              <ul className="flex list-disc flex-col gap-0.5 pl-5">
                {whatIf.map((instance) => {
                  const parsed = parseFixInstance(instance);
                  return (
                    <li key={instance} className="text-body-sm text-tertiary">
                      {parsed ? `${parsed.fix.type}: ${parsed.fix.title(parsed.target, active)}` : instance}
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}

          <Heading n={7}>Sign-off</Heading>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-muted p-3">
              <Label>Responsible EMC engineer</Label>
              <p className="mt-1 text-body-md text-primary">{program.engineer}</p>
              <p className="text-body-sm text-tertiary">Prepared the layout analysis and the fix plan. Generated {dateShort(TODAY)}.</p>
            </div>
            <div className="rounded-md border border-muted p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Label>Approval, {PEOPLE.lead.role}</Label>
                  <p className="mt-1 text-body-md text-primary">{PEOPLE.lead.name}</p>
                </div>
                <M mark={MARKS.signOff} size={28} />
              </div>
              {signed ? (
                <p className={`mt-1 text-body-sm ${signedStale ? "text-warning" : "text-success"}`}>
                  {signedStale
                    ? `Signed ${dateShort(signed.at)} at index ${signed.index}. The design has changed to ${analysis.index}: sign again.`
                    : `Signed ${dateShort(signed.at)} at index ${signed.index}.`}
                </p>
              ) : (
                <p className="mt-1 text-body-sm text-tertiary">Not signed. The pack is a recommendation until the EMC lead signs.</p>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  variant={signed && !signedStale ? "secondary" : "primary"}
                  onClick={() => {
                    signOff(active.id);
                    toast(`${active.product} ${active.version} signed off by ${PEOPLE.lead.name} at index ${analysis.index}`);
                  }}
                >
                  {signed ? "Sign again" : "Sign off"}
                </Button>
                {analysis.counts.High ? <LinkButton href="/fixes">Resolve Highs first</LinkButton> : null}
              </div>
            </div>
          </div>
          <p className="mt-6 border-t border-muted pt-3 text-caption text-quaternary">
            Tarang predicts coupling risk from layout. It does not replace an accredited test. {docNo}.
          </p>
        </article>
      </PageBody>
    </>
  );
}
