# Flake Postmortem

Two real incidents encountered during development of this suite.

---

## Incident 1 (Primary): create-board race under parallel load

### Symptom

`board.spec.ts` and any spec that calls `BoardPage.createBoard()` failed
intermittently when the full suite ran `fullyParallel: true` against the single
shared authenticated user. The failures were not reproducible serially. Three
distinct failure modes appeared:

1. The sidebar `+ Add board` click was a no-op — the template-picker dialog
   never opened.
2. The `Create an empty board` button click threw a detached-element error
   mid-transition.
3. The board title input showed the name of a *different* board immediately
   after creation, causing the subsequent `fill` assertion to fail.

### Root cause

All three modes share the same root: clicking animating or still-reconciling
React elements and asserting on transient state.

- **No-op click**: the sidebar was not yet interactive when the click landed.
  Focalboard's sidebar re-renders after every board creation, and under parallel
  load a concurrent test's creation was still flushing when the next test tried
  to click `+ Add board`.
- **Detached-element error**: the template-picker animates in. The button was
  visible (Playwright's `toBeVisible()` passed) but the element was being
  replaced by React's reconciler mid-click.
- **Title race**: right after creation, the board title input briefly showed
  the previously focused board's title while React reconciled the new board's
  state. A single `fill` issued before reconciliation finished wrote into the
  wrong (soon-to-be-replaced) input.

### Fix

`BoardPage.createBoard()` (`pages/BoardPage.ts`) was rewritten in three layers:

1. **Retry the whole open → create sequence** with `expect(async () =>
   {...}).toPass()`, gating on `boardContainer` becoming visible — the only
   reliable signal that the board was actually created and React has settled.
2. **Retry the title fill** until `toHaveValue` confirms the value stuck,
   instead of issuing a single `fill` and moving on.
3. **Gate the return** on the default column being present (`columns` count > 0),
   so callers observe the finished board state.

### Retry rationale

`retries: 1` in CI is a safety net for residual infrastructure hiccups (Docker
networking jitter, CI runner load spikes), applied *only after* the root causes
above were addressed in the page object. It is not a substitute for fixing the
races. The web-first assertions and `toPass()` wrapping the create sequence are
the actual fix; the single retry absorbs the long tail that no amount of
deterministic waiting can fully eliminate in a shared-user parallel run.

---

## Incident 2 (Secondary): cross-browser matrix setup failure

### Symptom

When the three-browser CI matrix (`chromium`, `firefox`, `webkit`) was first
introduced, the `firefox` and `webkit` jobs failed at the `setup` (auth) project
step with:

```
browserType.launch: Executable doesn't exist at …/chrome-headless-shell
```

The `chromium` job passed; the other two did not.

### Root cause

The `setup` project in `playwright.config.ts` has no browser configured, so
Playwright runs it on the default engine — Chromium (`chrome-headless-shell`).
Each matrix job ran `playwright install <browser>` for *only its own engine*.
The `firefox` and `webkit` jobs therefore had no Chromium binary when `setup`
ran.

### Fix

Each matrix job in `.github/workflows/ci.yml` now installs **both** the matrix
browser and `chromium`:

```yaml
run: npx playwright install --with-deps chromium ${{ matrix.browser }}
```

`storageState` (`.auth/user.json`) is browser-agnostic — it contains only
cookies and localStorage — so generating it once on Chromium and reusing it
across all three browser projects is safe and correct.
