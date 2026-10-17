# Phase 3E — Isolated local testing

Validated October 15, 2026, on `firebase-preparation`. Do not import the October 12 checkpoint, reset services, migrate business records, push or deploy.

## Environment and preservation

Phase 3E reuses the **complete existing Phase 3C synthetic group**, not an original company:

| Setting | Value |
| --- | --- |
| Project | `demo-orvex-phase3c-tests` |
| Auth | `127.0.0.1:9299` |
| Firestore | `127.0.0.1:8280` |
| Functions | `127.0.0.1:5301` |
| Frontend | `127.0.0.1:5177` |
| Hub / websocket / logging / Eventarc | `4450 / 9350 / 4550 / 9399` |
| Public signup | Disabled outside the temporary isolated auth-regression frontend |

Phase 3D's Firestore listener remained running on 18380 while its Auth/Functions listeners were unavailable during testing. It was left untouched. Do not restart a partial group, stop an unknown process or import a checkpoint to make these tests work. The runtime now explicitly accepts the matching Phase 3C test profile for timekeeping compatibility checks.

Existing browser-local data belongs to its browser and origin. These tests use disposable browser contexts and synthetic identities with random IDs. They neither back up another user's browser nor recover the original company. The original company data remains unverified.

Use the installed dependencies, Firebase CLI and Java. Backend package declares Node 22; this machine ran local checks on Node 24 with an emulator version warning. No new dependency or service/billing setting was added. Generated `functions/shared` modules are built from the shared TypeScript files and stay ignored by Git.

## Separate PowerShell terminals

Terminal 1 — **reuse the matching group if already running**. Only start this if its ports are free:

```powershell
Set-Location 'C:\Users\carlo\Documents\ChatGPT\Orvex 1'
$env:FUNCTIONS_DISCOVERY_TIMEOUT='60'
npm run emulators:finance
```

The alias builds the backend and starts only Auth, Firestore and Functions using `firebase.phase3c-test.json` and the demo project. No import, reset, clear or export-overwrite option is present. Wait for `financialView`, `financialCommand`, `saveWorkOrderPricing`, `timekeepingView` and `timekeepingCommand` to load. Missing services cause explicit failures; there is no production fallback. Synthetic emulator data is ephemeral unless separately exported under a reviewed procedure.

Terminal 2 — isolated signup-disabled frontend (reuse 5177 if matching):

```powershell
Set-Location 'C:\Users\carlo\Documents\ChatGPT\Orvex 1'
$env:VITE_FIREBASE_EMULATOR_PROJECT='demo-orvex-phase3c-tests'
$env:VITE_ENABLE_PUBLIC_SIGNUP='false'
npm run dev -- --host 127.0.0.1 --port 5177 --strictPort --configLoader runner
```

Terminal 3 — new financial tests, earlier phase compatibility and validation:

```powershell
Set-Location 'C:\Users\carlo\Documents\ChatGPT\Orvex 1'
npm run test:finance
npm run test:finance:browser
npm run test:finance:compat
node scripts/run-phase3c-tests.mjs
npx playwright test --config emulator-tests/pricing.config.ts --output tmp/phase3e-pricing-browser
node scripts/prepare-phase3d-regressions.mjs
npx playwright test --config tmp/phase3d-work-order-regression/playwright.config.ts --output tmp/phase3e-workorders
npx tsc -b
npm run build
npm audit
npm audit --prefix functions
```

`test:finance` first performs bounded Auth/Firestore/unauthenticated-function readiness probes; none create records. The shared build preserves unchanged generated modules, avoiding unnecessary Functions reloads. `test:finance:compat` generates temporary copies/configurations of the existing Phase 3D assertions, pointing only to the matching synthetic Phase 3C services. It does not alter service data or import/reset anything. Its fixtures create their own synthetic companies. Actual timekeeping logic stays the same.

The local application/storage suites need the ordinary frontend at 5173, with public signup disabled. They use disposable browser storage, not real company records:

```powershell
npm test -- --output tmp/phase3e-local-results
npx playwright test --config audit/playwright.config.ts --output tmp/phase3e-storage-audit
```

If 5173 is not running, open another terminal, clear only this test-profile variable, and start the local app:

```powershell
Remove-Item Env:VITE_FIREBASE_EMULATOR_PROJECT -ErrorAction SilentlyContinue
$env:VITE_ENABLE_PUBLIC_SIGNUP='false'
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort --configLoader runner
```

This starts the frontend only. Do not run `npm run emulators` or add `--import` as part of Phase 3E; original-company recovery remains a separate task.

## Existing authentication and directory regressions

For these tests only, start a **temporary isolated** frontend in a separate terminal:

