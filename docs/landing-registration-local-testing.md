# Landing and registration — local preview and validation

## Preview

Working branch: `firebase-preparation`. Do not deploy, import, migrate, reset services, or use original company records. Preserve all existing uncommitted work and the October 12 checkpoint.

The working isolated preview is **http://127.0.0.1:5180/**. Public landing is `/`, registration is `/account?mode=register`, Sign In is `/account?mode=login`, company workspace is `/account`, and the preserved browser-local workspace/recovery interface is `/local`.

The existing frontend at 5173 also renders the restored landing code. Its Firebase project configuration remains unchanged; do not assume its original accounts or signup gate match the disposable preview. The 5180 preview explicitly uses `demo-orvex-phase3c-tests`; original/default-project records were not inspected or modified.

## Start safely

Inspect existing listeners; reuse healthy processes. Do not kill a process just because a port is occupied.

```powershell
Set-Location 'C:\Users\carlo\Documents\ChatGPT\Orvex 1'
git branch --show-current
git status --short
netstat -ano -p tcp | Select-String ':9299|:8280|:5301|:5180'
node scripts/wait-financial-emulators.mjs
```

The isolated project uses Auth 9299, Firestore 8280 and Functions 5301. If the entire isolated group is absent, start a dedicated terminal using an empty local CLI configuration:

```powershell
$env:XDG_CONFIG_HOME=Join-Path (Get-Location) 'tmp/firebase-cli-local'
$env:FIREBASE_CLI_DISABLE_UPDATE_CHECK='true'
npm run emulators:finance
```

During this task, Firestore was already running but Auth and Functions were absent. Only those missing services were started; Firestore was not stopped/reset. For that same condition only:

```powershell
$env:XDG_CONFIG_HOME=Join-Path (Get-Location) 'tmp/firebase-cli-local'
$env:FIREBASE_CLI_DISABLE_UPDATE_CHECK='true'
$env:FIRESTORE_EMULATOR_HOST='127.0.0.1:8280'
$env:FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9299'
firebase emulators:start --only auth,functions --project demo-orvex-phase3c-tests --config firebase.phase3c-test.json
```

After services are ready, a split-service startup may need the existing synthetic Firestore trigger reconnected:

```powershell
node scripts/reconnect-isolated-firestore.mjs --connect
```

This uses the installed Firebase CLI's local trigger protocol for one fixed loopback/project/trigger. It does not import records, change application permissions or deploy anything. Do not run these startup commands when the same services are already listening. If only one service is absent, start only that service. Original/default emulator projects and their gates must remain untouched.

Explicitly enable the disposable project's company-bootstrap gate and start a frontend only if 5180 is free:

```powershell
node scripts/local-registration-gate.mjs enable
$env:VITE_FIREBASE_EMULATOR_PROJECT='demo-orvex-phase3c-tests'
$env:VITE_ENABLE_PUBLIC_SIGNUP='true'
npm run dev -- --port 5180 --strictPort --configLoader runner
```

Use `node scripts/local-registration-gate.mjs disable` to close only this synthetic gate. An explicit UI `VITE_ENABLE_PUBLIC_SIGNUP=false` also disables signup; the server gate remains independently enforced. Production access stays disabled regardless of either flag. Never use production credentials in an emulator.

## Manual onboarding

1. Visit the landing and select Create Company Account.
2. Enter synthetic company/Owner names, optional phone, timezone, business email, password and confirmation. Password must have at least 12 characters in this UI.
3. Verify the email through the Auth emulator. No real email is sent. For your own synthetic address, inspect its emulator verification link:

```powershell
$codes=Invoke-RestMethod 'http://127.0.0.1:9299/emulator/v1/projects/demo-orvex-phase3c-tests/oobCodes'
$codes.oobCodes | Where-Object { $_.email -eq 'your-synthetic-address@business.example' -and $_.requestType -eq 'VERIFY_EMAIL' } | Select-Object -Last 1 | Select-Object email,oobLink
```

4. Open that local verification link, return to ORVEX and select Verify and create company. If the page was reloaded, sign in and re-enter the company details; no password draft is stored.
5. Open Employees, invite a Technician or Administrator with an explicit role/reason, and copy the single-use invitation link. Invitation delivery is manual; the screen states that no email was sent.
6. In a separate browser profile, open the invitation, create the intended invited account, verify its email, enter its name and accept. Thereafter use the normal Sign In page.
7. As Owner, create a customer/property and a work order assigned to that employee. As Technician, open Assigned Jobs. Company-wide records/financial modules remain unavailable without separate permission.
8. Returning to `/` must keep the welcome visible and offer Open Workspace for the authenticated session. Company switching remains in the company sidebar.

Company data lives in Firestore. `/local` still uses the existing origin's browser-local keys and recovery protections; it never auto-imports those records into a company. Do not clear browser site storage to troubleshoot an account.

## Automated validation

New coverage:

```powershell
node --test emulator-tests/onboarding.test.mjs
npx playwright test --config emulator-tests/landing.config.ts --output tmp/landing-browser-results
```

Existing regression commands:

