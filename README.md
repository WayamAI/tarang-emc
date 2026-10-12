# Tarang

**Tarang** (तरंग, Sanskrit for "wave") is a Wayam AI accelerator for EMI/EMC pre-compliance in home-appliance design. It scores every aggressor, victim and coupling path inside a cabinet against the test requirements of the markets the product ships to, before the first prototype reaches a test lab.

A failed lab test costs two to eight weeks and a board re-spin. Finding the same problem in layout costs an afternoon. Tarang is the afternoon.

## Who it is for

EMC engineers and appliance architects at a white-goods OEM. The demo tenant is the fictional **Northfield Appliances**; its seeded programme is the **AquaLine FL-8** front-load washer (600 × 850 × 600 mm, EU + US), with three sibling programmes (TopLoad TL-7, DryLine HP-9, CleanWave DW-6) scored by the same engine.

The engineer lays out the product in 3D: motor drive, SMPS, control board, Wi-Fi module, heater, harnesses and ground straps. A deterministic rule engine turns that layout into a risk register, a compliance prediction per market (EU CE, US FCC, China CCC/SRRC, AU/NZ RCM, India BIS/WPC), a ranked fix plan and a go / no-go call on the chamber booking.

## How the engine works

`src/lib/tarang/engine.ts` is pure and deterministic. Fourteen rules (R1 to R14) read the design and produce risks:

```
score = min(100, round(100 × clamp(rule factor + modifiers, 0, 1) × impact) + history adjustment)
```

- **Geometry rules.** R1 radiated proximity uses the 3D edge-to-edge gap between part boxes against the aggressor's critical distance. R2 harness crosstalk uses the length two cables share a loom and their spacing in the bundle. R3 conducted emissions walks the switching harmonics through the inlet filter and compares the worst one with the limit line of every selected market. R5 common ground return uses the strap length and standoff as a loop area. R7 thermal proximity estimates the victim's temperature from the gap, the zone ambient and the dissipation. R12 and R13 read the panel calculator and routed cable lengths.
- **Parametric rules.** R4 shared rail, R6 harmonics in a victim band, R8 ESD exposure, R9 flicker, R10 harmonic current, R11 unearthed surfaces, R14 earth continuity.
- **Impact** is the strictest requirement status in the selected markets: mandatory 1.0, verify 0.8, voluntary 0.6, functional 0.7.
- **History** adds 10 when a failing lab report shares at least 80 % of the risk's condition tags (Jaccard), 6 at 50 %. A passing retest marks its fix as proven.
- **Levels**: High 60 and above, Medium 30 to 59, Low 10 to 29.
- **Risk index** = min(100, round(0.45 × worst + 0.55 × mean of the three worst + number of Highs)).

The seeded AquaLine FL-8 v1 scores index 100 with 3 High, 9 Medium and 1 Low; v2 scores 36 with 0 High, 1 Medium and 2 Low. Fixes (`src/lib/tarang/fixes.ts`) are edits to the design, so every "expected reduction" in the Fix Planner is the engine re-run on the edited layout, not a quoted number.

All state lives in one React context (`src/lib/tarang/context.tsx`): move a part, toggle a shield can or the star ground, change a market, apply a what-if fix or put a simulated standards change in force, and the register, the matrix, lab readiness, compare and the command center all move together.

## Use cases, page by page

| Route | What it answers |
| --- | --- |
| `/dashboard` | Command Center: which programmes would fail the chamber as they stand, through which interference paths (Source → Coupling path → Victim → Test at risk, each node filters the queue), what has been saved so far, which bookings are no-go, which fixes are still unproven. |
| `/designs` | Every programme, its version lineage and where each version stands; branch a version, put it in scope, delete a draft. |
| `/workspace/[designId]` | Three-pane workspace: 22-template library, a three.js cabinet (zones, translucent parts, cable tubes, ground strap, keep-out envelopes, risk callouts, six view presets, drag with 5 mm snap, scale readout) or three orthographic drafting views, and an inspector with nudge fields, mitigation toggles, markets, panels, harnesses and ground nets. Run analysis or leave Live on. |
| `/compare` | Two versions side by side: index change, risks resolved, new and moved, layout and wiring edits, compliance changes. |
| `/risks` | Risk Register: index, level counts, top three, aggressor × victim heatmap and the full table; a row opens the score build-up, lab history and ranked fixes. |
| `/fixes` | Fix Planner: ranked fixes per risk by type, measured score reduction, cost now against cost after a lab fail, proven or unproven, Apply to what-if; the tray walks the index down and Save as new version creates the next version. |
| `/compliance` | Compliance Matrix: test requirements × selected markets with status, standard, predicted outcome and linked risks, plus the pre-compliance test plan. |
| `/lab-readiness` | Per test: first-pass probability, the risks behind it, the cheapest fix that moves it, lab cost, a go / no-go call per test and per chamber booking, and expected re-test cost before and after the planned fixes. |
| `/review-pack` | A print-ready design review pack generated from live state: summary, top risks, heatmap, compliance outcome, open assumptions, changes and a sign-off block. |
| `/test-history` | Thirty lab reports across five product families, and what each one means for the design in scope. |
| `/libraries/components` | The component templates and the electrical properties the rules read; place one in the design in scope. |
| `/libraries/materials` | Ten material classes and the panel calculator: base shielding through thickness, seams, screw pitch, paint and aperture to effective shielding and leak frequency; apply the result to a cabinet panel. |
| `/libraries/standards` | Twenty standards across five markets, an editable conducted-emission limit line plotted against the predicted harmonics, and the standards watch: tighten a limit by N dB or change a requirement status, see which designs and risks move, put it in force everywhere or reset. |
| `/libraries/rules` | The fourteen rules, the scoring model, each rule's assumption, and how often it fired on the design in scope. |
| `/settings` | Theme, notifications, engine constants, session reset. |

