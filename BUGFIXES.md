# Bug Fixes & Verification Guide

This document describes the three production bugs fixed in the Node.js + React stack, where the changes live, and how to verify they stay fixed.

See also: [ARCHITECTURE.md](./ARCHITECTURE.md) for system design, API surface, and request flows.

## Summary

| Bug | Symptom | Root cause | Fix location |
|-----|---------|------------|--------------|
| **1** | Saving a **past** service start date showed “cannot be in the **future**” | Comparison was inverted (`startDate < today`) | `frontend/src/utils/validation.ts`, `AlchemistProfile.tsx` |
| **2a** | Dragging orders between columns appeared to work but status never changed | GraphQL resolver validated status but never ran `UPDATE` | `backend/src/api/potions.ts` |
| **2b** | Drops onto a card (not empty column space) did nothing | HTML5 DnD fires `drop` on the element under the cursor; cards had no handlers | `frontend/src/components/PotionBoard.tsx`, `frontend/src/utils/validation.ts` |

---

## Bug 1 — Service date validation

### What was wrong

In `AlchemistProfile.updateProfile`, the guard used:

```typescript
if (startDate < today) {
  setError('Service start date cannot be in the future');
}
```

That rejects **past** dates while the message describes **future** dates.

### How it was fixed

Validation was extracted to `validateServiceStartDate()` in `frontend/src/utils/validation.ts`:

```typescript
if (startDate > today) {
  return 'Service start date cannot be in the future';
}
```

Past dates and today are accepted. Future dates are blocked on **both** client and server:

- **Client:** `validateServiceStartDate()` in `frontend/src/utils/validation.ts`
- **Server:** same rule in `backend/src/utils/validation.ts`, enforced on `POST` and `PUT /api/alchemist/:name` (returns `400`)

### Manual check

1. Log in and open **Edit Profile**.
2. Set service start date to a **future** date → expect error, no save.
3. Set a **past** date → expect save and a positive “Years of Service” value.

---

## Bug 2a — Status mutation did not persist

### What was wrong

`updatePotionOrderStatus` in `backend/src/api/potions.ts` only ran:

```typescript
const row = db.prepare('SELECT * FROM potion_orders WHERE id = ?').get(id);
return row;
```

The UI called the mutation successfully, but SQLite never changed.

### How it was fixed

The resolver now executes:

```typescript
db.prepare('UPDATE potion_orders SET status = ? WHERE id = ? RETURNING *').get(status, id);
```

Invalid statuses and missing IDs still throw.

### Manual check

1. Open the potion board.
2. Drag an order to another column.
3. Refresh the page — the card should remain in the new column.

---

## Bug 2b — Drag-and-drop event targeting

### What was wrong

Only kanban **columns** handled `onDrop`. Dropping onto a **card** inside a column targeted the card element, which had no drop handler, so nothing happened.

### How it was fixed

- Added `onDragOver` and `onDrop` to each `.kanban-card`.
- Stored order id in `dataTransfer` during `dragstart` (avoids stale React state on drop).
- Skipped no-op drops when status is unchanged.
- Surfaced GraphQL errors via `actionError`.

Helper functions `resolveDraggedOrderId()` and `shouldApplyStatusChange()` live in `frontend/src/utils/validation.ts` for unit testing.

### Manual check

Drag an order and drop it **onto another card** in a different column — the move should still apply.

---

## Docker notes

- Images use `node:24-bookworm-slim` (Alpine failed on this host with `exec format error`).
- Backend mounts `./images` read-only at `/images` for profile avatars.
- Frontend uses `API_PROXY_TARGET=http://backend:4000` for Vite proxying.

```bash
docker compose up --build
# Frontend: http://localhost:3000
# Backend:  http://localhost:4000
```

---

## Automated verification

### Unit tests (no running server)

```bash
npm run test:unit
```

- **Frontend** (`frontend/src/utils/validation.test.ts`): date validation regression, drag-drop helpers (runs locally with Vitest).
- **Backend** (`backend/src/api/potions.smoke.test.ts`): status persistence, invalid status, reassignment. Runs inside the Docker backend container because it requires **Node 24+** (`node:sqlite`).

If you already have Node 24+ locally:

```bash
npm run test:unit:backend:local
```

### Integration smoke tests (requires stack running)

```bash
docker compose up -d --build
npm run test:smoke
```

Hits live services at `http://localhost:4000` and `http://localhost:3000` (override with `API_BASE_URL` / `FRONTEND_BASE_URL`).

Covers:

- `/health`
- REST alchemist endpoints
- GraphQL status mutation round-trip
- Frontend HTML shell and `/graphql` proxy

### Full test suite

```bash
npm run test:all
```

Runs unit tests, then integration smoke tests.

### Trivy container scan

Build images and scan for HIGH/CRITICAL vulnerabilities:

```bash
npm run scan:trivy
```

