# Phase 3F — isolated local testing and results

Validated October 15, 2026 on `firebase-preparation`. No production deployment, import, migration or emulator reset was performed. Original company data remains unverified.

## Exact results

**203 distinct tests passed; zero final failures.** Repeated verification runs are not counted twice.

| Suite | Passed | Final log under ignored `tmp/` |
| --- | ---: | --- |
| New employee policy/backend/Firestore authorization | 24 | `phase3f-employees-verified.log` |
| New employee/invitation/company-switch/mobile browser workflows | 7 | `phase3f-browser-final-verified.log` |
| Existing Phase 3E model/financial backend | 27 | `phase3f-finance-final.log` |
| Existing Phase 3E financial browser/PDF | 6 | `phase3f-finance-browser-verified.log` |
| Existing Phase 3C rules/security/backup/money/pricing backend | 40 | `phase3f-phase3c-final.log` |
| Existing Phase 3C catalog/pricing browser | 4 | `phase3f-pricing-browser.log` |
| Existing Phase 3D time models/backend on isolated Phase 3C services | 26 | `phase3f-time-final.log` |
| Existing Phase 3D time browser, including open-tab revocation | 4 | `phase3f-time-browser-verified.log` |
| Existing Phase 3B work-order browser/concurrency | 5 | `phase3f-workorders-complete.log` |
| Existing authentication/directory browser | 9 | `phase3f-auth-directory-final.log` |
| Existing public-signup-disabled browser | 3 | `phase3f-signup-disabled.log` |
| Existing local application/document/recovery browser | 45 | `phase3f-local.log` |
| Existing local storage audit browser | 3 | `phase3f-audit.log` |

`npx tsc -b` passed. `npm run build` passed (`phase3f-build-final.log`); only the existing nonblocking Vite large-chunk warning remains. Dependency audits report **0 root vulnerabilities and 0 Functions vulnerabilities** (`phase3f-root-audit.json`, `phase3f-functions-audit.json`). No dependencies or lockfiles changed.

Expected permission-denied messages appear in negative tests. They are not failed tests. Earlier browser runs found compatibility/locator failures; those were fixed and affected suites rerun, including legacy role restoration and mobile labels. No failing final run is represented as a pass.

## Environment and safety

Tests reuse the complete existing synthetic Phase 3C group:

| Service | Value |
| --- | --- |
| Project | `demo-orvex-phase3c-tests` |
| Auth / Firestore / Functions | `127.0.0.1:9299` / `127.0.0.1:8280` / `127.0.0.1:5301` |
| Frontend | `http://127.0.0.1:5177/account` |
| Hub / websocket / logging / Eventarc | `4450 / 9350 / 4550 / 9399` |

Do not stop an unknown service to free ports or restart a partial group. Do not point these tests at normal/original-company emulators. Every fixture creates its own random synthetic company/identities; no original company is reconstructed. These fixtures are test data, not a migration or recovery source.

The existing frontend at 5173 supports the separate browser-local tests; disposable test browser storage is used. The actual user's browser-local data is not exported or modified by these tests. No claim is made that another user's localStorage was backed up.

Backend declares Node 22; this host ran the tests using Node 24, as in previous phases. Validate the declared runtime in staging before any production release. Firebase CLI, Java and installed frontend/Functions dependencies are prerequisites. No production credentials, private keys or billing setup are needed.

## PowerShell: separate terminals

Only if the exact synthetic group is not already running and its ports are free:

```powershell
Set-Location 'C:\Users\carlo\Documents\ChatGPT\Orvex 1'
$env:FUNCTIONS_DISCOVERY_TIMEOUT='60'
npm run emulators:finance
```

This existing alias builds shared models and starts Auth, Firestore and Functions using the isolated Phase 3C configuration. It contains no import or reset. Reuse the group if it already exists. Do not use the original-company `npm run emulators` recovery wrapper for this phase.

In another terminal, start the matching frontend only if 5177 is free:

```powershell
Set-Location 'C:\Users\carlo\Documents\ChatGPT\Orvex 1'
$env:VITE_FIREBASE_EMULATOR_PROJECT='demo-orvex-phase3c-tests'
$env:VITE_ENABLE_PUBLIC_SIGNUP='false'
npm run dev -- --host 127.0.0.1 --port 5177 --strictPort --configLoader runner
```

