# Local Setup & Run Guide

How to run the full Playwright suite against the hermetic Focalboard target on
your own machine. The README has a condensed version; this is the step-by-step
with prerequisites, per-OS notes, and troubleshooting.

---

## 1. Prerequisites

| Tool | Version | Notes |
|---|---|---|
| **Node.js** | 22.x | Matches CI (`actions/setup-node@v4`, `node-version: 22`). Use `nvm`/`fnm` if you juggle versions. |
| **Docker** | any recent | Docker Desktop (macOS/Windows) or Docker Engine + Compose v2 (Linux). The daemon **must be running** before you start. |
| **Git** | any | To clone the repo. |

Verify:

```bash
node --version      # v22.x
docker --version    # Docker version 2x.x
docker compose version
```

> **Windows:** run the commands from Git Bash, WSL, or PowerShell. Docker
> Desktop must be started (the whale icon in the tray) — a stopped daemon fails
> with `error during connect: ... dockerDesktopLinuxEngine`.

---

## 2. Install dependencies and browsers

```bash
# From the repo root
npm ci                                              # exact, lockfile-pinned install
npx playwright install --with-deps chromium firefox webkit
```

`--with-deps` also installs the OS libraries the browsers need. On macOS/Windows
the `--with-deps` part is a no-op (only Linux needs the system packages), so it
is safe to keep.

If you only want a quick smoke run, `chromium` alone is enough:

```bash
npx playwright install --with-deps chromium
```

---

## 3. Boot the hermetic Focalboard target

```bash
docker compose up -d
```

This starts Focalboard 7.11.4 (published on host port **8088** → container port
8000). It is fully self-contained: no accounts, no secrets, no external calls.

Wait until it is ready — the app answers `GET /login` with `200`:

```bash
# quick manual check (optional; the `setup` project also waits automatically)
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8088/login   # -> 200
```

The `setup` (auth) Playwright project polls this endpoint, then registers or logs
in once and saves `storageState` to `.auth/user.json`. Every browser project
reuses that state, so you authenticate exactly once per run.

---

## 4. Type-check and run tests

```bash
npm run typecheck            # tsc --noEmit — catches type errors fast

# Full suite, all three engines + a11y (visual excluded on non-Linux, see below)
npx playwright test

# A single engine
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit

# Just the smoke test (fastest signal)
npm run test:smoke           # == playwright test --project=chromium

# One spec file
npx playwright test tests/move-card.spec.ts
```

The HTML report lands in `playwright-report/`:

```bash
npx playwright show-report
```

---

## 5. Visual snapshots (`visual` project) — read before running locally

The `visual` project (`tests/visual.spec.ts`) compares full-page screenshots
against **Linux baselines** committed under `tests/visual.spec.ts-snapshots/`
(named `*-linux.png`). Screenshots are OS-specific: fonts and anti-aliasing
differ between Linux, macOS, and Windows.

- **On Linux:** it just works — `npx playwright test --project=visual`.
- **On macOS/Windows:** the committed Linux baselines will **not** match your
  local render, so the comparison fails by design. Do **not** regenerate them
  with `--update-snapshots` locally and commit the result — that would replace
  the CI-matching baselines and break the `visual` CI job.

To reproduce CI's exact rendering locally without a Linux box, run the visual
project inside the official Playwright Linux container:

```bash
docker run --rm --network host -v "$PWD":/work -w /work \
  mcr.microsoft.com/playwright:v1.61.1-jammy \
  bash -c "npm ci && npx playwright test --project=visual"
```

(Requires Focalboard already running via `docker compose up -d`; `--network host`
lets the container reach `localhost:8088`.)

The authoritative baselines are always generated on the CI Linux runner — see
`docs/flake-postmortem.md` for how they were bootstrapped.

---

## 6. Tear down

```bash
docker compose down          # stop and remove the Focalboard container
```

To also drop the persisted auth state (forces a fresh register/login next run):

```bash
rm -rf .auth
```

---

## 7. Troubleshooting

| Symptom | Cause / Fix |
|---|---|
| `error during connect: ... dockerDesktopLinuxEngine` | Docker daemon not running. Start Docker Desktop and retry. |
| Tests hang at setup / `Focalboard never became ready` | Port 8088 not answering. Check `docker compose ps` and `docker compose logs`; ensure nothing else occupies :8088. |
| `Executable doesn't exist at .../chrome-headless-shell` | Browser not installed. Run `npx playwright install chromium` (the `setup` project runs on Chromium regardless of which engine you test). |
| `visual` tests fail on macOS/Windows | Expected — baselines are Linux-only. See §5; run in the Playwright Linux container or rely on CI. |
| Flaky create-board failures locally | The suite runs `fullyParallel` against one shared user; the page objects retry the known races (see `docs/flake-postmortem.md`). Re-run; if persistent, reduce workers: `npx playwright test --workers=1`. |

---

## Quick reference

```bash
docker compose up -d                                                   # 1. boot target
npm ci && npx playwright install --with-deps chromium firefox webkit   # 2. deps
npm run typecheck                                                      # 3. type-check
npx playwright test                                                    # 4. run
docker compose down                                                    # 5. tear down
```
