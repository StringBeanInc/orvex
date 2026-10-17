# Phase 3C local setup and tests

Do not import, reset, or replace the original company data. The following emulators are a separate synthetic testing environment. They do not recover ORVEX Demo Services.

From PowerShell in the project:

```powershell
Set-Location 'C:\Users\carlo\Documents\ChatGPT\Orvex 1'
npm ci
npm ci --prefix functions
npm run build:pricing-backend
```

Use a supported Node.js installation (the backend declares Node 22; the installed host used Node 24 during the successful local tests). Firebase CLI and Java are required for emulators. No production Firebase credentials or private keys are needed.

Terminal 1 — dedicated emulators:

```powershell
$env:FUNCTIONS_DISCOVERY_TIMEOUT='60'
npm run emulators:pricing
```

Wait for Auth 9299, Firestore 8280 and Functions 5301 to report ready and for `saveWorkOrderPricing` to load. This command has no import, export-overwrite, clear, reset or production project option. If a port is occupied, inspect/reuse the matching test service or choose an explicitly reviewed isolated configuration; do not terminate an unknown emulator or reset its data. The Eventarc sidecar has its own test port 9399 to avoid colliding with Auth.

Terminal 2 — signup-disabled test frontend:

```powershell
$env:VITE_FIREBASE_EMULATOR_PROJECT='demo-orvex-phase3c-tests'
$env:VITE_ENABLE_PUBLIC_SIGNUP='false'
npm run dev -- --configLoader runner --port 5177
```

Terminal 3 — Phase 3C checks:

```powershell
npm run test:pricing
npm run build
```

`test:pricing` builds the shared backend model, runs all existing and new Node rules/money/backend/backup tests on the isolated ports, then runs the four new browser workflows. They create synthetic identities and companies with random IDs, not replacements for the original company. No demo records are seeded by the application itself. A failed/missing emulator causes tests or saves to fail; there is no production fallback.

For the existing signup-disabled assertions:

```powershell
node scripts/prepare-isolated-regressions.mjs disabled phase3c
npx playwright test --config tmp/isolated-regressions-disabled-phase3c/playwright.config.ts --output tmp/phase3c-signup-disabled-results
```

For existing authentication/directory assertions, a separate frontend is needed only during those tests:

```powershell
$env:VITE_FIREBASE_EMULATOR_PROJECT='demo-orvex-phase3c-tests'
$env:VITE_ENABLE_PUBLIC_SIGNUP='true'
npm run dev -- --configLoader runner --port 5178
```

From the test terminal:

```powershell
node scripts/prepare-isolated-regressions.mjs enabled phase3c
npx playwright test --config tmp/isolated-regressions-enabled-phase3c/playwright.config.ts --output tmp/phase3c-auth-directory-results
```

These assertions change only the synthetic project's signup gate. Run the disabled setup/assertions again afterward to close it, and stop the 5178 frontend. Do not use this test gate or frontend for actual company registration. The normal frontend remains signup-disabled throughout.

## Original local workspace

In a fresh terminal, clear temporary frontend overrides and start the existing local application:

```powershell
Remove-Item Env:VITE_FIREBASE_EMULATOR_PROJECT -ErrorAction SilentlyContinue
Remove-Item Env:VITE_ENABLE_PUBLIC_SIGNUP -ErrorAction SilentlyContinue
npm run dev -- --configLoader runner
```

Open `http://127.0.0.1:5173/`. Run existing local regressions with:

```powershell
npm test
npx playwright test --config audit/playwright.config.ts
```

## Original company Firebase restart

There is still no verified current recovery source. Do not import October 12, create a replacement company, or start a blank normal emulator. `npm run emulators` retains its explicit-source/confirmation gate. After a separately verified recovery point is approved, that wrapper now starts Auth, Firestore and the local pricing Functions emulator, and exports to a newly reserved shutdown destination. Build/install the backend before any approved recovery. See `emulator-safe-restart.md`; the commands in its future-restore section are not authorization to import now.

No production Function, Firestore rule, application or Firebase setting was deployed. Production backend access is fail-closed until separately reviewed and approved; do not remove the runtime guard to test locally.