Wait for the emulator callables, including `employeeView`, `employeeCommand`, `employeeInvitationInfo`, `companyMemberships`, `employeeAssignments`, `technicianJobs`, `technicianJobUpdate`, `workOrderServiceReports` and `financialWorkOrderScope`. Missing services fail explicitly; no production fallback is permitted.

From a test terminal:

```powershell
Set-Location 'C:\Users\carlo\Documents\ChatGPT\Orvex 1'
npm run test:employees
npm run test:employees:browser
npm run test:finance
npm run test:finance:browser
npm run test:finance:compat
node scripts/run-phase3c-tests.mjs
npx playwright test --config emulator-tests/pricing.config.ts --output tmp/phase3f-pricing-results
node scripts/prepare-phase3d-regressions.mjs
npx playwright test --config tmp/phase3d-work-order-regression/playwright.config.ts --output tmp/phase3f-workorder-results
npx tsc -b
npm run build
npm audit
npm audit --prefix functions
```

Prefer running browser suites sequentially. Do not edit watched application files during a final browser run. Shared builds preserve unchanged generated modules to avoid unnecessary Functions reloads. Node integration suites issue synthetic test writes and exercise rules through the dedicated emulator; they do not clear data.

With the ordinary local frontend already on 5173:

```powershell
npm test -- --output tmp/phase3f-local-results
npx playwright test --config audit/playwright.config.ts --output tmp/phase3f-storage-audit-results
```

See `phase3e-local-testing.md` for the temporary signup-enabled **isolated** frontend on 5178 used only by the existing registration/directory tests. These tests temporarily change the synthetic server signup gate. Always finish by closing it:

```powershell
node scripts/prepare-isolated-regressions.mjs enabled phase3c
npx playwright test --config tmp/isolated-regressions-enabled-phase3c/playwright.config.ts --output tmp/phase3f-auth-directory-results
node scripts/prepare-isolated-regressions.mjs disabled phase3c
npx playwright test --config tmp/isolated-regressions-disabled-phase3c/playwright.config.ts --output tmp/phase3f-signup-disabled-results
```

Then stop only the temporary 5178 frontend you started. The completed run closed the synthetic signup gate and stopped that frontend. Normal public signup was not enabled.

## Covered authorization boundaries

- Exact verified invite identity, expiry/revocation, revoked issuer, duplicate invitation reservation, concurrent single-use activation, and caller-bound idempotency/conflicts.
- Protected roles, Owner-only grants, self-escalation denial, legacy Admin time-only compatibility, and independent financial edit/issue/payment/cost permissions.
- Multiple companies without changing the global default link; forged contexts/employee references; company switching and refresh; no previous-company editor retained.
- Last Owner and concurrent removal, stale membership edits, active-clock deactivation blocking, historical work preservation, suspension/reactivation and live open-tab withdrawal/recovery.
- Unauthorized direct membership/invitation/discovery/guard writes, immutable audit update/delete denial, and active staff reads revoked by Firestore rules on suspension.
- Separate raw-cost catalog authorization, compensation redaction from employee/assignment responses, sanitized financial work-order pricing, assigned-only technician job updates and service reports.
- Emulator-only runtime guards, frontend navigation/control restrictions and mobile administration, alongside all previous phase regressions.

## Checkpoint verification and remaining limits

Read-only verification:

```powershell
node scripts/emulator-data.mjs inspect --from firebase-export-1791850651525C6Q8mE
```

The checkpoint still has six files / 20 Auth users and manifest SHA-256 `8f36515546b333cc8b022bc0afb95896d83fefeca1a03ea154ceab50ce47ccf5`. It was not imported or modified. This does not verify current original-company data.

For manual validation, sign into an existing **synthetic** Owner fixture in the isolated project, select Employees, invite an exact email, and copy the single-use activation link. Use the Auth emulator's verification facility. Do not create replacements for the original company. There is no automatic fixture creation on application startup and no production email delivery.

See `firebase-phase-3f.md` for the 31-file change report, permission matrix, storage details, lost-link/reissue behavior, 500-record endpoint limits, active-session deactivation restriction and production blockers. Production, original-data recovery/migration, payroll, compensation editing and profitability reporting remain outside this phase.