## Stack

- Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS v4
- Wayam AI token system (`src/styles/tokens.css`), light by default, dark supported
- recharts for charts, plain three.js with `OrbitControls` for the 3D cabinet (no react-three-fiber), lucide-react for icons
- Client-side only over a deterministic synthetic dataset in `src/lib/tarang/`; no backend

## Run it

```bash
npm install
npm run dev
```

The app runs on **http://localhost:3101** (`package.json`). `npm run build` and `npm run start` use the same port.

Checks: `npx next typegen && npx tsc --noEmit`, `npm run lint`, `npm run build`.

## Demo sign-in

- Email: `operator@tarang.ai`
- Password: `command`

The session is a cookie; there is no identity provider. Edits, saved versions, what-if trays and sign-offs live in the browser session and reset on reload or from Settings.

## A five-minute walkthrough

1. **Command Center**: two of four programmes sit above index 60. Click "Motor drive" in the interference path to scope the queue.
2. **Designs**: put AquaLine FL-8 v1 in scope and open it in the workspace.
3. **Workspace**: select U3 (the Wi-Fi module, 18 mm from the inverter) and drag it toward the front, or nudge Z. Risk #1 drops out and the index moves. Toggle Star ground under Ground nets and #3 clears.
4. **Fix Planner**: press Apply top fixes. The tray walks the index from 100 toward 30. Save as new version.
5. **Compare**: v1 against the new version, or v1 against v2 (index change −64).
6. **Lab Readiness**: the booking flips from no-go to go once the fixes are in the tray.
7. **Standards**: tighten EN IEC 55014-1 by 6 dB and watch AquaLine v1.1 (jitter only) go from 56 back to 86 on conducted emissions; make ESD immunity mandatory in the US and TopLoad TL-7 moves.
8. **Review Pack**: sign off as the EMC lead, then change the design and see the signature go stale.

## Dropping in the Flow renders

`prompts.md` is the Google Flow prompt pack: colour lock, login background, style prefix and one subject per mark.

1. Generate the login background and save it as `public/brand/login-bg.jpg`.
2. Generate each numbered subject with the style prefix and save it as `public/images/marks/<mark-id>.png`, using the Filenames table in `prompts.md`.
3. No code change is needed. `src/components/ui/mark.tsx` probes for the file and falls back to the Lucide glyph registered in `src/lib/marks.ts` until it exists.

## Project map

```
src/lib/tarang/
  types.ts       domain model
  catalog.ts     markets, tests, 20 standards, 10 materials, 22 templates, 14 rules
  designs.ts     seeded designs (AquaLine v1, v1.1, v2 and three sibling programmes)
  history.ts     30 lab reports and the fixes they prove
  geometry.ts    box gaps, cable and strap paths
  engine.ts      the rule engine, limit lines, panel calculator, risk index
  fixes.ts       fix catalogue as design edits
  planner.ts     ranked recommendations by re-running the engine
  selectors.ts   compliance matrix, lab readiness, version diff, heatmap
  portfolio.ts   programmes, people, chamber bookings, savings
  context.tsx    shared state
src/components/tarang/
  cabinet-3d.tsx, drafting-views.tsx, workspace.tsx, risk-drawer.tsx, heatmap.tsx, ui.tsx
src/lib/marks.ts  mark registry (id, fallback icon, where used)
```

## Limits to keep in mind

Tarang is a screening tool. The rules are first-order estimates with stated assumptions (see Rules & Assumptions); they do not replace a field solver or an accredited test. All organisations, people, products and lab reports in the dataset are fictional. Standards and test methods are real and are named for orientation, not quoted as normative text.
