# Safe local restart, backups and isolated tests

## Restart ORVEX now without recovering Firebase

In PowerShell:

```powershell
Set-Location 'C:\Users\carlo\Documents\ChatGPT\Orvex 1'
npm run dev -- --configLoader runner
```

Open `http://127.0.0.1:5173/` for the existing browser-local workspace. Its local data belongs to that browser/origin. At `/account`, normal company login will report unavailable until the original Firebase state is safely recovered. Do not register a replacement company.

`npm run emulators` intentionally refuses to start a blank normal workspace or import an unchosen checkpoint. **Do not select/import the October 12 recovery checkpoint now.** There is presently no verified current baseline with which to restart the original Firebase company safely.

## Read-only inspection

```powershell
npm run emulators:inspect -- --from '.\firebase-export-1791850651525C6Q8mE'
```

This reads and fingerprints files without modifying them or importing. It verifies Auth/Firestore file structure and an integrity manifest if one is present. The October 12 checkpoint has no added manifest; compare its fingerprint to the preserved baseline in the Phase 3B report. Inspection cannot prove the records are current or that native import works.

## Back up a currently running normal emulator

Only if the original normal hub/Auth/Firestore are already running and confirmed to be the intended company state:

```powershell
npm run emulators:backup
```

The wrapper exports Auth + Firestore to a timestamp/UUID destination under `emulator-backups`, refuses existing destinations, and writes a SHA-256 manifest. Failed export leaves an unverified destination for inspection; do not call it a good backup. It does not overwrite the source/checkpoint. Copy verified backups to a private independent location; do not upload native Auth exports to Git or a public website. Never use `--force` to overwrite a backup.

## Future controlled restore (not authorized in this task)

First verify the selected export's origin, actual recovery timestamp, completeness, integrity and business contents. Obtain explicit approval of that recovery point. Back up any running state first; do not stop it before backing it up. Stop the normal emulator gracefully only after its current data is preserved. The wrapper refuses an import if normal ports are already running.

Only after approval, replacing the placeholder with the specifically approved current export:

```powershell
npm run emulators -- --from 'C:\path\to\approved-current-export' --confirm-import
```

The source is read-only. Shutdown export uses a separate newly reserved UUID path; no `--force` is passed. Stop gracefully with Ctrl+C and wait for the export to finish. Inspect the new shutdown export before treating it as verified; abrupt termination can lose changes held only in memory. Save periodic explicit backups while running, instead of relying solely on shutdown. This wrapper does not bypass Firebase CLI with import/export commands and cannot prevent someone manually running unsafe CLI commands elsewhere.

No restore, native import drill or normal live export was run during this implementation.

## Isolated development and tests

These ports/project are **synthetic automated test data**, not ORVEX Demo Services. No import is performed.

Terminal 1:

```powershell
npm run emulators:isolated
```

Terminal 2 (signup disabled Work Order frontend):

```powershell
$env:VITE_FIREBASE_EMULATOR_PROJECT='demo-orvex-phase3b-tests'
$env:VITE_ENABLE_PUBLIC_SIGNUP='false'
npm run dev -- --configLoader runner --port 5175
```

Terminal 3:

```powershell
npm run test:rules
npm run test:workorders
npm run test:signup-disabled
```

For the existing signup-enabled regression assertions, use a separate terminal/frontend on 5176:

```powershell
$env:VITE_FIREBASE_EMULATOR_PROJECT='demo-orvex-phase3b-tests'
$env:VITE_ENABLE_PUBLIC_SIGNUP='true'
npm run dev -- --configLoader runner --port 5176
```

Then `npm run test:auth`. This changes the signup gate only in the synthetic isolated project; run signup-disabled assertions separately before or after, not concurrently. Stop those test frontend terminals afterwards. Clear the temporary shell variables before starting a normal frontend:

```powershell
Remove-Item Env:VITE_FIREBASE_EMULATOR_PROJECT -ErrorAction SilentlyContinue
Remove-Item Env:VITE_ENABLE_PUBLIC_SIGNUP -ErrorAction SilentlyContinue
```

With the normal frontend running on 5173:

```powershell
npm test
npx playwright test --config audit/playwright.config.ts
npm run build
```

Tests fail if isolated emulators are unavailable; they do not fall back to production. No reset/clear/import is used. Rule fixtures use unique synthetic project IDs. Normal local app regression tests use disposable browser contexts. They do not recover another browser's localStorage.
