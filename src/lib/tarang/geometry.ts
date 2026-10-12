/** Geometry helpers shared by the rule engine, the 3D view and the drafting views. */

import type { Cable, Design, GroundNet, Harness, Part, Vec3, Zone } from "./types";

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const center = (p: Part): Vec3 => [p.pos[0] + p.size[0] / 2, p.pos[1] + p.size[1] / 2, p.pos[2] + p.size[2] / 2];

/** Edge-to-edge distance between two axis-aligned boxes, mm. Zero when they touch or overlap. */
export function boxGap(a: Part, b: Part): number {
  let sq = 0;
  for (let i = 0; i < 3; i++) {
    const gap = Math.max(a.pos[i] - (b.pos[i] + b.size[i]), b.pos[i] - (a.pos[i] + a.size[i]), 0);
    sq += gap * gap;
  }
  return Math.sqrt(sq);
}

export function boxesIntersect(a: Part, b: Part): boolean {
  for (let i = 0; i < 3; i++) {
    if (a.pos[i] >= b.pos[i] + b.size[i] || b.pos[i] >= a.pos[i] + a.size[i]) return false;
  }
  return true;
}

export function polylineLength(points: Vec3[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += dist(points[i - 1], points[i]);
  return total;
}

/** Point at arc length `s` along a polyline, clamped to its ends. */
export function pointAt(points: Vec3[], s: number): Vec3 {
  let left = Math.max(0, s);
  for (let i = 1; i < points.length; i++) {
    const seg = dist(points[i - 1], points[i]);
    if (left <= seg || i === points.length - 1) {
      const t = seg === 0 ? 0 : Math.min(1, left / seg);
      return [
        points[i - 1][0] + (points[i][0] - points[i - 1][0]) * t,
        points[i - 1][1] + (points[i][1] - points[i - 1][1]) * t,
        points[i - 1][2] + (points[i][2] - points[i - 1][2]) * t,
      ];
    }
    left -= seg;
  }
  return points[points.length - 1];
}

/** Sub-polyline between two arc lengths, including interior vertices. */
export function slicePolyline(points: Vec3[], from: number, to: number): Vec3[] {
  const out: Vec3[] = [pointAt(points, from)];
  let acc = 0;
  for (let i = 1; i < points.length - 1; i++) {
    acc += dist(points[i - 1], points[i]);
    if (acc > from && acc < to) out.push(points[i]);
  }
  out.push(pointAt(points, to));
  return out;
}

export function partByRef(design: Design, ref: string): Part | undefined {
  return design.parts.find((p) => p.ref === ref);
}

export function harnessOf(design: Design, cableId: string): { harness: Harness; from: number; to: number; offset: number } | undefined {
  for (const harness of design.harnesses) {
    const member = harness.members.find((m) => m.cableId === cableId);
    if (member) return { harness, from: member.from, to: member.to, offset: member.offset };
  }
  return undefined;
}

/** Routed path of a cable: through its harness trunk, its waypoints, or a dog-leg. */
export function cablePath(design: Design, cable: Cable): Vec3[] {
  const a = partByRef(design, cable.from);
  const b = partByRef(design, cable.to);
  if (!a || !b) return [];
  const ca = center(a);
  const cb = center(b);
  const carried = harnessOf(design, cable.id);
  if (carried) {
    const p1 = pointAt(carried.harness.trunk, carried.from);
    const p2 = pointAt(carried.harness.trunk, carried.to);
    const run = slicePolyline(carried.harness.trunk, carried.from, carried.to);
    const straight = dist(ca, p1) + dist(cb, p2);
    const crossed = dist(ca, p2) + dist(cb, p1);
    return straight <= crossed ? [ca, ...run, cb] : [ca, ...run.slice().reverse(), cb];
  }
  if (cable.via?.length) return [ca, ...cable.via, cb];
  return [ca, [ca[0], cb[1], ca[2]], [cb[0], cb[1], ca[2]], cb];
}

export function cableLength(design: Design, cable: Cable): number {
  return polylineLength(cablePath(design, cable));
}

/** Strap path with its ends riding on the first and last member parts. */
export function strapPath(design: Design, net: GroundNet): Vec3[] {
  if (net.points.length < 2) return net.points;
  const first = partByRef(design, net.members[0]);
  const last = partByRef(design, net.members[net.members.length - 1]);
  const pts = net.points.map((p) => [...p] as Vec3);
  if (first) pts[0] = add(net.points[0], sub(first.pos, net.anchors[0]));
  if (last) pts[pts.length - 1] = add(net.points[net.points.length - 1], sub(last.pos, net.anchors[1]));
  return pts;
}

export function zoneOf(design: Design, part: Part): Zone | undefined {
  const c = center(part);
  return design.zones.find((z) => c.every((v, i) => v >= z.min[i] && v <= z.max[i]));
}

export function clampToEnclosure(design: Design, part: Part, pos: Vec3): Vec3 {
  return pos.map((v, i) => Math.min(Math.max(0, v), design.enclosure[i] - part.size[i])) as Vec3;
}

export const snap5 = (v: number) => Math.round(v / 5) * 5;