```powershell
$env:VITE_FIREBASE_EMULATOR_PROJECT='demo-orvex-phase3c-tests'
$env:VITE_ENABLE_PUBLIC_SIGNUP='true'
npm run dev -- --host 127.0.0.1 --port 5178 --strictPort --configLoader runner
```

Run the enabled assertions, then **always run disabled setup/assertions afterward even if an earlier test fails**:

```powershell
node scripts/prepare-isolated-regressions.mjs enabled phase3c
npx playwright test --config tmp/isolated-regressions-enabled-phase3c/playwright.config.ts --output tmp/phase3e-auth-directory
node scripts/prepare-isolated-regressions.mjs disabled phase3c
npx playwright test --config tmp/isolated-regressions-disabled-phase3c/playwright.config.ts --output tmp/phase3e-signup-disabled
```

The generated Playwright global setup changes only the synthetic project's signup gate. The normal frontend remains signup-disabled. Stop only the temporary 5178 frontend with Ctrl+C when finished; do not reset Firebase to close signup. Company discovery now uses the signed-in user's verified company link, avoiding an all-company REST page limit after many accumulated test fixtures.

## Optional explicit manual demo

The following opt-in command creates a **new synthetic test company**, with test customer/property/work order/catalog fixtures, only on the ports above. It is not ORVEX Demo Services or a recovery/import of existing data. It is never called by application startup and is not needed for automated tests:

```powershell
node scripts/create-isolated-financial-fixture.mjs --create-synthetic-phase3e-demo
```

It prints only the new synthetic Owner login/UID, not existing credentials, tokens or private keys. Open `http://127.0.0.1:5177/account`, sign in, and select Estimates, Change Orders or Invoices.

Suggested walkthrough: create/issue an estimate, mark it accepted with a reason, confirm conversion once, then draft/issue/approve a change order for the converted job. Create an invoice from its current billable scope, issue it, and record two external/manual payments. Check the issued-version preview/history and PDF. For a manual invoice, choose an existing customer/property without a work order. No payment is processed, sent or collected by ORVEX.

## Exact final results

| Suite | Passed | Failed |
| --- | ---: | ---: |
| New financial calculations/model | 5 | 0 |
| New financial backend, workflows and security | 22 | 0 |
| New financial browser/mobile/PDF workflows | 6 | 0 |
| Existing local app/documents/recovery | 45 | 0 |
| Existing storage audit | 3 | 0 |
| Existing authentication/directory | 9 | 0 |
| Existing signup-disabled | 3 | 0 |
| Existing work-order browser | 5 | 0 |
| Existing rules, backup, money and pricing backend | 40 | 0 |
| Existing Phase 3C pricing browser | 4 | 0 |
| Existing Phase 3D model/backend | 26 | 0 |
| Existing Phase 3D browser/mobile | 4 | 0 |
| **Distinct total** | **172** | **0** |

The focused internal-labor/invoice integration rerun is the same test and is not counted twice. It clocks synthetic labor, verifies nonzero internal cost, issues an invoice from explicit charges, and verifies that invoice totals and original time history remain separate.

TypeScript (`npx tsc -b`), backend JS syntax checks, and production build passed. Both root and functions npm audits report **zero vulnerabilities**. The build retains a non-blocking large account chunk warning; Node 22/24 alignment and code splitting remain production preparation work.

The issued estimate and every page of the five-page, 50-charge invoice were rendered and visually inspected with Poppler. Independent `pypdf` extraction confirmed first/last items, one totals block and no private notes. Preview artifacts live under ignored `tmp/pdfs`, not the checkpoint. Poppler emitted missing optional display-font warnings; these Latin-text fixtures rendered legibly. Broader Unicode font coverage remains a documented limitation.

Initial attempts exposed a TS import-extension issue, field-label selectors, an ambiguous heading assertion, a concurrency assertion inspecting a successful result as an error, generated HTML triggering unrelated Vite reloads, a midnight-dependent overtime fixture, and capped all-company discovery in legacy auth tests. Those were corrected and rerun. One signup-disabled worker process exited unexpectedly; the serial final rerun passed all three assertions. A later first-request timeout during a watched Functions reload led to readiness probes and preserving unchanged generated output; the financial suite was rerun afterward. No production fallback or service reset was used to resolve these failures.

The checkpoint was rechecked read-only:

```powershell
node scripts/emulator-data.mjs inspect --from firebase-export-1791850651525C6Q8mE
```

Fingerprint remains `8f36515546b333cc8b022bc0afb95896d83fefeca1a03ea154ceab50ce47ccf5`. No migration, import, deployment, push, payment gateway or live accounting integration occurred. See `firebase-phase-3e.md` for changed files, authorization, financial/tax assumptions and production blockers.
