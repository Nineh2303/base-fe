# SDD ledger — plan: docs/superpowers/plans/2026-11-17-tailwind-ui.md

Spec: docs/superpowers/specs/2026-11-17-tailwind-ui-design.md (binding, incl. "Calls settled after the builder review").
Branch: feat/framework. Start HEAD: 934fdb8.
Process: implementer -> tester (separate agent, user request R0 carried from previous plan) -> task reviewer -> fix loop.

## Pre-flight scan
| Pair / task | Produces vs consumes | Finding |
|---|---|---|
| T1 -> T3 | MF_PORTAL_KEY, useMfPortalTarget -> ui usePortalTo | consistent |
| T1 -> T7 | data-mf-remote scope wrapper -> e2e scope selectors | consistent |
| T2 -> T3,T5 | src/components/<kebab>/ layout + lib/utils -> portal comps, eject | consistent |
| T2 -> T7 | build:framework incl. ui -> playground dev/e2e | consistent |
| T4 -> T7 | ui detection with "*" spec -> playground deps "*" | consistent (local spec maps to ^ui version) |
| T2/T3 -> T6 | exports + styles paths -> templates | consistent |
| T7 vs existing flow.spec "remote CSS is applied" | products.css removed, primary scoped green | T7 may update the test in same commit (plan allows) |
| T1 self | 8 existing + 17 new = 25 keys | consistent |
| T2 self | styles test vs host/remote/tokens files | consistent |
| T3..T8 self | tests vs code | consistent |
No rulings needed.

## Progress
Task 1: dispatched implementer (sonnet), BASE 934fdb8
Task 1: complete (commits 934fdb8..271d738, review clean). Tester PASS (+7 tests, 212 total).
  Parked minors T1: dist-export test silently passes when dist absent (use skipIf); adversarial test asserts non-contract alias pairs border=input, primary=ring; useMfPortalTarget returns ComputedRef (OK); duplicated mount helpers in tests.
  Carry to T3: overlays open at first render teleport to body for one tick before portalEl is set — T3 must handle/verify (open-at-mount dialog ends up in scope).
  ⚠️ resolved: remoteHost(name) in loader passes the entry name (loader.ts:96) — host path covered.
Task 2: dispatched implementer (sonnet), BASE 271d738
Task 2: complete (commits 271d738..4e4bd43, review clean). Tester PASS (compile test proves @source/preflight/dark; 238 total).
  Parked minors T2: AvatarImage drops props/events (folded into T3 dispatch); dist-dependent tests skip silently without build (final review: check CI order); probe.test.ts naming/dup as-child; tailwindcss peer of ui (mf-vite must supply); destructive-foreground contrast check.
Task 3: dispatched implementer (sonnet), BASE 4e4bd43
Task 3: review Needs fixes (2 Important: Toaster boolean-prop cast overrides vue-sonner defaults; two-Toasters test asserts nothing). Fix round 1 dispatched to implementer. FIX_BASE 7294035.
  Task 3: minor (deferred): DialogContent hard-coded close X (no opt-out); duplicated test helpers portal.test/portal.adversarial; dist export test silently passes w/o dist; Select test title says click but uses Enter; no RED evidence for AvatarImage; shadcn arbitrary classes (max-h-(--reka-...), translate-y-[calc...]) not visually verified — check in T7 e2e/browser.
Task 3: fix round 1/5 (2 addressed, 1 open — new regression: Toaster drops caller props (no attrs on Teleport root); commits 7294035..aa68795). Round 2 dispatched.
Task 3: fix round 2/5 (1 addressed, 0 open; commits aa68795..f59595e).
Task 3: complete (commits 4e4bd43..f59595e, review clean).
  Task 3: minor (deferred): toaster.test non-null assertion + console.warn spy restore outside finally.
Task 4: dispatched implementer (sonnet), BASE f59595e
Task 4: review Needs fixes (Important: 2 vacuous tests in define.test.ts). Fix round 1 dispatched. FIX_BASE 84326d3.
  ⚠️ project root = process.cwd() (pre-existing, createContext(process.cwd())); spec says Vite root fallback cwd — accepted: vite runs from project dir; deferred minor for final review.
  Task 4: minor (deferred): local ui spec with undefined uiVersion → '*' (unreachable).
Task 4: fix round 1/5 (2 addressed, 0 open; commits 84326d3..08468e3).
Task 4: complete (commits f59595e..08468e3, review clean).
Task 5: dispatched implementer (sonnet), BASE 08468e3
Task 5: review Needs fixes (Important: ui vitest alias masks dist export test). Fix round 1 dispatched (+ cheap minors). FIX_BASE 0f05aef.
  Task 5: minor (deferred): eject.compile.test imports create-mf src across packages; duplicated put/fixture helpers; regex matches imports inside comments/strings (undocumented).
Task 5: fix round 1/5 (1 addressed + minors, 0 open; commits 0f05aef..2744fe7). Controller ran full suite: 36 files / 301 tests pass.
Task 5: complete (commits 08468e3..2744fe7, review clean).
Task 6: dispatched implementer (sonnet), BASE 2744fe7
Task 6: complete (commits 2744fe7..da29514, review clean). Tester PASS: real browser host+remote from generated templates (styles, single copies, scoped token isolation, login).
  Task 6: minor (deferred → folded into T8): generated READMEs don't mention Tailwind/ui/style.css theming. Minor: Login fixed ids username/password; weak Login.vue string assertion.
  Note: build:framework does not rebuild create-mf (generate needs `npm run build -w @nineh-fe-base/create-mf`) — final review.
