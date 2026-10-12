"use client";

import { Check, Plus } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { StatusBadge } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { MARKS } from "@/lib/marks";
import { RULE_BY_ID, TEST_BY_ID } from "@/lib/tarang/catalog";
import { useTarang } from "@/lib/tarang/context";
import { usd } from "@/lib/tarang/format";
import { REPORT_BY_ID } from "@/lib/tarang/history";
import { recommendationsFor, type Recommendation } from "@/lib/tarang/planner";
import type { Risk } from "@/lib/tarang/types";

import { Button, Drawer, Label, LevelBadge, LinkButton, M, ScoreBar } from "./ui";

/** How the engine arrived at a score, line by line. */
export function ScoreBuildUp({ risk }: { risk: Risk }) {
  const modSum = risk.modifiers.reduce((s, m) => s + m.value, 0);
  const clamped = Math.min(1, Math.max(0, risk.factor + modSum));
  const rows: [string, string][] = [
    [`Rule factor (${risk.rule})`, risk.factor.toFixed(3)],
    ...risk.modifiers.map((m): [string, string] => [m.label, `${m.value > 0 ? "+" : ""}${m.value.toFixed(2)}`]),
    ["Clamped to 0..1", clamped.toFixed(3)],
    [`Impact weight (${risk.impactBasis})`, `× ${risk.impact.toFixed(1)}`],
    ["Lab history adjustment", risk.historyAdj ? `+${risk.historyAdj}` : "0"],
  ];
  return (
    <div className="rounded-md border border-muted bg-raised px-3 py-2">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-baseline justify-between gap-3 py-0.5">
          <span className="min-w-0 truncate text-body-sm text-tertiary">{k}</span>
          <span className="shrink-0 text-body-sm tabular text-secondary">{v}</span>
        </div>
      ))}
      <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-muted pt-1.5">
        <span className="text-body-sm text-primary">Score</span>
        <span className="font-display text-display-base tabular text-primary">{risk.score}</span>
      </div>
    </div>
  );
}

