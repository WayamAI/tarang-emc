"use client";

/**
 * 3D cabinet view. Plain three.js: cabinet wireframe, zone volumes, parts as
 * translucent boxes, cables as tubes, the ground strap, keep-out envelopes and
 * HTML labels projected over the canvas. Every colour is read from the CSS
 * token variables so the scene follows the light and dark themes.
 */

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import { CATEGORY_TOKEN, TEMPLATE_BY_ID } from "@/lib/tarang/catalog";
import { cablePath, center, strapPath } from "@/lib/tarang/geometry";
import type { Analysis, Design, Level, Vec3 } from "@/lib/tarang/types";

export type ViewPreset = "Iso" | "Front" | "Back" | "Left" | "Right" | "Top";
export const VIEW_PRESETS: ViewPreset[] = ["Iso", "Front", "Back", "Left", "Right", "Top"];

const VIEW_DIR: Record<ViewPreset, [number, number, number]> = {
  Iso: [0.9, 0.55, 1.15],
  Front: [0, 0, 1],
  Back: [0, 0, -1],
  Left: [-1, 0, 0],
  Right: [1, 0, 0],
  Top: [0, 1, 0.0001],
};

interface Rgba {
  color: THREE.Color;
  alpha: number;
}

/** Resolve a CSS custom property to a colour by letting the browser compute it. */
function tokenColor(host: HTMLElement, token: string): Rgba {
  const probe = document.createElement("span");
  probe.style.color = `var(${token})`;
  host.appendChild(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();
  const nums = (computed.match(/[\d.]+/g) ?? []).map(Number);
  const unit = computed.startsWith("color(") ? 1 : 255;
  const [r = 128, g = 128, b = 128] = nums;
  const color = new THREE.Color().setRGB(r / unit, g / unit, b / unit, THREE.SRGBColorSpace);
  return { color, alpha: nums[3] ?? 1 };
}

const LABEL_BASE =
  "pointer-events-none absolute left-0 top-0 whitespace-nowrap rounded-full px-1.5 py-px text-caption tabular will-change-transform";
const LABEL_PART = `${LABEL_BASE} border border-muted bg-container text-secondary`;
const LABEL_SELECTED = `${LABEL_BASE} bg-action-primary text-on-color`;
const LABEL_NOTE = "pointer-events-none absolute left-0 top-0 whitespace-nowrap text-caption text-quaternary will-change-transform";
const LABEL_ZONE = "pointer-events-none absolute left-0 top-0 whitespace-nowrap text-caption tracking-[0.08em] text-quaternary uppercase will-change-transform";
const LABEL_RISK: Record<Level, string> = {
  High: `${LABEL_BASE} bg-error-badge text-badge`,
  Medium: `${LABEL_BASE} bg-warning-badge text-badge`,
  Low: `${LABEL_BASE} bg-info-badge text-badge`,
};

interface SceneLabel {
  el: HTMLElement;
  at: THREE.Vector3;
  dx: number;
  dy: number;
}

interface Runtime {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  content: THREE.Group;
  pickables: THREE.Mesh[];
  labels: SceneLabel[];
  render: () => void;
}

function disposeGroup(group: THREE.Group) {
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    mesh.geometry?.dispose();
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(material)) material.forEach((m) => m.dispose());
    else material?.dispose();
  });
  group.clear();
}