Task 7: dispatched implementer (sonnet), BASE da29514
Task 7: implementer DONE_WITH_CONCERNS (7275b9d; 303 unit, 13/13 e2e). Concern: tw-animate-css absent → shadcn animate-in/fade/zoom/slide classes not generated (overlays work, no animation).
  Ruling: add tw-animate-css to @nineh-fe-base/ui (imported by ui styles, both host.css and remote.css via tokens or each) — shadcn-vue on Tailwind v4 depends on it; spec says shadcn-vue components — cost if wrong: one small CSS dep, removable. Carry into Task 7 fix round.
Task 7: tester PASS (+6 e2e, 19 total, 3 cold runs green). Review Needs fixes (Important: shell pages/* not converted, unstyled). Fix round 1 dispatched with: pages, tw-animate-css (ruling), duplicate logout, ambiguous selector, dev-mode check. FIX_BASE 9ca9eb0.
  Task 7: minor (deferred): CSS-dedupe test uses styleSheets.length (smoke only); decorative "mới" Badge; utils.test.ts lint fix touched (T2 file); lockfile dev-flag churn; standalone dark mode no e2e; ⚠️ standalone data-theme on html.
Task 7: fix round 1/5 (4 addressed, 0 open; commits 9ca9eb0..836d60b). dev mode verified by implementer.
Task 7: complete (commits da29514..836d60b, review clean). Note: flow.spec does not depend on data-test=logout (ui.spec does).
Task 8: complete (commits 836d60b..af48b4a, review clean; docs verified against source by reviewer).
  Task 8: minor (deferred): create-mf README missing blank line before "Template nằm trong"; mf-vite README "root mặc định cwd" wording; mf-core README omits RemoteBoundary scope prop; double blank lines.

## Final review (934fdb8..af48b4a): needs fixes — 1 Critical, 2 Important, 5 Minor
Ruling: Critical 1 (CI runs npm test before build; ui tests cannot resolve mf-core dist on a clean checkout) — fix CI order (build before test); dist-gated tests then run in CI — cost if wrong: slightly longer CI.
Ruling: Important 2 (cross-sheet order inside the utilities layer: a remote's app utilities can override the host's, e.g. host `hidden md:flex`) — the spec anti-goal "remote CSS leaking global overrides" is binding → mf-vite wraps a REMOTE build's own CSS rule blocks in `@scope ([data-mf-remote="<name>"])` (theme-layer :root vars, @property, @keyframes, @font-face stay global), pinned by e2e; docs claim "load order doesn't matter" corrected — cost if wrong: a remote cannot style outside its subtree (intended; portals live inside the scope) and needs @scope support (Chrome 118+/Safari 17.4+/Firefox 146+); if unworkable, fallback = document the limitation.
Ruling: Important 3 (ejected files import reka-ui/lucide/vue-sonner/cva not declared by the service) — eject prints missing package deps vs the project package.json; document the Toaster eject caveat — cost if wrong: an extra warning line.
Ruling: Minor 7 (Toast does not keep scoped tokens: the single host Toaster sits at host scope) — accepted deviation from spec §4, documented explicitly — cost if wrong: remote toasts use host colors.
Ruling: Minor 5 (ui version skew not runtime-checked) — document only (fixed group + ^frameworkVersion make skew unlikely) — cost if wrong: MF singleton warning only.
Fix wave: one fixer (opus) with the full list incl. minors 4, 6, mf-core README scope prop, create-mf README blank line. FIX_BASE af48b4a.

## Fix wave landed (af48b4a..a7cf694: c08745b ci, 8f5e4f4 @scope, 82931f5 eject deps, a063236 skipIf, a7cf694 docs). Fixer stopped before its report. Controller verified on a7cf694: lint/build clean, 326 unit, 21 e2e. Scoped re-review dispatched.
## User request (2026-11-17): test-gap audit of all generated code. Baseline coverage 83% lines / 80% branches. 4 parallel auditors (mf-core, ui, mf-vite+create-mf, e2e), uncommitted; controller commits per area. Added devDep @vitest/coverage-v8@5.1.0.
Final fix wave re-review: all 9 findings ADDRESSED, no new Critical/Important. Minor (deferred): create-mf README extra blank line; @scope transform dev-server path not automated (→ e2e auditor to verify in dev).
Audit relaunched (prior run killed at usage limit, no partial edits): mf-core, ui, mf-vite+create-mf in parallel; e2e auditor after them. Coverage tooling committed 93b9eb0.
Audit mf-core: +110 tests, 4 bugs fixed (2bdcb5c). Audit mf-vite+create-mf: +110 tests, 5 bugs fixed (02345ac). Audit ui: +79 tests, 0 bugs (3caf67c). Controller full run: 56 files / 624 tests pass.
  minor (deferred): cli.gaps "name validation" + ui eject.compile timed out once under parallel load (pass alone) — CI timeout risk; DEFAULT_TOKENS legacy aliases (bg/text/danger/on-primary) unmapped in Tailwind by design (allowlisted).
e2e auditor dispatched (incl. dev-mode @scope verification).
E2E audit: +14 journeys e2e (35 total, also via e2e:dev), 1 bug fixed (shell header overflow at 390px), viewer mock user (366037b).