```powershell
node scripts/run-phase3c-tests.mjs
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
npx playwright test --config emulator-tests/pricing.config.ts --output tmp/landing-pricing-browser
node scripts/prepare-phase3d-regressions.mjs
npx playwright test --config tmp/phase3d-work-order-regression/playwright.config.ts --output tmp/landing-workorders
npx playwright test --config emulator-tests/workspace-ui.config.ts --output tmp/landing-workspace-ui
npm test -- --output tmp/landing-local-results
npx playwright test --config audit/playwright.config.ts --output tmp/landing-storage-audit
npx tsc -b
npm run build
npm audit
npm audit --prefix functions
```

Existing local application and audit tests now visit `/local`, preserving their business/recovery assertions. They use frontend 5173. Company regression suites use the existing 5177 frontend with its explicit signup-disabled UI flag; do not change that process's configuration simply to run registration tests.

Registration/directory regressions use the enabled 5180 frontend. Prepare the existing isolated config, replace only its generated 5178 URL with 5180, then run. Finally close the synthetic gate for the disabled tests on 5177 and reopen it for this requested registration preview:

```powershell
node scripts/prepare-isolated-regressions.mjs enabled phase3c
$configPath='tmp/isolated-regressions-enabled-phase3c/playwright.config.ts'
(Get-Content -Raw $configPath).Replace('5178','5180') | Set-Content $configPath
try {
  npx playwright test --config tmp/isolated-regressions-enabled-phase3c/playwright.config.ts --output tmp/landing-auth-results
} finally {
  node scripts/prepare-isolated-regressions.mjs disabled phase3c
}
try {
  npx playwright test --config tmp/isolated-regressions-disabled-phase3c/playwright.config.ts --output tmp/landing-signup-disabled
} finally {
  node scripts/local-registration-gate.mjs enable
}
```

Run browser suites sequentially and leave watched files unchanged during final runs. Restoring test-generated tracked PNGs while a company test runs can reload its page. Restore only test preview images that were clean before the work, and do so before final browser reruns.

## Results

| Suite | Passed | Failed |
|---|---:|---:|
| New onboarding validation/rules/timezone tests | 7 | 0 |
| New landing/registration/invitation/assignment/isolation browser tests | 3 | 0 |
| Phase 3J dashboard/sidebar browser | 7 | 0 |
| Phase 3I model/backend/rules | 36 | 0 |
| Phase 3I browser/full workflow | 5 | 0 |
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
| Browser-local application/recovery | 45 | 0 |
| Storage audit | 3 | 0 |
| **Distinct total; reruns counted once** | **320** | **0** |

TypeScript, backend syntax checks and production build passed. The existing >500 KB bundle warning remains. Root and Functions dependency audits each reported zero vulnerabilities; no dependency was added.

Initial integration attempts failed because the test Auth/Functions services were absent. These are retained as failed/interrupted diagnostic logs, not counted as final passing runs. Only the missing services were started, and the existing synthetic trigger was reconnected without resetting Firestore. One accounting browser run returned to Dashboard during a development reload; the final unchanged-file rerun is the reported result. No application financial/security behavior was weakened to accommodate tests.

Evidence is in `tmp/landing-*` logs, especially `onboarding-verified`, `browser-verified`, `rules-verified`, backend `*-final`, individual browser suite logs, `auth`, `signup-disabled`, `typescript-final`, `build-final`, `root-audit.json` and `functions-audit.json`. Images: `tmp/landing-desktop.png`, `tmp/landing-phone.png`, `tmp/registration-clean.png`. These use synthetic data only and were visually inspected.

## Remaining onboarding limits and safeguards

This is local-only onboarding, not a deployed public SaaS signup. Production Firebase configuration/rules deployment, email delivery/templates, anti-abuse/rate-limit controls, server-enforced Auth password policy and a production operational review remain unfinished. Invitation links are manually delivered. The signup gate prevents company bootstrap but does not by itself block Firebase's raw Auth identity signup endpoint. The timezone list is finite; company-profile editing and persisted cross-refresh onboarding drafts are not added. Existing explicit time policies and all legacy defaults remain intact.

Before stopping any data-bearing emulator, follow `emulator-safe-restart.md` and validate a new, complete export without overwriting a prior backup. Do not treat the October 12 checkpoint as confirmed current data. This phase does not import or reconstruct original accounts.

Read-only checkpoint inspection:

```powershell
node scripts/emulator-data.mjs inspect --from firebase-export-1791850651525C6Q8mE
```

Unchanged: six files, 20 archived Auth users, SHA-256 `8f36515546b333cc8b022bc0afb95896d83fefeca1a03ea154ceab50ce47ccf5`. Original company data remains unverified and was not accessed or changed. No production deployment, push, import, migration or reset occurred. See `landing-registration.md` for architecture and exact changed files. Stop for visual review.

Final evidence: `tmp/landing-browser-complete.log` (3 passed), `landing-disabled-complete.log` (3 passed, including hidden public signup link), `landing-accounting-browser-complete.log` (3 passed with files unchanged), `landing-typescript-complete.log` (successful, empty diagnostics), `landing-build-complete.log` (successful), and `landing-checkpoint-final.log` (unchanged manifest). Final distinct total: 320 passed, 0 failed. The synthetic signup gate remains enabled for the requested 5180 review preview.
