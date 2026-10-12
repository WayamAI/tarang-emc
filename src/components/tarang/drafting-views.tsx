"use client";

/** Three orthographic projections of the cabinet, drawn as SVG at a shared scale. */

import { CATEGORY_TOKEN, TEMPLATE_BY_ID } from "@/lib/tarang/catalog";
import { cablePath, strapPath } from "@/lib/tarang/geometry";
import type { Analysis, Design, Vec3 } from "@/lib/tarang/types";

import { Label } from "./ui";

interface Projection {
  id: string;
  title: string;
  /** Indices of the design axes drawn horizontally and vertically. */
  u: 0 | 1 | 2;
  v: 0 | 1 | 2;
  /** Depth axis decides paint order. */
  flipV: boolean;
  uLabel: string;
  vLabel: string;
}

const PROJECTIONS: Projection[] = [
  { id: "front", title: "Front elevation", u: 0, v: 1, flipV: true, uLabel: "X", vLabel: "Y" },
  { id: "side", title: "Right side elevation", u: 2, v: 1, flipV: true, uLabel: "Z", vLabel: "Y" },
  { id: "top", title: "Plan, from above", u: 0, v: 2, flipV: false, uLabel: "X", vLabel: "Z" },
];

const PAD = 70;

export function DraftingViews({
  design,
  analysis,
  selected,
  onSelect,
}: {
  design: Design;
  analysis: Analysis | null;
  selected: string | null;
  onSelect: (ref: string | null) => void;
}) {
  const flagged = new Set(analysis?.risks.filter((r) => r.level === "High").flatMap((r) => [r.aggressor, r.victim]) ?? []);

  return (
    <div className="h-full min-h-0 overflow-auto p-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {PROJECTIONS.map((proj) => {
          const width = design.enclosure[proj.u];
          const height = design.enclosure[proj.v];
          const px = (p: Vec3) => p[proj.u] + PAD;
          const py = (p: Vec3) => (proj.flipV ? height - p[proj.v] : p[proj.v]) + PAD;
          const line = (points: Vec3[]) => points.map((p) => `${px(p).toFixed(0)},${py(p).toFixed(0)}`).join(" ");
          return (
            <figure key={proj.id} className="min-w-0 rounded-lg border border-muted bg-container p-3">
              <figcaption className="mb-2 flex items-baseline justify-between gap-2">
                <Label>{proj.title}</Label>
                <span className="text-caption tabular text-quaternary">
                  {width} × {height} mm
                </span>
              </figcaption>
              <svg
                viewBox={`0 0 ${width + PAD * 2} ${height + PAD * 2}`}
                className="h-auto w-full"
                role="img"
                aria-label={`${proj.title} of ${design.product}`}
                onClick={() => onSelect(null)}
              >
                {design.zones.map((zone) => {
                  const x = zone.min[proj.u] + PAD;
                  const zh = zone.max[proj.v] - zone.min[proj.v];
                  const y = (proj.flipV ? height - zone.max[proj.v] : zone.min[proj.v]) + PAD;
                  return (
                    <rect
                      key={zone.id}
                      x={x}
                      y={y}
                      width={zone.max[proj.u] - zone.min[proj.u]}
                      height={zh}
                      fill="none"
                      strokeDasharray="10 8"
                      strokeWidth={1.5}
                      style={{ stroke: "var(--stroke-default)" }}
                    />
                  );
                })}
                <rect x={PAD} y={PAD} width={width} height={height} fill="none" strokeWidth={3} style={{ stroke: "var(--text-tertiary)" }} />

                {design.harnesses.map((harness) => (
                  <polyline key={harness.id} points={line(harness.trunk)} fill="none" strokeWidth={16} strokeLinejoin="round" style={{ stroke: "var(--stroke-default)" }} />
                ))}
                {design.cables.map((cable) => (
                  <polyline
                    key={cable.id}
                    points={line(cablePath(design, cable))}
                    fill="none"
                    strokeWidth={cable.noisy ? 5 : 2.5}
                    strokeLinejoin="round"
                    style={{
                      stroke: cable.noisy ? "var(--feedback-error-icon)" : cable.sensitive ? "var(--feedback-info-icon)" : "var(--text-quaternary)",
                    }}
                  />
                ))}
                {design.groundNets
                  .filter((net) => net.topology === "shared")
                  .map((net) => (
                    <polyline key={net.id} points={line(strapPath(design, net))} fill="none" strokeWidth={4} strokeDasharray="14 6" style={{ stroke: "var(--feedback-success-icon)" }} />
                  ))}

                {design.parts.map((part) => {
                  const token = CATEGORY_TOKEN[TEMPLATE_BY_ID[part.templateId].category];
                  const isSelected = part.ref === selected;
                  const x = part.pos[proj.u] + PAD;
                  const y = (proj.flipV ? height - part.pos[proj.v] - part.size[proj.v] : part.pos[proj.v]) + PAD;
                  const w = part.size[proj.u];
                  const h = part.size[proj.v];
                  return (
                    <g
                      key={part.ref}
                      className="cursor-pointer"
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelect(part.ref);
                      }}
                    >
                      <rect
                        x={x}
                        y={y}
                        width={w}
                        height={h}
                        strokeWidth={isSelected ? 5 : flagged.has(part.ref) ? 3.5 : 2}
                        style={{
                          fill: `var(${token})`,
                          fillOpacity: isSelected ? 0.55 : 0.28,
                          stroke: isSelected ? "var(--text-primary)" : flagged.has(part.ref) ? "var(--feedback-error-icon)" : `var(${token})`,
                        }}
                      />
                      <text
                        x={x + w / 2}
                        y={y - 8}
                        textAnchor="middle"
                        fontSize={24}
                        style={{ fill: isSelected ? "var(--text-primary)" : "var(--text-tertiary)" }}
                      >
                        {part.ref}
                      </text>
                    </g>
                  );
                })}

                {/* Scale bar and axes */}
                <g style={{ stroke: "var(--text-tertiary)", fill: "var(--text-tertiary)" }}>
                  <line x1={PAD} y1={height + PAD + 34} x2={PAD + 100} y2={height + PAD + 34} strokeWidth={3} />
                  <line x1={PAD} y1={height + PAD + 24} x2={PAD} y2={height + PAD + 44} strokeWidth={3} />
                  <line x1={PAD + 100} y1={height + PAD + 24} x2={PAD + 100} y2={height + PAD + 44} strokeWidth={3} />
                  <text x={PAD + 112} y={height + PAD + 42} fontSize={22} stroke="none">
                    100 mm
                  </text>
                  <text x={PAD + width} y={height + PAD + 42} fontSize={22} stroke="none" textAnchor="end">
                    {proj.uLabel} →
                  </text>
                  <text x={PAD - 14} y={PAD + 22} fontSize={22} stroke="none" textAnchor="end">
                    {proj.vLabel}
                  </text>
                </g>
              </svg>
            </figure>
          );
        })}
      </div>
      <p className="mt-3 text-caption text-quaternary">
        Third-angle projection, millimetres. Dashed boxes are thermal zones; the wide grey run is the loom trunk; red is a switched-power
        conductor, blue a sensitive lead, green dashes the shared ground strap. Parts on a High risk carry a red outline.
      </p>
    </div>
  );
}
