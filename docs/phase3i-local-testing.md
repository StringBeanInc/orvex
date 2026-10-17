# Phase 3I — Isolated local testing

## Preserve and reuse services

Work on `firebase-preparation`. Preserve existing uncommitted changes. Original company data is unverified; never import the October 12 checkpoint to run these tests. Tests create uniquely named synthetic fixtures, not replacement original companies.

```powershell
Set-Location 'C:\Users\carlo\Documents\ChatGPT\Orvex 1'
git branch --show-current
git status --short
Get-NetTCPConnection -State Listen | Where-Object LocalPort -In 9299,8280,5301,5177
node scripts/wait-financial-emulators.mjs
```

Reuse healthy services. Only if the isolated service group is absent, start this in its own terminal:

```powershell
npm run emulators:finance
```

This uses `demo-orvex-phase3c-tests`, Auth 9299, Firestore 8280 and Functions 5301. It does not import or reset data. Source reload can briefly make Functions unavailable: wait for readiness, never fall back to production. Do not stop another running service. Before a deliberate restart of a data-bearing original service, follow `emulator-safe-restart.md`: export to a new nonexisting directory and verify before stopping. Do not overwrite a backup.

Start a frontend only if 5177 is free:

```powershell
$env:VITE_FIREBASE_EMULATOR_PROJECT='demo-orvex-phase3c-tests'
$env:VITE_ENABLE_PUBLIC_SIGNUP='false'
npm run dev -- --port 5177 --strictPort --configLoader runner
```

The ordinary local workspace on 5173 is separate. Never import its browser-local records into synthetic accounts. Emulators remain mandatory; missing services must produce errors.

## Automated commands

Run browser suites sequentially. Avoid modifying watched source or restoring test-generated images during browser runs, because Vite can reload a page mid-test.

```powershell
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
npx playwright test --config emulator-tests/pricing.config.ts --output tmp/phase3i-pricing-browser
node scripts/prepare-phase3d-regressions.mjs
npx playwright test --config tmp/phase3d-work-order-regression/playwright.config.ts --output tmp/phase3i-workorders-verified
npm test -- --output tmp/phase3i-local-results
npx playwright test --config audit/playwright.config.ts --output tmp/phase3i-audit-results
npx tsc -b
npm run build
npm audit
npm audit --prefix functions
```

Local application/recovery and storage-audit tests require the ordinary frontend on 5173. Compatibility helpers adapt synthetic tests to the existing isolated project without resetting it. Test fixtures persist in the isolated emulator; they do not mutate the original company.

Registration/directory regressions use a temporary frontend on 5178 with the same synthetic project and `VITE_ENABLE_PUBLIC_SIGNUP='true'`. Follow `phase3f-local-testing.md` for setup. Close the synthetic server gate even if a test fails:

```powershell
node scripts/prepare-isolated-regressions.mjs enabled phase3c
try {
  npx playwright test --config tmp/isolated-regressions-enabled-phase3c/playwright.config.ts --output tmp/phase3i-auth-directory
} finally {
  node scripts/prepare-isolated-regressions.mjs disabled phase3c
}
npx playwright test --config tmp/isolated-regressions-disabled-phase3c/playwright.config.ts --output tmp/phase3i-signup-disabled
```

Stop only the temporary 5178 frontend you started. This phase's completed run closed the synthetic gate and stopped that frontend. Normal public signup remains disabled; no production settings changed.

## Manual workflow

1. Use a synthetic verified Owner and an active employee with `time.self`. Owner may explicitly grant dispatch read/manage/override permissions through Employees. Legacy Admin receives no automatic new grant.
2. Create a synthetic customer, property and work order through existing modules. Configure a known property site through authorized Timekeeping if map/geofence testing is needed; never guess coordinates.
3. Open Dispatch. Record the technician's shift, select a date, assign the work order and set local start/duration. Review timezone and any DST ambiguity. A missing/outside shift requires explicit override permission and audited reason. Job overlap and unavailable periods cannot be overridden.
4. Confirm the save, refresh and inspect Schedule. Try a stale change or conflicting booking: the failed form must retain its input. Move/reassign timed jobs through Dispatch; the old editor/API cannot bypass its guard.
5. Select Map and inspect property details or missing-location warnings. Routes offers manual reorder and a clearly labeled straight-line suggestion. Save explicitly; appointment windows and assignments must remain unchanged.
6. In a separate Technician context, inspect only that technician's schedule. Use existing Timekeeping to test denied GPS then an approved synthetic fix. Scheduling itself must never clock anyone in/out. Team clock visibility requires separate review permission.
7. Clock out and complete the job through existing authorized operations. Use separately authorized pricing/invoicing controls to create its invoice. Dispatch must not expose compensation, internal labor cost or financial records.

The automated end-to-end browser test covers all these integration steps: trusted synthetic company/Owner/Technician fixture; UI customer/property/work-order creation; booking; self-only visibility; denied and approved GPS clock-in; clock-out/completion; $100 billable scope and issued invoice; Technician invoice denial; preserved dispatch audit and historical labor-rate snapshot. Registration is covered separately, not reopened by this workflow.

## Validation results — October 16, 2026

| Suite | Passed | Failed |
|---|---:|---:|
| Phase 3I model/backend/rules | 36 | 0 |
| Phase 3I browser, including full synthetic workflow | 5 | 0 |
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
| **Distinct total (reruns counted once)** | **303** | **0** |

TypeScript, backend syntax checks and production build passed. Existing chunk-size warnings remain (>500 KB). Root and Functions dependency audits each reported zero vulnerabilities. No dependency was added.

Intermediate failures were fixed before final reruns: explicit accessible form labels; pending-company navigation race; waiting for route-save acknowledgement; full-record legacy editor inputs projected to supported draft fields; equivalent Firestore validation caching to avoid expression limits; and waiting for the confirmed local default-template save before refreshing. Source reloads during earlier browser runs also interrupted tests; final runs left watched assets unchanged. No authorization rule was weakened to make tests pass.

Evidence is in local `tmp/phase3i-*` logs, especially `backend-verified`, `browser-verified`, `workorders-verified`, `pricing-final`, `local-final`, `employees-final`, `finance-final`, `compat-final`, `build-final`, `typescript`, `auth-directory`, `signup-disabled`, `root-audit.json` and `functions-audit.json`. These are local artifacts, not durable source reports. Existing tracked preview screenshots were restored to their pre-task bytes after tests.

## Checkpoint and production blockers

Read-only verification:

```powershell
node scripts/emulator-data.mjs inspect --from firebase-export-1791850651525C6Q8mE
```

Before/after: six files, 20 Auth users, manifest SHA-256 `8f36515546b333cc8b022bc0afb95896d83fefeca1a03ea154ceab50ce47ccf5`, metadata modified `2026-10-13T00:17:31.593Z`. The checkpoint was untouched. Original company availability remains unverified. No data was imported, migrated or reset; no push/deployment occurred.

See `firebase-phase-3i.md` for the exact changed-file report and security/data model. Production remains blocked on security review, indexed bounded date queries and pagination beyond the current 500-record datasets, contention/load testing of company serialization, monitoring, recovery/retention and timezone/privacy review. There is no street map, live geocoding, real driving/traffic estimate, recurring shifts, automatic dispatch or continuous GPS. Any future mapping provider requires approval, protected keys, privacy/licensing/billing review and truthful route estimates. Phase 3J was not started.
