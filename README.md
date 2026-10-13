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

## Documents & Templates

In Settings, configure **Documents & Templates → Company Profile & Branding** before generating customer-facing PDFs. ORVEX is the platform, never the automatic document issuer. The business name begins empty, and preview/download of documents requires an issuing business name. The workspace label is separate from company branding. PNG/JPEG logos are limited to 1.5 MB to accommodate temporary browser storage.

Enable Estimate, Invoice, and Change Order, configure their titles and numbering prefixes, and choose default templates under Document Types. Document Defaults & Numbering stores per-type notes, terms, dates, and sequence numbers, plus an optional tax rate. Taxes apply only to document items marked taxable; they are disabled by default. Change orders support negative rates for credits and show the original contract, prior approved changes, and revised contract. Invoices show payments/credits and balance due.

Create drafts from a work order, a customer card, or Documents. Each draft has its own number and saved company, customer, property, pricing, and template snapshots. Work orders and catalog prices are unaffected by document edits. Explicitly refresh branding or apply the latest saved template when you want an existing draft to adopt changes. Drafts can be edited, saved, previewed, downloaded, and printed from the PDF preview; use Open PDF if the browser's embedded PDF viewer cannot print. Nothing sends email or finalizes a document.

The visual builder includes US Letter design pages, 2 mm snapping, a center alignment guide, dragging, resizing, keyboard arrow movement, block position/size controls, field visibility, table column order, headings, fonts, alignment, accents, and custom text. Add explicit pages or allow long data to flow to additional pages. Block heights reserve a minimum space; content expands as needed, following intersecting sections move, and empty optional sections collapse. The exact PDF preview and downloads share one renderer. The canvas is a layout editor, while PDF preview is the authoritative output preview. Custom templates can be saved, duplicated, deleted, and made the default; starters can be restored. Only three fully implemented document types are exposed. Adding future types requires a corresponding typed config, starter template, and workflow.

### Temporary persistence and Firestore boundary

`src/documents/repository.ts` defines the async `DocumentRepository` interface (`load` and transactional updates). `LocalDocumentRepository` stores the versioned document workspace under **orvex-documents-v1**, separate from existing app data. Browser Web Locks serialize read/update/write operations across tabs to avoid duplicate locally allocated numbers. The UI labels this as local browser persistence, not shared production storage. Documents offers a JSON backup export including branding, templates, and drafts. Clearing site data removes it; a different hostname/browser uses separate storage.

A future Firestore adapter should replace `LocalDocumentRepository`, use authenticated organization-scoped paths and server transactions for numbering, and move logos/attachments to object storage. Existing work orders still use the original `orvex-v0.1` browser storage. No Firebase service or authentication is currently connected.

Document browser tests cover branding, draft persistence, all three PDF downloads, calculated taxes, payments, change-order deductions, template management/dragging/visibility, and long-document pagination. PDF samples and screenshots generated by tests live in `tmp/`; they use isolated browser contexts and illustrative companies.

## Firebase security audit and implementation plan

Firebase is not connected. Before replacing local persistence, review the [confirmed storage risks](docs/firebase-security-audit.md), [organization and authorization architecture](docs/firebase-architecture.md), [backup and recovery plan](docs/firebase-backup-recovery.md), and [production security test gates](docs/firebase-security-test-plan.md).

The initial audit reproduced stale-tab overwrites, sample fallback overwrites after a failed load, and permanent deletion without recovery. The subsequent local implementation adds revision conflicts, fail-closed loading, verified complete backups, controlled restore, and a 30-day recycle bin. Read [Local data protection and recovery](docs/local-data-recovery.md) for usage and limits. Firebase cloud security remains unimplemented. The converted audit regressions are separate from normal tests:

```powershell
npx playwright test --config audit/playwright.config.ts
```

A passing audit regression now requires preservation and recovery. Tests use isolated browser contexts and synthetic local records, never production Firestore. Download your own backup through Settings → Backup & Recovery in the browser/origin containing your data; Codex cannot export another browser's localStorage. Do not migrate personal data without a complete verified backup and reviewed migration plan, and do not deploy authentication/database changes until the security and recovery gates pass.

Phase 2 emulator implementation and manual setup: [Company registration and authentication](docs/firebase-phase-2.md). Open `/account` with `npm run emulators` running. The separate local business workspace and recovery tools remain at `/`. Production company services are disabled.

Phase 3A: company Customers and Properties are enabled at `/account`; see [usage, security and test results](docs/firebase-phase-3a.md). The root `/` remains the separate browser-local workspace.

Public company signup is temporarily closed by default and a server-enforced bootstrap gate. See [signup controls and Firebase Auth limitations](docs/public-signup-control.md). Existing users can sign in normally.