export function RecommendationRow({
  rec,
  designId,
  compact = false,
}: {
  rec: Recommendation;
  designId: string;
  compact?: boolean;
}) {
  const { whatIfOf, toggleWhatIf } = useTarang();
  const toast = useToast();
  const applied = whatIfOf(designId).includes(rec.instance);
  return (
    <div className="flex flex-col gap-2 rounded-md border border-muted bg-page px-3 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge tone="neutral">{rec.fix.type}</StatusBadge>
            {rec.provenBy ? (
              <Link href={`/test-history?report=${rec.provenBy.id}`} className="inline-flex">
                <StatusBadge tone="success">Proven · {rec.provenBy.id}</StatusBadge>
              </Link>
            ) : (
              <StatusBadge tone="warning">Unproven</StatusBadge>
            )}
          </div>
          <p className="mt-1.5 text-body-md text-primary">{rec.title}</p>
          {!compact ? <p className="mt-0.5 text-body-sm text-tertiary">{rec.fix.detail}</p> : null}
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display text-display-base tabular text-success">−{rec.before - rec.after}</p>
          <p className="text-caption tabular text-quaternary">
            {rec.before} to {rec.after}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-caption text-quaternary">
          <span className="tabular text-tertiary">{usd(rec.designStageUsd)}</span> now, {rec.fix.effortHours} h ·{" "}
          <span className="tabular text-tertiary">{usd(rec.fix.postLabCostUsd)}</span> and {rec.fix.postLabWeeks} wk after a lab fail
          {rec.sideEffects.length ? ` · also moves ${rec.sideEffects.map((s) => `#${s.num}`).join(", ")}` : ""}
        </p>
        <Button
          variant={applied ? "secondary" : "primary"}
          onClick={() => {
            toggleWhatIf(designId, rec.instance);
            toast(applied ? `Removed from what-if: ${rec.title}` : `Added to what-if: ${rec.title}`, applied ? "info" : "success");
          }}
        >
          {applied ? <Check size={13} strokeWidth={1.75} aria-hidden /> : <Plus size={13} strokeWidth={1.75} aria-hidden />}
          {applied ? "In what-if" : "Apply to what-if"}
        </Button>
      </div>
    </div>
  );
}

export function RiskDrawer({
  designId,
  riskKey,
  onClose,
}: {
  designId: string;
  riskKey: string | null;
  onClose: () => void;
}) {
  const { designById, analysisOf, override } = useTarang();
  const design = designById(designId);
  const analysis = analysisOf(designId);
  const risk = riskKey ? analysis.risks.find((r) => r.key === riskKey) : undefined;
  const recs = useMemo(
    () => (design && risk ? recommendationsFor(design, analysis, risk, override) : []),
    [design, analysis, risk, override],
  );

  if (!riskKey) return null;
  if (!risk || !design) {
    return (
      <Drawer open onClose={onClose} title="Risk cleared" subtitle="This coupling no longer scores 10 or more in the selected design.">
        <p className="text-body-md text-secondary">
          The design changed since this risk was listed. Open the register to see what remains.
        </p>
      </Drawer>
    );
  }

  const rule = RULE_BY_ID[risk.rule];
  return (
    <Drawer
      open
      onClose={onClose}
      title={`#${risk.num} ${risk.aggressor} → ${risk.victim}`}
      subtitle={
        <span className="flex flex-wrap items-center gap-2">
          <span>{risk.mechanism}</span>
          <LevelBadge level={risk.level} />
          <ScoreBar score={risk.score} level={risk.level} />
        </span>
      }
      footer={
        <>
          <LinkButton href={`/fixes?risk=${encodeURIComponent(risk.key)}`} variant="primary">
            Open in Fix Planner
          </LinkButton>
          <LinkButton href={`/workspace/${design.id}?select=${risk.victim}`}>Show in workspace</LinkButton>
          <LinkButton href={`/libraries/rules?rule=${risk.rule}`} variant="ghost">
            Rule {risk.rule}
          </LinkButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <section>
          <Label>Coupling path</Label>
          <p className="mt-1 text-body-md text-primary">{risk.coupling}</p>
          <p className="mt-1 text-body-sm text-tertiary">
            {rule.path} path. {rule.assumption}
          </p>
        </section>

        <section>
          <Label className="mb-1.5">Score build-up</Label>
          <ScoreBuildUp risk={risk} />
        </section>

        <section>
          <Label>Tests at risk</Label>
          {risk.testIds.length ? (
            <ul className="mt-1.5 flex flex-col gap-1">
              {risk.testIds.map((id) => (
                <li key={id} className="flex items-baseline justify-between gap-3">
                  <Link href="/compliance" className="min-w-0 truncate text-body-sm text-secondary underline-offset-2 hover:underline">
                    {TEST_BY_ID[id].name}
                  </Link>
                  <span className="shrink-0 text-caption text-quaternary">{TEST_BY_ID[id].facility}</span>
                </li>
              ))}
              <li className="text-caption text-quaternary">{risk.standards.join(" · ")}</li>
            </ul>
          ) : (
            <p className="mt-1 text-body-sm text-tertiary">
              No regulatory test in the selected markets. Scored as a functional risk at weight 0.7.
            </p>
          )}
        </section>

        <section>
          <Label>Matching lab history</Label>
          {risk.matches.length ? (
            <ul className="mt-1.5 flex flex-col gap-1.5">
              {risk.matches.map((m) => {
                const report = REPORT_BY_ID[m.reportId];
                return (
                  <li key={m.reportId}>
                    <Link
                      href={`/test-history?report=${m.reportId}`}
                      className="flex items-start gap-2.5 rounded-md border border-muted px-2.5 py-2 transition-colors duration-[150ms] hover:bg-raised"
                    >
                      <StatusBadge tone={m.result === "fail" ? "error" : "success"}>{m.result === "fail" ? "Fail" : "Pass"}</StatusBadge>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body-sm text-primary">
                          {report.id} · {report.product} · {report.test}
                        </span>
                        <span className="block truncate text-caption text-quaternary">{report.rootCause}</span>
                      </span>
                      <span className="shrink-0 text-caption tabular text-tertiary">J {m.jaccard.toFixed(2)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-1 text-body-sm text-tertiary">No past report shares at least half of this risk&apos;s condition tags.</p>
          )}
          <p className="mt-1.5 text-caption text-quaternary">Tags: {risk.tags.join(" · ")}</p>
        </section>

        <section>
          <div className="mb-1.5 flex items-center gap-2">
            <M mark={MARKS.proven} size={22} />
            <Label>Ranked fixes, re-scored by the engine</Label>
          </div>
          {recs.length ? (
            <div className="flex flex-col gap-2">
              {recs.slice(0, 3).map((rec) => (
                <RecommendationRow key={rec.instance} rec={rec} designId={design.id} compact />
              ))}
            </div>
          ) : (
            <p className="text-body-sm text-tertiary">No catalogue fix lowers this score. Raise it at the design review.</p>
          )}
        </section>
      </div>
    </Drawer>
  );
}
