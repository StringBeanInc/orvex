# Phase 3D — isolated local testing

No command below imports the October 12 checkpoint, resets an emulator, migrates business records, enables production, pushes or deploys. Do not stop an unknown existing service to free a port. The original company's current data is unverified.

## Prerequisites and dedicated ports

Use the existing installed dependencies, Firebase CLI, Java and a supported Node installation. The backend declares Node 22; this machine's local tests use Node 24 and the emulator emits a version warning. No production credentials or private keys are needed.

| Service | Phase 3D synthetic project |
| --- | --- |
| Project ID | `demo-orvex-phase3d-tests` |
| Authentication | `127.0.0.1:19499` |
| Firestore | `127.0.0.1:18380` |
| Functions | `127.0.0.1:15401` |
| Hub / Firestore websocket / logging / Eventarc | `14460 / 19450 / 14560 / 19599` |
| Frontend | `127.0.0.1:15179` |

Port 9499 was already occupied by another emulator sidecar during inspection. It was left untouched; the new profile uses high ports. Firebase CLI may also allocate its local Tasks sidecar. This does not enable production Cloud Tasks.

Terminal 1 — start only the dedicated synthetic environment:

```powershell
Set-Location 'C:\Users\carlo\Documents\ChatGPT\Orvex 1'
$env:FUNCTIONS_DISCOVERY_TIMEOUT='60'
npm run emulators:time
```

Wait for Auth, Firestore, `timekeepingCommand`, `timekeepingView`, and `saveWorkOrderPricing` to report ready. If this exact test group is already running, reuse it. Do not restart or reset existing services. This command contains no import or export-overwrite flags. These synthetic emulator records are ephemeral unless separately exported; they are not the recovered business workspace.

Terminal 2 — isolated frontend:

```powershell
Set-Location 'C:\Users\carlo\Documents\ChatGPT\Orvex 1'
$env:VITE_FIREBASE_EMULATOR_PROJECT='demo-orvex-phase3d-tests'
$env:VITE_ENABLE_PUBLIC_SIGNUP='false'
npm run dev -- --host 127.0.0.1 --port 15179 --strictPort --configLoader runner
```

Terminal 3 — Phase 3D verification:

```powershell
Set-Location 'C:\Users\carlo\Documents\ChatGPT\Orvex 1'
npm run test:time
npm run test:time:browser
npx tsc -b
npm run build
npm audit
npm audit --prefix functions
```

Tests deliberately create random synthetic companies/users in the dedicated test project. Some tests patch only their newly created fixtures to simulate elapsed meal durations, changed rates or revoked roles. They do not search for, replace or reuse the original company. No application startup code seeds a workspace. Expected permission-denied messages prove that direct client writes/read attempts are blocked.

## Optional manual walkthrough

To explicitly create a **new synthetic demo** for manual testing, run the opt-in command below. This is a test fixture, not a replacement for ORVEX Demo Services, and it does not recover or import business data. It prints only synthetic login credentials/UIDs, not Auth tokens or existing account details.

```powershell
node scripts/create-isolated-time-fixture.mjs --create-synthetic-phase3d-demo
```

Open `http://127.0.0.1:15179/account`. Sign in with the printed Technician account and allow a location fix. The synthetic property's coordinates are Houston (`29.7604, -95.3698`); a real device elsewhere should fail clock-in. Use browser devtools geolocation override for this explicit test, or sign in as the printed Owner and issue a reasoned one-use GPS exception for the printed technician UID and work order `wo1`.

Record clock-in, lunch start/end and clock-out, then refresh. Sign in separately as Owner/Admin to view hours, internal labor cost, meal status, approvals and immutable history. Configure verified coordinates/rates/policies under **Time Tracking → Timekeeping setup and policies**. An Owner can also be assigned to a work order and use their own clock. Changes apply only to that isolated synthetic company.

Keep public signup closed. Technician/administrator account invitations and production role administration remain a later task; no public role-assignment endpoint was added. Existing company memberships remain required.

## Existing regression suites

The existing Phase 3C environment is separate (`demo-orvex-phase3c-tests`, Auth 9299, Firestore 8280, Functions 5301, frontend 5177). Reuse it if running. Otherwise start it with `npm run emulators:pricing` and follow `phase3c-local-testing.md`. Do not point tests at normal emulator ports or an original company.

With the ordinary local frontend on 5173 and isolated Phase 3C frontend on 5177:

```powershell
npm test -- --output tmp/phase3d-local-regressions
npx playwright test --config audit/playwright.config.ts --output tmp/phase3d-storage-audit-results
node scripts/run-phase3c-tests.mjs
npx playwright test --config emulator-tests/pricing.config.ts --output tmp/phase3d-pricing-browser-results
node scripts/prepare-phase3d-regressions.mjs
npx playwright test --config tmp/phase3d-work-order-regression/playwright.config.ts --output tmp/phase3d-work-order-results
```

Authentication/directory tests require the temporary signup-enabled **isolated** frontend at 5178 described in Phase 3C's testing document. Its server gate affects only the synthetic Phase 3C project. After those assertions, run the disabled setup/assertions to close that test gate again and stop only the temporary 5178 frontend:

```powershell
node scripts/prepare-isolated-regressions.mjs enabled phase3c
npx playwright test --config tmp/isolated-regressions-enabled-phase3c/playwright.config.ts --output tmp/phase3d-auth-directory-results
node scripts/prepare-isolated-regressions.mjs disabled phase3c
npx playwright test --config tmp/isolated-regressions-disabled-phase3c/playwright.config.ts --output tmp/phase3d-signup-disabled-results
```

The normal frontend's signup flag remains disabled. Existing failure/recovery tests remain; role-revocation assertions now expect privileged editors to be removed immediately rather than remaining usable after revocation.

## Verification record

| Suite | Final result |
| --- | --- |
| Phase 3D shared calculations | 9 passed |
| Phase 3D callable backend/security | 17 passed |
| Phase 3D mobile/browser workflows | 4 passed |
| Existing application/local-recovery browser tests | 45 passed |
| Existing browser storage audit | 3 passed |
| Existing authentication and directory | 9 passed |
| Existing public-signup-disabled | 3 passed |
| Existing work-order browser workflows | 5 passed |
| Existing rules, backup, money and pricing backend regressions | 40 passed |
| Existing Phase 3C pricing browser workflows | 4 passed |
| Total distinct tests | **139 passed** |
| TypeScript / production build | Passed |
| Root / functions dependency audits | 0 / 0 vulnerabilities |

Initial harness attempts detected an occupied low port and an expanded mobile sidebar covering a form button; both were corrected without stopping existing services. Older role-revocation tests were updated for immediate privilege removal and rerun. The final build still reports a large account bundle warning; code splitting remains an optimization, not a failed build. Emulator execution used host Node 24 rather than the backend's declared Node 22.

The checkpoint fingerprint was rechecked read-only with:

```powershell
node scripts/emulator-data.mjs inspect --from firebase-export-1791850651525C6Q8mE
```

Do not run a normal emulator import/restart command as part of this phase. See `emulator-safe-restart.md` for the separate approval-controlled recovery procedure. Browser-local backups and a Firebase checkpoint cover different stores; neither is evidence of verified current company data.
