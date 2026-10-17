# Phase 3J Part 1 — local preview and validation

## Safe local preview

Branch: `firebase-preparation`. Preserve all existing dirty files. Use synthetic emulator accounts only; do not import the October 12 checkpoint, replace original users, or inspect real company records. Original company data remains unverified.

```powershell
Set-Location 'C:\Users\carlo\Documents\ChatGPT\Orvex 1'
git branch --show-current
git status --short
node scripts/wait-financial-emulators.mjs
```

Reuse the existing isolated service group: project `demo-orvex-phase3c-tests`, Auth 9299, Firestore 8280, Functions 5301. Only if that group is absent, start in a dedicated terminal:

```powershell
npm run emulators:finance
```

Never reset/import an emulator to make a test work. For a deliberate restart of a data-bearing service, first follow `emulator-safe-restart.md`: export to a new directory and validate without overwriting a backup. No data-bearing service was restarted during this phase.

Start an isolated frontend only if 5177 is free:

```powershell
$env:VITE_FIREBASE_EMULATOR_PROJECT='demo-orvex-phase3c-tests'
$env:VITE_ENABLE_PUBLIC_SIGNUP='false'
npm run dev -- --port 5177 --strictPort --configLoader runner
```

Open `http://127.0.0.1:5177/account` and sign into an existing synthetic emulator account. Do not enter production credentials. The ordinary frontend on 5173 can show the same company UI only when configured for its matching local emulator group; the browser-local dashboard at `/` is deliberately unchanged. Use `/account` to review the company dashboard.

Review Operations overview, metric queue selection and work-order links. Collapse/expand the desktop rail and hover/focus icons. Scroll navigation to Business/Administration. Switch between companies for which the synthetic account has verified membership. On a phone, open the menu, inspect company selector/groups/account controls, close with Escape or backdrop, and select a module. Keyboard Tab/Shift+Tab stays inside an open drawer and focus returns when closed. Technician accounts receive authorized self-module links without company-wide KPIs or financial navigation.

## Test commands

The new suite creates uniquely identified synthetic fixture companies/users and never imports, resets or deletes original data:

```powershell
npx playwright test --config emulator-tests/workspace-ui.config.ts --output tmp/phase3j-ui-results
npm run test:dispatch
npm run test:dispatch:browser
npm run test:integrations
npm run test:integrations:browser
npm run test:accounting
npm run test:accounting:browser
npm run test:employees
npm run test:employees:browser
npm run test:finance
npm run test:finance:browser
npm run test:finance:compat
node scripts/run-phase3c-tests.mjs
npx playwright test --config emulator-tests/pricing.config.ts --output tmp/phase3j-pricing-results
node scripts/prepare-phase3d-regressions.mjs
npx playwright test --config tmp/phase3d-work-order-regression/playwright.config.ts --output tmp/phase3j-workorder-results
npm test -- --output tmp/phase3j-local-results
npx playwright test --config audit/playwright.config.ts --output tmp/phase3j-audit-results
npx tsc -b
npm run build
npm audit
npm audit --prefix functions
```

Local application/recovery and storage-audit tests use the ordinary frontend on 5173. Run browser suites sequentially and avoid editing watched source or restoring generated preview images during final runs; Vite can interrupt a test with a reload. Existing mobile tests now explicitly open the drawer and wait for company switching to finish. Timekeeping still uses its existing service, accessed explicitly after a Dashboard reload.

Registration/directory tests require a temporary frontend on 5178 using the same synthetic emulator project and `VITE_ENABLE_PUBLIC_SIGNUP='true'`. Follow `phase3f-local-testing.md` for its setup; close the synthetic server gate in a finally block:

```powershell
node scripts/prepare-isolated-regressions.mjs enabled phase3c
try {
  npx playwright test --config tmp/isolated-regressions-enabled-phase3c/playwright.config.ts --output tmp/phase3j-auth-results
} finally {
  node scripts/prepare-isolated-regressions.mjs disabled phase3c
}
npx playwright test --config tmp/isolated-regressions-disabled-phase3c/playwright.config.ts --output tmp/phase3j-signup-results
```

Stop only the temporary 5178 frontend you started. The completed run closed this gate and stopped that frontend; normal public signup stays disabled. No production configuration changed.

## Validation results — October 16, 2026

