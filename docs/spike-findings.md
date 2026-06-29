# Discovery Spike Findings — Focalboard target + DnD probe

> Source issue: #2 (parent #1). These findings empirically lock the facts every
> downstream slice (#3–#10) builds on. All results were produced against the
> committed `docker-compose.yml` target on 2026-06-29.

## 1. Target & boot

- **Image:** `mattermost/focalboard:7.11.4` (standalone personal-server; hermetic — no external services, no secrets).
- **Boot:** `docker compose up -d` (see `docker-compose.yml`).
- **Port:** server listens on container port **8000**, published to host **8088** → app served at `http://localhost:8088`.
- **Readiness:** `GET /login` returns **200** once the server is up. The compose healthcheck polls `http://localhost:8000/login` inside the container; downstream tests should gate on the same endpoint.

## 2. Authentication flow

First run requires registering a user (no seeded credentials).

**Register** — `GET /register`:
| Field | Selector |
|---|---|
| Email | `#login-email` (placeholder "Enter email") |
| Username | `#login-username` |
| Password | `#login-password` (type=password) |
| Submit | `button[type=submit]` (text "Register") |

After submit the server **auto-logs-in** and redirects to `/`. A welcome/tour dialog appears — dismiss via `button[aria-label="Close dialog"]` then `Escape`. A default **"Meeting Agenda"** board is seeded on first run; tests should create their own boards rather than rely on it.

**Login** — `GET /login`: `#login-username`, `#login-password`, submit `button[type=submit]` (text "Log in").

> Auth strategy for the suite: a global-setup registers/logs in **once** and persists `storageState`; all projects reuse it.

## 3. Core selectors (board / column / card / modal)

| Concept | Selector | Notes |
|---|---|---|
| Add board | `.add-board` ("+ Add board") → then click **"Create an empty board"** | sidebar affordance |
| Board container | `.BoardComponent` / `.Kanban` | empty board defaults to **Board (Kanban) view** |
| Column (group) | `.octo-board-column` | one per Select-property value; default group is "No Status" |
| Column header | `.octo-board-header-cell.KanbanColumnHeader` | |
| Add group (column) | text **"+ Add a group"** | |
| Add card | text **"+ New"** (scoped within a column) | opens the card dialog |
| Card | `.KanbanCard` — **`draggable="true"`** | see DnD section |
| Card title (on board) | `.octo-titletext` (inside `.octo-icontitle`) | use for "which column is the card in" assertions |
| Card dialog | `.Dialog.cardDialog` | |
| Card title (in dialog) | `.cardDialog .octo-titletext` | editable |
| Close dialog | `.dialog__close` (aria "Close dialog") or `Escape` | |
| Card actions menu | `.KanbanCard .CardActionsMenuIcon` (⋯) | **only rendered on card hover** — hover the card first (relevant for #8 archive flow) |

Focalboard exposes very few stable `data-testid`s in these views, so selectors are class-based. They are stable across reload within 7.11.4.

## 4. Drag-and-drop probe — THE headline finding

Focalboard cards carry `draggable="true"`: the board uses **react-dnd's HTML5 backend**, which listens to native `dragstart/dragenter/dragover/drop/dragend` events — **not** pointer/mouse-sensor events.

Probe: move a card from column 0 → column 1, then re-read which `.octo-board-column` contains the card. Run fresh on each engine.

| Method | Chromium | Firefox | WebKit |
|---|---|---|---|
| Playwright `locator.dragTo()` | ❌ timeout | ❌ timeout | ❌ timeout |
| Playwright `page.dragAndDrop()` | ❌ timeout | ❌ timeout | ❌ timeout |
| Manual mouse stepping (`mouse.down`→stepped `move`→`up`) | ⚠️ **silent no-op** (card stays) | ⚠️ silent no-op | ⚠️ silent no-op |
| **Synthetic HTML5 `DragEvent`s w/ shared `DataTransfer`** | ✅ **moved 0→1** | ✅ moved 0→1 | ✅ moved 0→1 |

### Conclusions

1. **`DragHelper` strategy:** dispatch real `DragEvent`s carrying one shared `DataTransfer` in page context, in order: `dragstart` (on the card) → `dragenter` → `dragover` → `drop` (on the destination `.octo-board-column`) → `dragend` (on the card). This is the only approach that registers, and it is **engine-agnostic** — the same code moved the card on all three engines.
2. **No WebKit-specific adjustment was needed.** Because the synthetic-event approach bypasses the browser's native drag machinery entirely, the per-engine differences that plague mouse-based dragging don't apply. (This is itself the documented rationale for the chosen mechanic.)
3. **Documented bug the suite catches (#7):** the "obvious" approaches — `page.dragAndDrop`/`dragTo` and even hand-rolled mouse stepping — **fail silently or time out** against this HTML5-backend target. A test that drives the naive path and asserts the card did *not* move proves the suite verifies *state*, not absence of error, and justifies the manual `DragHelper`.

> ⚠️ The PRD's initial hypothesis (manual mouse stepping works, native fails) was **half right**: native does fail, but mouse stepping *also* fails — only DataTransfer simulation works. Downstream `DragHelper` (#6) is committed to the synthetic-event approach.

## 5. Accessibility-clean view candidate

axe-core (`wcag2a/2aa, wcag21a/21aa`) violation types by view:

| View | Violation types | Detail |
|---|---|---|
| Login page (full) | 2 | `color-contrast`, `meta-viewport` |
| **Login `<form>` (scoped `include('form')`)** | **0** | ✅ strict-clean |
| Empty board (full) | 5 | `button-name`, `color-contrast`, `link-name`, `meta-viewport`, `nested-interactive` |
| Empty board `.BoardComponent` only | 4 | still dirty |

**Chosen a11y target (#9):** the **login form**, scanned scoped to `form`, asserted at **strict zero violations**.
**Rationale:** it is a genuinely clean, self-contained view we can honestly assert against. The board view carries Focalboard's own a11y debt (`nested-interactive`, `button-name`), which is **out of scope to fix** (we audit, we don't patch Focalboard). Scoping to the login form makes the zero-violation claim truthful and enforceable — resolving the PRD's one acknowledged risk.

## 6. Implications for downstream slices

- **#3 walking skeleton:** reuse this `docker-compose.yml`; readiness fixture polls `/login`; global-setup registers via §2 and saves `storageState`; smoke spec asserts `.BoardComponent`/login readiness.
- **#4 BoardPage / create-board:** `.add-board` → "Create an empty board"; assert board URL/`.BoardComponent`.
- **#5 add-column/add-card:** "+ Add a group", "+ New"; assert `.octo-board-column` / `.octo-titletext`.
- **#6 DragHelper / move-card:** synthetic `DataTransfer` events per §4; assert card moved between `.octo-board-column`s by title.
- **#7 naive-fails demo:** drive `page.dragAndDrop`/mouse-stepping, assert the card did **not** move.
- **#8 CardModal / archive:** hover `.KanbanCard` to reveal `.CardActionsMenuIcon`; open the ⋯ menu for the archive/delete action.
- **#9 a11y:** login form, scoped, strict zero-violation.
