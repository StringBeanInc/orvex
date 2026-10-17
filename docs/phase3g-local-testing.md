# Phase 3G local testing and safe restart

Use only existing synthetic emulator services. Never import the October 12 checkpoint to run these tests; never clear emulator data or replace an original company. Test fixtures create uniquely identified synthetic records in `demo-orvex-phase3c-tests`.

## Starting safely

First inspect existing listeners and reuse healthy matching services. Do not start a second server over occupied ports:

```powershell
Set-Location 'C:\Users\carlo\Documents\ChatGPT\Orvex 1'
Get-NetTCPConnection -State Listen | Where-Object LocalPort -In 9299,8280,5301,5177
node scripts/wait-financial-emulators.mjs
```

Only if the isolated service group is absent, start in one terminal:

```powershell
npm run emulators:finance
```

In a second terminal, only if 5177 is free:

```powershell
$env:VITE_FIREBASE_EMULATOR_PROJECT='demo-orvex-phase3c-tests'
$env:VITE_ENABLE_PUBLIC_SIGNUP='false'
npm run dev -- --port 5177 --strictPort --configLoader runner
```

These commands do not import a backup. Emulator memory is not durable merely because the browser refreshes. For original-service backup/restart use `docs/emulator-safe-restart.md`; create a new timestamped export and validate it before stopping a data-bearing service. Do not assume original company data is available. Local browser data remains tied to its browser and origin.

## Validation commands

Run browser suites sequentially, without editing watched source during a run:

```powershell
npm run test:accounting
npm run test:accounting:browser
npm run test:employees
npm run test:employees:browser
npm run test:finance
npm run test:finance:browser
npm run test:finance:compat
node scripts/run-phase3c-tests.mjs
npx playwright test --config emulator-tests/pricing.config.ts --output tmp/phase3g-pricing-browser
node scripts/prepare-phase3d-regressions.mjs
npx playwright test --config tmp/phase3d-work-order-regression/playwright.config.ts --output tmp/phase3g-workorders
npm test -- --output tmp/phase3g-local-results
npx playwright test --config audit/playwright.config.ts --output tmp/phase3g-audit-results
npx tsc -b
npm run build
npm audit
npm audit --prefix functions
```

The ordinary local frontend must already be running on 5173 for the local application and storage-audit tests. The compatibility helper adapts old timekeeping tests to the existing isolated Phase 3C services without resetting them.

Registration/directory regressions require a temporary **synthetic** frontend on 5178 with the same emulator project and signup flag true. Follow `phase3f-local-testing.md`, then always close the synthetic server gate and stop only that temporary frontend:

```powershell
node scripts/prepare-isolated-regressions.mjs enabled phase3c
npx playwright test --config tmp/isolated-regressions-enabled-phase3c/playwright.config.ts --output tmp/phase3g-auth-directory
node scripts/prepare-isolated-regressions.mjs disabled phase3c
npx playwright test --config tmp/isolated-regressions-disabled-phase3c/playwright.config.ts --output tmp/phase3g-signup-disabled
```

## Accounting checks

Use a synthetic Owner membership. Open Accounting / Integrations; start and confirm mock consent; explicitly save mock mapping configuration. Queue a customer, run its job, then select an issued invoice and run its export. Try the advanced timeout/rate-limit fixtures and explicit customer-conflict review. Simulate partial/final payments and replay the event. Confirm proposals do not alter the invoice balance. Disconnect/reconnect and verify mappings/history persist. A read-only accounting grant must expose no mutation controls or internal costs. No real QuickBooks request, credential, email or webhook is used.

A mock transaction/receipt proves local invariants, not external-provider reliability. See `firebase-phase-3g.md` for required sandbox work and deployment blockers.

## Preserved checkpoint

Read-only inspection confirmed six files / 20 Auth users and manifest SHA-256 `8f36515546b333cc8b022bc0afb95896d83fefeca1a03ea154ceab50ce47ccf5`, unchanged. The checkpoint was not imported or modified. Original current-company data remains unverified.

## Completed validation (October 15, 2026 local time)

| Suite | Passed | Failed |
|---|---:|---:|
| Phase 3G backend/model/rules | 24 | 0 |
| Phase 3G browser | 3 | 0 |
| Phase 3F backend/policy/rules | 24 | 0 |
| Phase 3F browser | 7 | 0 |
| Phase 3E backend/model | 27 | 0 |
| Phase 3E browser | 6 | 0 |
| Phase 3D compatibility backend/model | 26 | 0 |
| Phase 3D compatibility browser | 4 | 0 |
| Phase 3C/security/directory/work-order/backup rules and backend | 40 | 0 |
| Phase 3C catalog browser | 4 | 0 |
| Work-order browser | 5 | 0 |
| Registration/directory browser | 9 | 0 |
| Signup-disabled browser | 3 | 0 |
| Existing local application/recovery browser | 45 | 0 |
| Storage audit browser | 3 | 0 |
| **Total** | **230** | **0** |

TypeScript `npx tsc -b` and production build passed. Both root and Functions dependency audits reported zero vulnerabilities. The build retains the existing >500 KB bundle warning. Expected permission-denied messages in negative security tests are not failed tests.

The first accounting browser attempt had two locator failures; the status-message and mobile-sidebar assumptions were corrected, then all three passed. The added tax-response mismatch, invalid credential and explicit existing-customer link tests passed in the final 24-test backend run. Logs are in `tmp/phase3g-*.log` and the two `tmp/phase3g-*-audit.json` reports; these are local test artifacts.

The temporary signup-enabled 5178 frontend was stopped and the synthetic server signup gate was closed after testing. Existing data-bearing services were not stopped or reset. No real accounting transport or provider credentials were used.