export function Cabinet3D({
  design,
  analysis,
  selected,
  onSelect,
  onMove,
  view,
  showZones,
  showCables,
  showKeepOut,
}: {
  design: Design;
  /** Risk callouts are drawn only when an analysis is supplied. */
  analysis: Analysis | null;
  selected: string | null;
  onSelect: (ref: string | null) => void;
  onMove: (ref: string, pos: Vec3) => void;
  view: { preset: ViewPreset; tick: number };
  showZones: boolean;
  showCables: boolean;
  showKeepOut: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const scaleBarRef = useRef<HTMLSpanElement>(null);
  const scaleTextRef = useRef<HTMLSpanElement>(null);
  const runtime = useRef<Runtime | null>(null);
  const handlers = useRef({ onSelect, onMove });
  const designRef = useRef(design);
  const [themeTick, setThemeTick] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    handlers.current = { onSelect, onMove };
    designRef.current = design;
  });

  // Renderer, camera, controls, picking. Mounted once.
  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch {
      // No WebGL context: report it after the effect so the fallback renders.
      queueMicrotask(() => setFailed(true));
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearAlpha(0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 10, 12000);
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = false;
    controls.minDistance = 500;
    controls.maxDistance = 5000;
    const content = new THREE.Group();
    scene.add(content);

    const projected = new THREE.Vector3();
    let frame = 0;
    const draw = () => {
      frame = 0;
      const rt = runtime.current;
      if (!rt) return;
      renderer.render(scene, camera);
      const w = host.clientWidth;
      const h = host.clientHeight;
      for (const label of rt.labels) {
        projected.copy(label.at).project(camera);
        const visible = projected.z < 1 && Math.abs(projected.x) < 1.05 && Math.abs(projected.y) < 1.05;
        label.el.style.display = visible ? "" : "none";
        if (visible) {
          const x = (projected.x * 0.5 + 0.5) * w + label.dx;
          const y = (-projected.y * 0.5 + 0.5) * h + label.dy;
          label.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
        }
      }
      // Scale readout at the orbit target.
      const distance = camera.position.distanceTo(controls.target);
      const mmPerPx = (2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / Math.max(1, h);
      const nice = [20, 50, 100, 200, 500, 1000].find((mm) => mm / mmPerPx >= 48) ?? 1000;
      if (scaleBarRef.current) scaleBarRef.current.style.width = `${(nice / mmPerPx).toFixed(0)}px`;
      if (scaleTextRef.current) scaleTextRef.current.textContent = `${nice} mm · 1 px = ${mmPerPx.toFixed(1)} mm`;
    };
    const render = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };

    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      render();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    controls.addEventListener("change", render);

    runtime.current = { renderer, scene, camera, controls, content, pickables: [], labels: [], render };
    resize();

    // Picking and dragging in the camera-facing plane.
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const plane = new THREE.Plane();
    const hit = new THREE.Vector3();
    let drag: { ref: string; offset: THREE.Vector3 } | null = null;
    let down: { x: number; y: number } | null = null;

    const setPointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
    };

    const onDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      down = { x: event.clientX, y: event.clientY };
      setPointer(event);
      const rt = runtime.current;
      const first = rt ? raycaster.intersectObjects(rt.pickables, false)[0] : undefined;
      if (!first) return;
      // A press on a part starts a drag; keep it away from the orbit controls.
      event.stopImmediatePropagation();
      const ref = first.object.userData.ref as string;
      handlers.current.onSelect(ref);
      const normal = camera.getWorldDirection(new THREE.Vector3());
      plane.setFromNormalAndCoplanarPoint(normal, first.point);
      drag = { ref, offset: first.point.clone().sub(first.object.position) };
      controls.enabled = false;
      canvas.setPointerCapture(event.pointerId);
    };

    const onMovePointer = (event: PointerEvent) => {
      if (!drag) return;
      setPointer(event);
      if (!raycaster.ray.intersectPlane(plane, hit)) return;
      const d = designRef.current;
      const part = d.parts.find((p) => p.ref === drag?.ref);
      if (!part) return;
      const c = hit.clone().sub(drag.offset);
      const [w, h, depth] = d.enclosure;
      handlers.current.onMove(drag.ref, [
        c.x + w / 2 - part.size[0] / 2,
        c.y + h / 2 - part.size[1] / 2,
        depth / 2 - c.z - part.size[2] / 2,
      ]);
    };

    const onUp = (event: PointerEvent) => {
      if (drag) {
        drag = null;
        controls.enabled = true;
        if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
        return;
      }
      if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) < 4) handlers.current.onSelect(null);
      down = null;
    };

    canvas.addEventListener("pointerdown", onDown, true);
    canvas.addEventListener("pointermove", onMovePointer);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);

    // Re-read tokens when the theme flips.
    const themeWatch = new MutationObserver(() => setThemeTick((n) => n + 1));
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    return () => {
      themeWatch.disconnect();
      observer.disconnect();
      canvas.removeEventListener("pointerdown", onDown, true);
      canvas.removeEventListener("pointermove", onMovePointer);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      controls.dispose();
      if (frame) cancelAnimationFrame(frame);
      disposeGroup(content);
      renderer.dispose();
      runtime.current = null;
    };
  }, []);

  // Camera presets.
  useEffect(() => {
    const rt = runtime.current;
    if (!rt) return;
    const dir = new THREE.Vector3(...VIEW_DIR[view.preset]).normalize();
    const reach = Math.max(...design.enclosure) * 2.9;
    rt.camera.position.copy(dir.multiplyScalar(reach));
    rt.controls.target.set(0, 0, 0);
    rt.controls.update();
    rt.render();
    // The enclosure only sets the framing distance; presets re-apply on demand.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // Scene content. Rebuilt whenever the design, selection, analysis or theme changes.
  useEffect(() => {
    const rt = runtime.current;
    const host = hostRef.current;
    const overlay = overlayRef.current;
    if (!rt || !host || !overlay) return;

    disposeGroup(rt.content);
    overlay.replaceChildren();
    rt.pickables = [];
    rt.labels = [];

    const [w, h, d] = design.enclosure;
    const toV = (p: Vec3) => new THREE.Vector3(p[0] - w / 2, p[1] - h / 2, d / 2 - p[2]);
    const cache = new Map<string, Rgba>();
    const tok = (name: string) => {
      let value = cache.get(name);
      if (!value) {
        value = tokenColor(host, name);
        cache.set(name, value);
      }
      return value;
    };

    const addLabel = (text: string, className: string, at: THREE.Vector3, dx = 0, dy = 0) => {
      const el = document.createElement("span");
      el.className = className;
      el.textContent = text;
      overlay.appendChild(el);
      rt.labels.push({ el, at, dx, dy });
    };

    const edges = (size: Vec3, at: THREE.Vector3, token: string, opacity = 1) => {
      const geometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(size[0], size[1], size[2]));
      const { color, alpha } = tok(token);
      const line = new THREE.LineSegments(
        geometry,
        new THREE.LineBasicMaterial({ color, transparent: true, opacity: Math.min(1, alpha * opacity) }),
      );
      line.position.copy(at);
      rt.content.add(line);
      return line;
    };

    const solid = (size: Vec3, at: THREE.Vector3, token: string, opacity: number) => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(size[0], size[1], size[2]),
        new THREE.MeshBasicMaterial({ color: tok(token).color, transparent: true, opacity, depthWrite: false }),
      );
      mesh.position.copy(at);
      rt.content.add(mesh);
      return mesh;
    };

    const tube = (points: Vec3[], radius: number, token: string, opacity = 1) => {
      if (points.length < 2) return;
      const path = new THREE.CurvePath<THREE.Vector3>();
      for (let i = 1; i < points.length; i++) {
        const a = toV(points[i - 1]);
        const b = toV(points[i]);
        if (a.distanceTo(b) > 0.5) path.add(new THREE.LineCurve3(a, b));
      }
      if (!path.curves.length) return;
      const mesh = new THREE.Mesh(
        new THREE.TubeGeometry(path, Math.max(8, path.curves.length * 6), radius, 6, false),
        new THREE.MeshBasicMaterial({ color: tok(token).color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 }),
      );
      rt.content.add(mesh);
    };

    // Cabinet outline, floor grid and door aperture.
    edges(design.enclosure, new THREE.Vector3(0, 0, 0), "--text-tertiary", 0.9);
    const grid = new THREE.GridHelper(Math.max(w, d) * 1.8, 18, tok("--stroke-default").color, tok("--stroke-default").color);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.35;
    grid.position.y = -h / 2;
    rt.content.add(grid);

    const front = design.panels.find((p) => p.id === "front");
    if (front && front.apertureMm > 0) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(front.apertureMm / 2 - 6, front.apertureMm / 2, 48),
        new THREE.MeshBasicMaterial({ color: tok("--text-tertiary").color, side: THREE.DoubleSide, transparent: true, opacity: 0.8 }),
      );
      ring.position.set(0, 470 - h / 2, d / 2);
      rt.content.add(ring);
      addLabel(`${front.apertureLabel ?? "aperture"} ${front.apertureMm} mm`, LABEL_NOTE, new THREE.Vector3(0, 470 - h / 2 - front.apertureMm / 2, d / 2), 0, 12);
    }

    if (showZones) {
      for (const zone of design.zones) {
        const size: Vec3 = [zone.max[0] - zone.min[0], zone.max[1] - zone.min[1], zone.max[2] - zone.min[2]];
        const at = toV([zone.min[0] + size[0] / 2, zone.min[1] + size[1] / 2, zone.min[2] + size[2] / 2]);
        const token = zone.ventilated ? "--feedback-info-icon" : "--feedback-neutral-icon";
        solid(size, at, token, 0.045);
        edges(size, at, token, 0.35);
        addLabel(
          `${zone.name} · ${zone.ventilated ? "ventilated" : "sealed"} ${zone.ambientC}°C`,
          LABEL_ZONE,
          toV([zone.min[0] + size[0] / 2, zone.max[1], zone.max[2]]),
          0,
          10,
        );
      }
    }

    // Parts.
    const worst = new Map<string, { score: number; level: Level; count: number }>();
    if (analysis) {
      for (const risk of analysis.risks) {
        for (const ref of [risk.aggressor, risk.victim]) {
          const current = worst.get(ref);
          if (!current || risk.score > current.score) worst.set(ref, { score: risk.score, level: risk.level, count: (current?.count ?? 0) + 1 });
          else current.count += 1;
        }
      }
    }

    for (const part of design.parts) {
      const tpl = TEMPLATE_BY_ID[part.templateId];
      const token = CATEGORY_TOKEN[tpl.category];
      const at = toV(center(part));
      const isSelected = part.ref === selected;
      const mesh = solid(part.size, at, token, isSelected ? 0.6 : 0.3);
      mesh.userData.ref = part.ref;
      rt.pickables.push(mesh);
      edges(part.size, at, isSelected ? "--text-primary" : token, 1);
      if (part.shieldCan) edges([part.size[0] + 8, part.size[1] + 8, part.size[2] + 8], at, "--text-secondary", 0.9);

      const top = at.clone().add(new THREE.Vector3(0, part.size[1] / 2, 0));
      addLabel(part.ref, isSelected ? LABEL_SELECTED : LABEL_PART, top, 0, -11);
      const callout = worst.get(part.ref);
      if (callout) addLabel(`${callout.score}${callout.count > 1 ? ` ×${callout.count}` : ""}`, LABEL_RISK[callout.level], top, 0, -29);

      if (tpl.nearFieldMm && (showKeepOut || isSelected)) {
        const k = tpl.nearFieldMm;
        edges([part.size[0] + 2 * k, part.size[1] + 2 * k, part.size[2] + 2 * k], at, "--feedback-error-icon", 0.55);
        addLabel(`${part.ref} keep-out ${k} mm`, LABEL_NOTE, at.clone().add(new THREE.Vector3(0, -part.size[1] / 2 - k, 0)), 0, 10);
      }
    }

    // Harness trunks, cables and ground straps.
    if (showCables) {
      for (const harness of design.harnesses) tube(harness.trunk, 13, "--text-quaternary", 0.22);
      for (const cable of design.cables) {
        const token = cable.noisy
          ? "--feedback-error-icon"
          : cable.sensitive
            ? "--feedback-info-icon"
            : cable.kind === "mains"
              ? "--text-primary"
              : "--text-tertiary";
        tube(cablePath(design, cable), cable.noisy ? 5 : cable.kind === "mains" ? 4 : 2.6, token, cable.noisy || cable.sensitive ? 1 : 0.7);
      }
      const inlet = design.parts.find((p) => TEMPLATE_BY_ID[p.templateId].mainsPort);
      for (const net of design.groundNets) {
        if (net.topology === "star" && net.members.length > 1 && inlet) {
          for (const ref of net.members) {
            const member = design.parts.find((p) => p.ref === ref);
            if (member) tube([center(member), [center(member)[0], center(inlet)[1], center(member)[2]], center(inlet)], 3.2, "--feedback-success-icon");
          }
        } else {
          tube(strapPath(design, net), 3.6, "--feedback-success-icon");
        }
      }
    }

    rt.render();
  }, [design, analysis, selected, showZones, showCables, showKeepOut, themeTick]);

  return (
    <div ref={hostRef} className="relative h-full min-h-0 w-full min-w-0 overflow-hidden bg-page">
      <canvas ref={canvasRef} className="block h-full w-full touch-none outline-none" />
      <div ref={overlayRef} className="pointer-events-none absolute inset-0 overflow-hidden" />
      <div className="pointer-events-none absolute bottom-3 left-3 flex flex-col gap-1">
        <span ref={scaleBarRef} className="block h-1.5 border-x border-b border-default" style={{ width: 80 }} />
        <span ref={scaleTextRef} className="text-caption tabular text-quaternary" />
      </div>
      {failed ? (
        <div className="absolute inset-0 flex items-center justify-center bg-page px-6 text-center">
          <p className="text-body-md text-tertiary">
            WebGL is not available in this browser. Use the Drafting views tab; every edit still re-scores.
          </p>
        </div>
      ) : null}
    </div>
  );
}
