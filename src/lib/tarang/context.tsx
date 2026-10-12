"use client";

/**
 * Shared Tarang state.
 *
 * One list of designs, one standards overlay and one what-if tray feed every
 * page. Analyses are memoised per design object, so an edit to one design
 * recomputes only that design.
 */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { TEMPLATE_BY_ID } from "./catalog";
import { DEFAULT_DESIGN_ID, SEED_DESIGNS } from "./designs";
import { analyze } from "./engine";
import { applyFixes } from "./fixes";
import { TODAY } from "./format";
import { boxesIntersect, clampToEnclosure, snap5 } from "./geometry";
import { PEOPLE } from "./portfolio";
import { EMPTY_OVERRIDE, type Analysis, type Design, type MarketId, type Part, type StandardsOverride, type Vec3 } from "./types";

const analysisCache = new WeakMap<Design, WeakMap<StandardsOverride, Analysis>>();

export function analyzeCached(design: Design, override: StandardsOverride): Analysis {
  let inner = analysisCache.get(design);
  if (!inner) {
    inner = new WeakMap();
    analysisCache.set(design, inner);
  }
  let result = inner.get(override);
  if (!result) {
    result = analyze(design, override);
    inner.set(override, result);
  }
  return result;
}

const plannedCache = new WeakMap<Design, Map<string, Design>>();

function plannedDesign(design: Design, instances: string[]): Design {
  if (!instances.length) return design;
  let inner = plannedCache.get(design);
  if (!inner) {
    inner = new Map();
    plannedCache.set(design, inner);
  }
  const key = instances.join("|");
  let planned = inner.get(key);
  if (!planned) {
    planned = applyFixes(design, instances);
    inner.set(key, planned);
  }
  return planned;
}

export interface SignOff {
  by: string;
  role: string;
  at: string;
  index: number;
}

interface TarangValue {
  designs: Design[];
  activeId: string;
  active: Design;
  setActiveId: (id: string) => void;
  designById: (id: string) => Design | undefined;
  analysisOf: (id: string) => Analysis;
  override: StandardsOverride;
  setOverride: (next: StandardsOverride) => void;
  overrideActive: boolean;
  updateDesign: (id: string, fn: (d: Design) => Design) => void;
  movePart: (designId: string, ref: string, pos: Vec3) => void;
  patchPart: (designId: string, ref: string, patch: Partial<Part>) => void;
  addPart: (designId: string, templateId: string) => string | undefined;
  removePart: (designId: string, ref: string) => void;
  toggleMarket: (designId: string, market: MarketId) => void;
  whatIf: string[];
  whatIfOf: (designId: string) => string[];
  toggleWhatIf: (designId: string, instance: string) => void;
  clearWhatIf: (designId: string) => void;
  plannedOf: (designId: string) => { design: Design; analysis: Analysis };
  saveWhatIf: (designId: string, note: string) => Design | undefined;
  branchDesign: (designId: string, note: string) => Design | undefined;
  deleteDesign: (designId: string) => void;
  signOffs: Record<string, SignOff>;
  signOff: (designId: string) => void;
  statuses: Record<string, string>;
  setStatus: (id: string, status: string) => void;
  resetSession: () => void;
}

const TarangContext = createContext<TarangValue | null>(null);

