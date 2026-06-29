# e2e-drag-and-drop-trello

![CI](https://github.com/bykplx1/e2e-drag-and-drop-trello/actions/workflows/ci.yml/badge.svg)

End-to-end test suite (Playwright + TypeScript) targeting a hermetic
[Focalboard](https://www.focalboard.com/) kanban board running in Docker. The
suite registers/logs in once, persists `storageState`, and exercises the board
UI across Chromium, Firefox, and WebKit.

This is the walking skeleton (issue #3): a hermetic target, authenticated setup,
one smoke spec proving the board loads, and a minimal CI run.

## Run locally

Requires Node 22 and a running Docker daemon.

```bash
# 1. Boot the hermetic Focalboard target (host :8088 -> container :8000)
docker compose up -d

# 2. Install dependencies and the chromium browser
npm ci
npx playwright install --with-deps chromium

# 3. Type-check and run the smoke test
npm run typecheck
npm run test:smoke      # playwright test --project=chromium

# 4. Tear down when finished
docker compose down
```

The `setup` project waits for Focalboard readiness (`GET /login` -> 200),
registers-or-logs-in once, and saves `storageState` to `.auth/user.json`; the
browser projects reuse it. The HTML report is written to `playwright-report/`.
