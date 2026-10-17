# Phase 3H — Isolated local testing

## Preserve before starting

Work on `firebase-preparation`. Phase 3G and earlier changes were uncommitted when this phase began; review a local Git checkpoint before a future merge. Do not discard, overwrite or automatically commit earlier work. Never import the October 12 recovery checkpoint just to run tests. It is not verified current data.

Reuse healthy existing synthetic services. Inspect listeners without killing them:

```powershell
Set-Location 'C:\Users\carlo\Documents\ChatGPT\Orvex 1'
git branch --show-current
git status --short
Get-NetTCPConnection -State Listen | Where-Object LocalPort -In 9299,8280,5301,5177
node scripts/wait-financial-emulators.mjs
```

Only if the isolated service group is absent, start in a dedicated terminal:

```powershell
npm run emulators:finance
```

This uses `demo-orvex-phase3c-tests`, Auth 9299, Firestore 8280 and Functions 5301. It does not import/reset data. The existing Firestore emulator publishes the new background trigger; no data-bearing service needs to be restarted to load source changes. For manual restarts of any original service, follow `docs/emulator-safe-restart.md`: export to a new nonexisting backup directory and validate before stopping, never overwrite a prior backup.

Start the isolated frontend only if 5177 is free:

```powershell
$env:VITE_FIREBASE_EMULATOR_PROJECT='demo-orvex-phase3c-tests'
$env:VITE_ENABLE_PUBLIC_SIGNUP='false'
npm run dev -- --port 5177 --strictPort --configLoader runner
```

Wait for `integrationView`, `integrationCommand`, `integrationApi` and `integrationWorkOrderEvents` to load. Do not fall back to a production project or start replacement original users/companies. The normal localhost 5173 browser workspace remains separate.

## Test commands

Run browser suites sequentially and avoid editing watched application source during final runs. Fixtures use newly generated synthetic company/user identifiers. They do not clear emulator databases, import backups or use original-company credentials.

```powershell
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
npx playwright test --config emulator-tests/pricing.config.ts --output tmp/phase3h-pricing-browser
node scripts/prepare-phase3d-regressions.mjs
npx playwright test --config tmp/phase3d-work-order-regression/playwright.config.ts --output tmp/phase3h-workorders
npm test -- --output tmp/phase3h-local-results
npx playwright test --config audit/playwright.config.ts --output tmp/phase3h-audit-results
npx tsc -b
npm run build
npm audit
npm audit --prefix functions
```

The existing local application and storage audit tests need the ordinary frontend on 5173. Timekeeping compatibility helpers adapt tests to the existing isolated service group, not to original company data.

Registration/directory regressions need a temporary frontend on 5178 with `VITE_FIREBASE_EMULATOR_PROJECT='demo-orvex-phase3c-tests'` and `VITE_ENABLE_PUBLIC_SIGNUP='true'`. Follow `phase3f-local-testing.md`, then close the synthetic server gate:

```powershell
node scripts/prepare-isolated-regressions.mjs enabled phase3c
npx playwright test --config tmp/isolated-regressions-enabled-phase3c/playwright.config.ts --output tmp/phase3h-auth-directory
node scripts/prepare-isolated-regressions.mjs disabled phase3c
npx playwright test --config tmp/isolated-regressions-disabled-phase3c/playwright.config.ts --output tmp/phase3h-signup-disabled
```

Stop only the temporary 5178 frontend you started. The completed run closes the gate and stops that frontend. These commands do not enable normal public registration or change production settings.

## Manual flow

1. Sign into a synthetic Owner account on the isolated frontend and open API & Webhooks.
2. Create a credential with an explicit minimum scope and expiration. Copy it once; refresh must not reveal it again. Use it only against the local API URL documented in `firebase-phase-3h.md`.
3. Test a permitted GET and a denied scope. For PATCH, use a current revision, an explicit update/assignment scope and a unique `Idempotency-Key`; identical retry returns the same receipt.
4. Rotate the credential and verify the previous value is rejected. Revoke the replacement and wait for the UI's server-confirmed result before checking access denial.
5. Create a `mock://receiver` subscription with selected work-order events. Copy its synthetic signing secret. Update a synthetic work order through the existing module or API; refresh the integration screen to see its delivery.
6. Run the mock delivery, disable/enable the subscription and rotate the signing secret. Nothing is sent externally. Retry buttons require refresh after their deadline. Terminal failures remain visible after four attempts; no automatic replay occurs.

The backend tests include mock success/rate-limit/rejection/timeout paths, duplicate durable receipts and signature replay checks. The invalid-auth throttle test invokes the actual HTTP function wrapper with a synthetic socket identity and an isolated Firestore quota bucket. It deliberately avoids relying on original client IP preservation through the emulator proxy or saturating another browser's quota. Do not interpret this as production edge/load validation.

## Safety and limits

The API cannot read financial/accounting, employee-sensitive, payroll or internal-cost data. API and signing secrets are never printed by tests or persisted to browser storage. All created credentials/signing keys are mock-only; production secret management remains unfinished. Root credential routing and all private state are denied to direct client SDKs.

Read-only checkpoint verification:

```powershell
node scripts/emulator-data.mjs inspect --from firebase-export-1791850651525C6Q8mE
```

The preserved checkpoint has six files / 20 Auth users and SHA-256 `8f36515546b333cc8b022bc0afb95896d83fefeca1a03ea154ceab50ce47ccf5`. Original company data remains unverified and was not used for tests. No browser-local data migration, original-company replacement, deployment, push or service reset was performed.

## Validation results

| Suite | Passed | Failed |
|---|---:|---:|
| Phase 3H backend, API, signatures, triggers and rules | 29 | 0 |
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
| **Total** | **262** | **0** |

TypeScript `npx tsc -b` passed. The production build and backend syntax checks passed; the existing bundle-size warning remains (>500 KB chunks). Both root and Functions npm audits reported **zero vulnerabilities**. No dependency was added. Expected permission-denied diagnostics in negative security tests do not represent test failures.

Intermediate failures were resolved: background trigger initialization now ensures a default Admin app even when named apps exist; callable failed-precondition expectations use their actual 400 status; the invalid-auth quota test uses a synthetic socket identity through the actual function wrapper because the emulator proxies socket addresses; and the browser revoke test waits for the confirmed save before checking rejection. Final affected suites were rerun after the last operational API changes.

Local logs: `tmp/phase3h-backend-verified.log`, `tmp/phase3h-browser-final.log`, `tmp/phase3h-build-final.log`, `tmp/phase3h-typescript.log`, the individual `tmp/phase3h-*` regression logs and `tmp/phase3h-root-audit.json` / `tmp/phase3h-functions-audit.json`. These are local test artifacts, not source reports. Generated tracked preview PNGs were restored to their pre-task bytes.

A later browser validation was interrupted by a development page reload back to the dashboard while generated screenshot files were being restored. With source/assets left unchanged, the final rerun passed all three tests in 9.8 seconds (`tmp/phase3h-browser-final.log`). No product authorization control was relaxed to accommodate the test.