function nextVersion(designs: Design[], base: Design): string {
  const root = base.version.split(".")[0];
  const taken = new Set(designs.filter((d) => d.programId === base.programId).map((d) => d.version));
  for (let minor = 1; minor < 50; minor++) {
    const candidate = `${root}.${minor}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${root}.x`;
}

export function TarangProvider({ children }: { children: ReactNode }) {
  const [designs, setDesigns] = useState<Design[]>(SEED_DESIGNS);
  const [activeId, setActiveId] = useState(DEFAULT_DESIGN_ID);
  const [override, setOverride] = useState<StandardsOverride>(EMPTY_OVERRIDE);
  const [whatIfMap, setWhatIfMap] = useState<Record<string, string[]>>({});
  const [signOffs, setSignOffs] = useState<Record<string, SignOff>>({});
  const [statuses, setStatuses] = useState<Record<string, string>>({});

  const designById = useCallback((id: string) => designs.find((d) => d.id === id), [designs]);
  const active = designById(activeId) ?? designs[0];

  const analysisOf = useCallback(
    (id: string) => analyzeCached(designs.find((d) => d.id === id) ?? designs[0], override),
    [designs, override],
  );

  const updateDesign = useCallback((id: string, fn: (d: Design) => Design) => {
    setDesigns((list) => list.map((d) => (d.id === id ? fn(d) : d)));
  }, []);

  const movePart = useCallback(
    (designId: string, ref: string, pos: Vec3) => {
      updateDesign(designId, (d) => {
        const part = d.parts.find((p) => p.ref === ref);
        if (!part) return d;
        const next = clampToEnclosure(d, part, pos.map(snap5) as Vec3);
        if (next.every((v, i) => v === part.pos[i])) return d;
        return { ...d, parts: d.parts.map((p) => (p.ref === ref ? { ...p, pos: next } : p)) };
      });
    },
    [updateDesign],
  );

  const patchPart = useCallback(
    (designId: string, ref: string, patch: Partial<Part>) => {
      updateDesign(designId, (d) => ({ ...d, parts: d.parts.map((p) => (p.ref === ref ? { ...p, ...patch } : p)) }));
    },
    [updateDesign],
  );

  const addPart = useCallback(
    (designId: string, templateId: string) => {
      const design = designs.find((d) => d.id === designId);
      const tpl = TEMPLATE_BY_ID[templateId];
      if (!design || !tpl) return undefined;
      let n = 1;
      while (design.parts.some((p) => p.ref === `${tpl.prefix}${n}`)) n += 1;
      const ref = `${tpl.prefix}${n}`;
      // First free spot on a coarse grid through the drum volume.
      let pos: Vec3 = [100, 300, 100];
      search: for (let y = 300; y < design.enclosure[1] - tpl.size[1]; y += 60) {
        for (let z = 100; z < design.enclosure[2] - tpl.size[2]; z += 60) {
          for (let x = 100; x < design.enclosure[0] - tpl.size[0]; x += 60) {
            const probe: Part = { id: ref, ref, templateId, name: tpl.name, pos: [x, y, z], size: tpl.size };
            if (design.parts.every((p) => !boxesIntersect(probe, p))) {
              pos = [x, y, z];
              break search;
            }
          }
        }
      }
      updateDesign(designId, (d) => ({
        ...d,
        parts: [...d.parts, { id: ref, ref, templateId, name: tpl.name, pos, size: tpl.size, filterStages: tpl.filterStages }],
      }));
      return ref;
    },
    [designs, updateDesign],
  );

  const removePart = useCallback(
    (designId: string, ref: string) => {
      updateDesign(designId, (d) => {
        const gone = new Set(d.cables.filter((c) => c.from === ref || c.to === ref).map((c) => c.id));
        return {
          ...d,
          parts: d.parts.filter((p) => p.ref !== ref),
          cables: d.cables.filter((c) => !gone.has(c.id)),
          harnesses: d.harnesses.map((h) => ({ ...h, members: h.members.filter((m) => !gone.has(m.cableId)) })),
          groundNets: d.groundNets.map((n) => ({ ...n, members: n.members.filter((m) => m !== ref) })).filter((n) => n.members.length),
        };
      });
    },
    [updateDesign],
  );

  const toggleMarket = useCallback(
    (designId: string, market: MarketId) => {
      updateDesign(designId, (d) => {
        const has = d.markets.includes(market);
        if (has && d.markets.length === 1) return d;
        return { ...d, markets: has ? d.markets.filter((m) => m !== market) : [...d.markets, market] };
      });
    },
    [updateDesign],
  );

  const whatIfOf = useCallback((designId: string) => whatIfMap[designId] ?? [], [whatIfMap]);

  const toggleWhatIf = useCallback((designId: string, instance: string) => {
    setWhatIfMap((map) => {
      const list = map[designId] ?? [];
      return { ...map, [designId]: list.includes(instance) ? list.filter((i) => i !== instance) : [...list, instance] };
    });
  }, []);

  const clearWhatIf = useCallback((designId: string) => {
    setWhatIfMap((map) => ({ ...map, [designId]: [] }));
  }, []);

  const plannedOf = useCallback(
    (designId: string) => {
      const base = designs.find((d) => d.id === designId) ?? designs[0];
      const design = plannedDesign(base, whatIfMap[designId] ?? []);
      return { design, analysis: analyzeCached(design, override) };
    },
    [designs, whatIfMap, override],
  );

  const branch = useCallback(
    (designId: string, note: string, instances: string[]) => {
      const base = designs.find((d) => d.id === designId);
      if (!base) return undefined;
      const version = nextVersion(designs, base);
      const created: Design = {
        ...plannedDesign(base, instances),
        id: `${base.id.replace(/-v[\d-]+$/, "")}-${version.replace(/\./g, "-")}`,
        version,
        note,
        parentId: base.id,
        createdAt: TODAY,
        author: PEOPLE.eng1.name,
        appliedFixes: [...base.appliedFixes, ...instances],
      };
      setDesigns((list) => [...list, created]);
      return created;
    },
    [designs],
  );

  const saveWhatIf = useCallback(
    (designId: string, note: string) => {
      const created = branch(designId, note, whatIfMap[designId] ?? []);
      if (created) setWhatIfMap((map) => ({ ...map, [designId]: [] }));
      return created;
    },
    [branch, whatIfMap],
  );

  const branchDesign = useCallback((designId: string, note: string) => branch(designId, note, []), [branch]);

  const deleteDesign = useCallback(
    (designId: string) => {
      setDesigns((list) => (list.length > 1 ? list.filter((d) => d.id !== designId) : list));
      setActiveId((current) => (current === designId ? DEFAULT_DESIGN_ID : current));
    },
    [],
  );

  const signOff = useCallback(
    (designId: string) => {
      const design = designs.find((d) => d.id === designId);
      if (!design) return;
      setSignOffs((map) => ({
        ...map,
        [designId]: { by: PEOPLE.lead.name, role: PEOPLE.lead.role, at: TODAY, index: analyzeCached(design, override).index },
      }));
    },
    [designs, override],
  );

  const setStatus = useCallback((id: string, status: string) => {
    setStatuses((map) => ({ ...map, [id]: status }));
  }, []);

  const resetSession = useCallback(() => {
    setDesigns(SEED_DESIGNS);
    setActiveId(DEFAULT_DESIGN_ID);
    setOverride(EMPTY_OVERRIDE);
    setWhatIfMap({});
    setSignOffs({});
    setStatuses({});
  }, []);

  const value = useMemo<TarangValue>(
    () => ({
      designs, activeId: active.id, active, setActiveId, designById, analysisOf, override, setOverride,
      overrideActive: override !== EMPTY_OVERRIDE,
      updateDesign, movePart, patchPart, addPart, removePart, toggleMarket,
      whatIf: whatIfMap[active.id] ?? [], whatIfOf, toggleWhatIf, clearWhatIf, plannedOf, saveWhatIf, branchDesign, deleteDesign,
      signOffs, signOff, statuses, setStatus, resetSession,
    }),
    [
      designs, active, designById, analysisOf, override, updateDesign, movePart, patchPart, addPart, removePart, toggleMarket,
      whatIfMap, whatIfOf, toggleWhatIf, clearWhatIf, plannedOf, saveWhatIf, branchDesign, deleteDesign, signOffs, signOff, statuses, setStatus, resetSession,
    ],
  );

  return <TarangContext.Provider value={value}>{children}</TarangContext.Provider>;
}

export function useTarang(): TarangValue {
  const value = useContext(TarangContext);
  if (!value) throw new Error("useTarang must be used inside TarangProvider");
  return value;
}