| Suite | Passed | Failed |
|---|---:|---:|
| New dashboard/sidebar browser tests | 7 | 0 |
| Phase 3I model/backend/rules | 36 | 0 |
| Phase 3I browser and complete synthetic workflow | 5 | 0 |
| Phase 3H backend/API/signatures/triggers/rules | 29 | 0 |
| Phase 3H browser | 3 | 0 |
| Phase 3G backend/rules | 24 | 0 |
| Phase 3G browser | 3 | 0 |
| Phase 3F backend/policy/rules | 24 | 0 |
| Phase 3F browser | 7 | 0 |
| Phase 3E backend/model | 27 | 0 |
| Phase 3E browser | 6 | 0 |
| Phase 3D compatibility backend/model | 26 | 0 |
| Phase 3D compatibility browser | 4 | 0 |
| Phase 3C/security/directory/work-order/backup backend/rules | 40 | 0 |
| Phase 3C catalog browser | 4 | 0 |
| Work-order browser | 5 | 0 |
| Registration/directory browser | 9 | 0 |
| Signup-disabled browser | 3 | 0 |
| Existing local application/recovery browser | 45 | 0 |
| Storage audit browser | 3 | 0 |
| **Distinct total, repeated runs counted once** | **310** | **0** |

TypeScript, backend syntax checks and production build passed. The existing >500 KB bundle warning remains. Root and Functions dependency audits each reported zero vulnerabilities; no dependencies were added.

Seven new tests cover actual server-derived counts and selected queues; work-order detail links; every supported Owner navigation entry; collapsed labels and keyboard activation; loading/failed/empty states and retry; Technician financial visibility and mobile focus containment; company switching/refresh isolation; Owner desktop/tablet/phone layouts and drawer. Screenshots were inspected, not merely generated.

Intermediate findings were resolved before final validation: older mobile tests clicked hidden navigation; a switch test opened the old company's drawer before the new company remounted; a backdrop test clicked underneath the drawer rather than its exposed area; layout assertions needed to wait for responsive transitions. A Firestore-stream abort test encountered SDK reconnect backoff, so failure/retry coverage uses the existing emulator-availability probe instead of resetting SDK or backend services. The initial overview used the broader work-order/employee loader; it now uses a read-only work-order helper with no employee transaction. Synthetic membership revocation waits for the initial server read and includes REST diagnostics; no role, rule or last-Owner protection was weakened.

Local evidence: `tmp/phase3j-ui-reviewed.log`, `phase3j-dispatch.log`, `phase3j-dispatch-browser-final.log`, individual backend `phase3j-*` logs, final browser regression logs, `phase3j-auth-final.log`, `phase3j-signup-final.log`, `phase3j-build.log`, `phase3j-typescript.log`, `phase3j-root-audit.json`, `phase3j-functions-audit.json` and `phase3j-checkpoint.log`. These are local artifacts rather than source deliverables. Existing tracked preview PNGs are restored to pre-task bytes after tests.

## Visual review and safeguards

Screenshots in `tmp/`:
- `phase3j-dashboard-desktop.png`
- `phase3j-dashboard-owner-tablet.png`
- `phase3j-dashboard-owner-phone.png`
- `phase3j-sidebar-phone.png`

The emulator's credential warning remains visible in screenshots. No real company data or credentials are shown. See `phase3j-ui-audit.md` for all pages and recommended next screens, and `firebase-phase-3j-part1.md` for exact changed files and data-source limitations.

Read-only checkpoint verification:

```powershell
node scripts/emulator-data.mjs inspect --from firebase-export-1791850651525C6Q8mE
```

Unchanged: six files, 20 Auth users, SHA-256 `8f36515546b333cc8b022bc0afb95896d83fefeca1a03ea154ceab50ce47ccf5`, metadata modified `2026-10-13T00:17:31.593Z`. Original company data remains unverified. No import, migration, reset, production connection, push or deployment occurred. No financial/GPS/API/backend authorization logic changed. Stop for visual review; do not begin Part 2 automatically.

Final browser logs: `phase3j-integrations-browser-final2.log` (3), `phase3j-accounting-browser-final3.log` (3), `phase3j-employees-browser-final3.log` (7), `phase3j-finance-browser-final4.log` (6), and `phase3j-compat-final4.log` (26 backend + 4 browser). Earlier failed/interrupted logs are retained for diagnosis; the table reports final passing runs, not every attempt.

Final pricing rerun: `tmp/phase3j-pricing-verified.log`, all 4 passed in 16.3 seconds with source/assets left unchanged. An earlier run reloaded to Dashboard while development files were being updated; no pricing implementation or permission change was needed. Final local application/recovery run passed 45 and storage audit passed 3. The seven UI tests were rerun with explicit dialog/background-inert assertions and all passed.
