# Phase 3B implementation and preservation report

Validated on October 13, 2026, on `firebase-preparation`. No deployment, push, migration, normal emulator import, replacement test company, or replacement owner account was performed.

## Existing emulator data

The project search found one complete native Auth + Firestore recovery export: `firebase-export-1791850651525C6Q8mE`. Its metadata timestamp is October 12, 2026 at 7:17 PM CDT. It contains 20 exported Auth identities and the name `ORVEX Demo Services` occurs in its native Firestore bytes. This is evidence of the recovery snapshot, not proof of the latest company state or proof that a restore would succeed.

SHA-256 of the sorted file manifest: `8f36515546b333cc8b022bc0afb95896d83fefeca1a03ea154ceab50ce47ccf5`. Before/after inspection matches exactly. No integrity file was added to this checkpoint. No source file was modified. The older `tmp/phase3a-firestore-before.json` is a partial diagnostic, not a complete current recovery baseline. No newer complete project export was found. Synthetic backup-validation fixtures under `tmp` are not business backups.

Normal Auth 9099, Firestore 8080 and hub 4400 were unavailable. Therefore live original company data and changes since the recovery checkpoint could not be verified. No import was used to fill this gap. Browser-local data remains separate; this process cannot back up another browser or origin's localStorage.

## Implemented

Company Work Orders use the existing `organizations/{companyId}` namespace, matching Phase 2 and 3A. The authenticated user's verified membership determines the scope; supplied company IDs must match. Owner authorization is enforced by rules for reads/writes/history/counters.

The list has ten requested columns, text search, six filters, sorting, and client-side pagination. Forms support dependent customer/property selection, title, scope, service category, four priorities, six statuses, existing employee assignment, scheduling, due dates, and notes. Detail pages display contacts, address, scope, notes, scheduling and immutable activity history.

Creation atomically allocates a per-company sequential number, writes the order/history, and increments property linkage. Edits check the expected revision. Activity actor/time and change flags are validated against the same atomic work order mutation. Server acknowledgements determine success; errors preserve drafts. Permission-denied races are retried only after confirming that the observed counter/property revision changed. Concurrent edits produce explicit conflicts.

Linked properties cannot be archived or moved to another customer while work orders remain attached. Reassigning a work order maintains both property counters in the transaction. Required fields, dates, relationships, enum values, immutable metadata, role, company and revision are validated in Firestore rules.

Existing local work orders, catalog, documents, PDF generation, backups and recovery are unchanged. Company Catalog, Employees, Documents, Estimates and Invoices editing remain outside this phase. Public signup stays disabled on the normal frontend.

## Validation

- 45 existing local application tests: passed.
- 3 storage audit tests: passed.
- 9 existing authentication/directory browser assertions: passed on isolated ports/project.
- 3 existing signup-disabled browser assertions: passed on isolated ports/project.
- 5 new Work Order browser tests: passed, including actual repository concurrent numbering, sorting/pagination, reopened session, history, failed saves, conflicts and scope isolation.
- 21 Firestore rules tests: passed (14 existing + 7 Work Order tests).
- 3 backup procedure tests: passed (fingerprints/tampering, unique destinations, blocked implicit import).
- TypeScript (`tsc -b`) and `npm run build`: passed. Vite reports a non-blocking account bundle size warning.

Total: 89 passing tests. The initial local regression attempt had connection failures because port 5173 was stopped; the complete rerun passed after starting the frontend.

All Firebase assertions used separate ports 9199/8180 and synthetic test projects. No normal-project records were used or changed. Prior browser assertions were copied with endpoint substitutions by `scripts/prepare-isolated-regressions.mjs`; the old setup's normal-project mutation is now blocked. Synthetic users/companies exist only for explicit isolated automated assertions, not as replacements for the user's company.

## Files

New implementation: `src/company/CompanyWorkOrders.tsx`, `workOrderRepository.ts`, `workOrderModel.ts`, `workOrders.css`.

Integration/security changes: `src/auth/AccountPage.tsx`, `src/firebase.ts`, `src/company/directoryRepository.ts`, `CompanyDirectory.tsx`, `firestore.rules`.

Operational tooling: `scripts/emulator-data.mjs`, `scripts/prepare-isolated-regressions.mjs`, `firebase.test.json`, `.gitignore`, `package.json`.

Tests: `emulator-tests/work-orders.spec.ts`, `work-orders.config.ts`, `work-orders-rules.test.mjs`, `backup-procedure.test.mjs`, existing `security.test.mjs`, `directory-rules.test.mjs`, and guarded `setup.mjs`.

## Remaining limits

The original current company state is unavailable until a trusted current export or still-running emulator is located and verified. Import/shutdown-export operations have not been exercised against actual business data; a native restore drill is intentionally deferred. File hashes detect changed backup bytes after a baseline is recorded, but do not authenticate the author or establish freshness. Keep native emulator exports private: Auth exports can contain credential hashes; they are ignored by Git and must not be uploaded or served publicly. The app's business-only local backup excludes authentication secrets and is a different format.

Work Orders are currently Owner-only. Employee management and finer technician/office roles are not enabled. Lists load the company's collection before pagination; server pagination/indexed filtering should follow before high-volume production use. Work order deletion, cloud recycle-bin restore, cloud line items and quote/PDF generation are not enabled in this phase. Dashboard work-order rollups are not yet connected to the new cloud orders. Production authentication, Firebase settings, managed backups, billing, hosting and deployment were not changed.

See `emulator-safe-restart.md` for exact PowerShell commands and the recovery gate.
