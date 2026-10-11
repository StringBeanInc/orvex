# ORVEX 0.1

A local facility management workspace built with React, TypeScript, Vite, Tailwind CSS, and Lucide icons.

## Open the app

From this folder, run:

```powershell
npm install
npm run dev
```

Open http://127.0.0.1:5173 in your browser. Keep the development server running while using the app. Vite prints a different port if 5173 is occupied. The initial setup uses port 5173 with strict port selection.

## Included

- Responsive dashboard and collapsible navy sidebar
- Work-order creation and editing, technician assignments, priorities, status changes, search and combined filters
- Customer, property, and technician directories with add forms
- Daily scheduling with date navigation and editable jobs
- Reports based on current records and CSV work-order export
- Editable workspace and administrator profile
- Realistic sample records, seeded relative to the date of first use
- Browser LocalStorage persistence, validation, and save-error feedback

## Data storage

Data is saved under `orvex-v0.1` in LocalStorage after a successful change. Use the same browser and URL (including hostname and port) to access the same data. This release has no backend, authentication, or multi-user synchronization. Sample contact addresses use reserved `.example` domains. CSV export contains work orders, not a complete database backup. Clearing site data removes your records.

## Check and build

```powershell
npm run build
npx playwright test
```

Browser tests use installed Microsoft Edge and require the app at http://127.0.0.1:5173. Tests run in isolated browser contexts and do not alter your personal browser data. The tests cover creation, editing, persistence, filtering, navigation, customer creation, settings, CSV export, keyboard dismissal, and mobile overflow.

`npm run build` type-checks the application and produces production assets in `dist`. To inspect the build, run `npm run preview` and open its printed URL.
