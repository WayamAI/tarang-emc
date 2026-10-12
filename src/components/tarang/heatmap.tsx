"use client";

import { LEVEL_TONE, TONE_VAR } from "@/lib/tarang/format";
import { heatmap } from "@/lib/tarang/selectors";
import type { Analysis } from "@/lib/tarang/types";

/** Aggressor × victim matrix. Cell strength is the score; hue is the level. */
export function Heatmap({
  analysis,
  onSelect,
  selectedKey,
}: {
  analysis: Analysis;
  onSelect?: (key: string) => void;
  selectedKey?: string | null;
}) {
  const map = heatmap(analysis);
  if (!map.aggressors.length) {
    return <p className="text-body-sm text-tertiary">No aggressor reaches a victim with a score of 10 or more.</p>;
  }
  return (
    <div className="min-w-0 overflow-x-auto">
      <table className="border-separate border-spacing-1">
        <thead>
          <tr>
            <th className="pr-2 text-left text-caption font-medium tracking-[0.08em] text-quaternary uppercase">Aggressor \ victim</th>
            {map.victims.map((v) => (
              <th key={v} className="w-11 text-center text-caption font-medium tabular text-tertiary">
                {v}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {map.aggressors.map((a) => (
            <tr key={a}>
              <th scope="row" className="pr-2 text-left text-body-sm font-normal tabular text-secondary">
                {a}
              </th>
              {map.victims.map((v) => {
                const pair = analysis.risks.filter((r) => r.aggressor === a && r.victim === v);
                const risk = pair[0];
                if (!risk) {
                  return (
                    <td key={v} className="h-9 w-11 rounded-md bg-raised text-center text-caption text-quaternary">
                      ·
                    </td>
                  );
                }
                const selected = pair.some((r) => r.key === selectedKey);
                return (
                  <td key={v} className="p-0">
                    <button
                      type="button"
                      title={pair.map((r) => `#${r.num} ${r.mechanism} ${r.score}`).join("\n")}
                      onClick={() => onSelect?.(risk.key)}
                      className={`relative flex h-9 w-11 items-center justify-center overflow-hidden rounded-md text-body-sm tabular text-primary outline-none focus-visible:ring-2 focus-visible:ring-active ${selected ? "ring-2 ring-active" : ""}`}
                    >
                      <span
                        className="absolute inset-0"
                        style={{ background: TONE_VAR[LEVEL_TONE[risk.level]], opacity: 0.18 + (risk.score / 100) * 0.55 }}
                        aria-hidden
                      />
                      <span className="relative">
                        {risk.score}
                        {pair.length > 1 ? <sup className="ml-px text-[9px]">{pair.length}</sup> : null}
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
  );
}