Requires [Trivy](https://trivy.dev/) via Docker. Exits non-zero when HIGH/CRITICAL findings are reported (suitable for CI).

Note: Debian base-image CVEs (e.g. `perl-base`, `zlib1g`) are common in slim images and may appear even when application code is clean. Tune with `TRIVY_SEVERITY=MEDIUM,HIGH,CRITICAL` or review the report and base-image upgrades separately.

---

## Files touched

| File | Purpose |
|------|---------|
| `frontend/src/utils/validation.ts` | Shared validation + drag-drop logic (docstrings) |
| `frontend/src/components/AlchemistProfile.tsx` | Uses `validateServiceStartDate` |
| `frontend/src/components/PotionBoard.tsx` | Card drop handlers + helpers |
| `backend/src/utils/validation.ts` | Server-side date validation (defense-in-depth) |
| `backend/src/utils/validation.smoke.test.ts` | Backend validation unit tests |
| `backend/src/api/alchemists.ts` | REST routes + date validation on create/update |
| `backend/src/api/potions.ts` | Persists status updates |
| `backend/src/api/potions.smoke.test.ts` | Backend GraphQL smoke tests |
| `frontend/src/utils/validation.test.ts` | Frontend unit tests |
| `tests/smoke/integration.test.ts` | HTTP integration smoke tests |
| `ARCHITECTURE.md` | System architecture and request flows |
| `scripts/trivy-scan.mjs` | Docker image security scan |
| `scripts/run-ci.mjs` | Local CI pipeline runner |
| `scripts/format-pr-comment.mjs` | Markdown formatter for PR result comments |
| `.github/workflows/ci.yml` | GitHub Actions CI pipeline |

---

## Verification results (last run)

Recorded when the smoke suite and pipeline were validated locally on **2026-06-26**.

| Suite | File | Tests | Result |
|-------|------|-------|--------|
| Frontend unit | `frontend/src/utils/validation.test.ts` | 8 | **Pass** |
| Backend unit | `potions.smoke.test.ts` + `validation.smoke.test.ts` | 7 | **Pass** |
| Integration smoke | `tests/smoke/integration.test.ts` | 7 | **Pass** |
| **Total** | | **22** | **Pass** |

### What each suite proves

| Suite | Bug / area covered |
|-------|-------------------|
| Frontend unit | Bug 1 — past dates allowed, future dates rejected; Bug 2b — drag id resolution & no-op drops |
| Backend unit | Bug 1 — server date validation; Bug 2a — `UPDATE` persists status; invalid status / reassignment |
| Integration | `/health`, REST profiles, **PUT rejects future date**, GraphQL mutation round-trip (with revert), frontend proxy |

### Trivy results (informational)

| Scan | Result | Notes |
|------|--------|-------|
| Full image (`npm run scan:trivy`) | Exit 1 | Debian base-image CVEs (`perl-base`, `zlib1g`, etc.) in `node:24-bookworm-slim` |
| Library-only (`npm run scan:trivy:library`) | Use for CI gate | Scans npm dependencies only; suitable blocking check in pipeline |

Reports are written to `reports/trivy-*.txt` when scanning locally.

---

## CI pipeline

### GitHub Actions — `.github/workflows/ci.yml`

Runs on every **push** and **pull request** to `main` / `master`.

| Job | Purpose | Required |
|-----|---------|----------|
| **test** | Typecheck/build, `docker compose up`, unit tests (22), integration smoke, job summary | Yes — must pass |
| **trivy** | Library vulnerability scan on both images; full SARIF upload | Yes — library scan must pass |

Artifacts uploaded on every run:

- `ci-test-results` → `reports/ci-results.json`
- `trivy-reports` → `reports/trivy-*.txt`

On **pull requests**, the `report` job posts (and updates) a comment on the PR with test/Trivy status using `peter-evans/create-or-update-comment` (`comment-tag: potion-brewery-ci-results`). Each new push replaces the previous comment instead of spamming the thread.

### Local pipeline (mirrors CI)

```bash
npm run ci          # build, wait, test:all, write reports/ci-results.json
npm run ci:full     # above + Trivy (optional step, non-blocking in local runner)
```

Individual commands still work:

```bash
npm run test:all
npm run scan:trivy:library   # blocking-style app dependency scan
```

### CI-friendly one-liner

```bash
docker compose up -d --build && npm run test:all && npm run scan:trivy:library
```

---

## Quick wins applied

| Improvement | Where | Why |
|-------------|-------|-----|
| **Architecture doc** | [ARCHITECTURE.md](./ARCHITECTURE.md) | Diagrams, API table, flows, undo design sketch |
| **README links + CI badge** | [README.md](./README.md) | Reviewers find docs, Docker, and `npm run ci` quickly |
| **Backend date validation** | `backend/src/utils/validation.ts`, `alchemists.ts` | Bug 1 defense-in-depth; not bypassable via API |
| **CI build step** | `.github/workflows/ci.yml` | Catches TypeScript/build errors tests may miss |
| **Job summary on every run** | CI `test` job → GitHub Actions Summary tab | Results visible on push to main, not only PR comments |
| **PR results comment** | CI `report` job | Updates single comment per PR on each push |
| **Integration test revert** | `integration.test.ts` | Status mutation test restores original state |
| **Trivy library-only gate** | CI + `npm run scan:trivy:library` | Blocks on app deps, not Debian base-image noise |
| **npm cache fix** | CI uses `package.json` paths (lockfiles gitignored) | Avoids broken cache config |
