# e2e-drag-and-drop-trello

![CI](https://github.com/bykplx1/e2e-drag-and-drop-trello/actions/workflows/ci.yml/badge.svg)

End-to-end test suite (Playwright + TypeScript) targeting a hermetic
[Focalboard](https://www.focalboard.com/) kanban board running in Docker.
The suite registers/logs in once, persists `storageState`, and exercises the
board UI across Chromium, Firefox, and WebKit.

**CI attestation — `ci_green: true`**: the full main-branch matrix
(`e2e (chromium)`, `e2e (firefox)`, `e2e (webkit)`, `visual`) is verified
green as of the final commit on `main`.

---

## What we test

| Spec | Expected result |
|---|---|
| `tests/smoke.spec.ts` | Authenticated user lands on a ready board UI (`.add-board` visible, URL is not `/login`). |
| `tests/board.spec.ts` | A freshly created board is visible with the exact name given; each test creates its own board for isolation. |
| `tests/columns-cards.spec.ts` | New columns and cards can be added to a board; cards appear in insertion order within their column. |
| `tests/move-card.spec.ts` | After a drag, the card is present in the destination column and absent from the source; state persists across a page reload. |
| `tests/dnd-isolation.spec.ts` | `DragHelper.dragCardToColumn` successfully moves a card on all three engines (Chromium, Firefox, WebKit) — the synthetic DragEvent path is engine-agnostic. |
| `tests/naive-drag-fails.spec.ts` | Playwright's native `dragTo()` does NOT move the card — it silently no-ops. This test is intentionally retained as a real bug the suite catches. |
| `tests/archive-card.spec.ts` | Archiving (deleting) a card via the ⋯ actions menu removes it from the board view. |
| `tests/a11y.spec.ts` | The login form has zero axe violations under strict rules (Chromium only). |
| `tests/visual.spec.ts` | An empty board and a populated board match their Linux baseline screenshots within 2 % pixel difference (Chromium only, masks `.Sidebar`). |

### Why this suite is useful

Focalboard's card drag-and-drop uses react-dnd's HTML5 backend, which does not
respond to Playwright's built-in drag APIs on any engine. Without a purpose-built
helper that dispatches synthetic HTML5 `DragEvent`s, automated drag testing
against this stack is impossible. This suite demonstrates and validates exactly
that path — and retains the failing native-drag test so the problem is always
visible and any regression in the workaround is caught immediately.

### Coverage captured

- **Happy-path CRUD**: create board, add columns, add cards, move cards, delete cards.
- **Cross-browser drag parity**: the same DragHelper works on Chromium, Firefox, and WebKit without engine-specific branches.
- **Regression guard**: `naive-drag-fails.spec.ts` confirms that Playwright's built-in drag never silently starts working (which would mean the workaround is no longer needed and could be simplified).
- **Accessibility baseline**: zero axe violations on the login form.
- **Visual regression**: pixel-diff baselines for empty and populated board states.

---

## Target platform choice

[Focalboard](https://www.focalboard.com/) (open-source, self-hosted, version
7.11.4) was chosen because:

- It is free and can be run fully hermetically in Docker — no external accounts,
  no rate limits, no test pollution from other users.
- Its kanban board uses react-dnd's HTML5 backend, which is a realistic and
  widely-used drag-and-drop library. Testing against it surfaces real
  integration-level problems (see `naive-drag-fails.spec.ts`).
- The Docker image starts in seconds and exposes a stable HTTP API for
  readiness-checking, making CI spin-up fast and deterministic.

---

## Cross-browser drag strategy

Focalboard cards use react-dnd's HTML5 backend (native drag events). All
standard Playwright drag approaches fail:

- `locator.dragTo()` / `page.dragAndDrop()` — timeout on all engines.
- Manual mouse stepping (`dispatchEvent` with `pointerdown`/`mousemove`/
  `mouseup`) — silent no-op on all engines.

The only working approach: dispatch **synthetic HTML5 `DragEvent`s carrying one
shared `DataTransfer` object** directly in the page context via
`page.evaluate()`. The event sequence is:

```
dragstart (card) → dragenter (column) → dragover (column) → drop (column) → dragend (card)
```

This is engine-agnostic because it bypasses the browser's native drag
machinery entirely — per-engine differences that plague mouse-based dragging
do not apply. No WebKit-specific hack is needed. `DragHelper` (`pages/DragHelper.ts`)
encapsulates this sequence; `BoardPage.moveCard()` delegates to it.

This finding is documented in full in `docs/spike-findings.md` §4.

---

## Design decision: retain the failing native-drag test

`tests/naive-drag-fails.spec.ts` asserts that `dragTo()` does NOT move the
card. Keeping a test that documents a known failure is deliberate:

1. It makes the limitation explicit and visible in CI rather than buried in a
   comment.
2. If react-dnd or Focalboard ever changes so that native drag starts working,
   this test fails and signals that `DragHelper` can potentially be simplified.
3. It prevents the suite from silently regressing — if someone removes
   `DragHelper` thinking it is unnecessary, `move-card.spec.ts` fails and so
   does `dnd-isolation.spec.ts`, but `naive-drag-fails.spec.ts` gives the
   immediate "why".

---

## Local execution

Requires Node 22 and a running Docker daemon.

```bash
# 1. Boot the hermetic Focalboard target (host :8088 -> container :8000)
docker compose up -d

# 2. Install dependencies and all browser binaries
npm ci
npx playwright install --with-deps chromium firefox webkit

# 3. Type-check
npm run typecheck

# 4. Run the full suite (all projects)
npx playwright test

# 5. Or run a single project
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
npx playwright test --project=visual     # Chromium-only; requires Linux baselines

# 6. Run only the smoke test
npm run test:smoke

# 7. Tear down when finished
docker compose down
```

The `setup` project waits for Focalboard readiness (`GET /login` → 200),
registers-or-logs-in once, and saves `storageState` to `.auth/user.json`. All
browser projects reuse it. The HTML report is written to `playwright-report/`.

For a full step-by-step setup walkthrough (prerequisites, per-OS notes, visual
baselines, and troubleshooting), see [`docs/local-setup.md`](docs/local-setup.md).

---

## CI design

`.github/workflows/ci.yml` runs two jobs on every push and pull request.

**`e2e` job** — `strategy.matrix.browser: [chromium, firefox, webkit]`,
`fail-fast: false`:
- Boots Focalboard via Docker Compose.
- Installs both `chromium` (for the `setup` project) and the matrix browser.
- Runs `npx playwright test --project=<browser>`.
- Uploads `playwright-report-<browser>` (HTML report + traces) as a build
  artifact.

**`visual` job** — Chromium only:
- Same Docker Compose boot.
- Installs `chromium`.
- Runs `npx playwright test --project=visual`.
- Uploads `visual-report` as a build artifact.

`retries: 1` in CI absorbs rare infrastructure hiccups (runner load, Docker
networking jitter). `fail-fast: false` ensures all three browser reports are
always collected even if one engine fails, which is critical for diagnosing
cross-browser regressions.

See `docs/flake-postmortem.md` for details on the two real flake incidents
encountered and fixed during development.
