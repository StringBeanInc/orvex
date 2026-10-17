# Phase 3E — Estimates, change orders and invoices

Implementation and local validation: October 15, 2026, on `firebase-preparation`. This remains emulator-only development. Nothing was pushed, deployed, imported, migrated or connected to production or a payment processor.

## Preservation and compatibility

The repository was inspected before implementation, including the Phase 3C/3D reports and test instructions, architecture, rules, indexes, pricing/timekeeping functions, customer/property/company/work-order models, local document implementation and existing tests. The concise plan and compatibility choices were explained before code changes.

All earlier uncommitted work was retained. The separate browser-local workspace, document templates, local backup/recovery mechanisms and Phase 3D time records remain intact. Tests use disposable browser contexts, not the user's browser profile. No claim is made that the user's browser-local storage was backed up.

The October 12 checkpoint `firebase-export-1791850651525C6Q8mE` was inspected read-only and remains six files / 20 Auth users with manifest SHA-256:

`8f36515546b333cc8b022bc0afb95896d83fefeca1a03ea154ceab50ce47ccf5`

Its unchanged files are not proof of current original company data. That data remains **unverified**, and the checkpoint was not imported.

The complete existing Phase 3C synthetic emulator group was reused. Phase 3D's Firestore listener was still present while its Auth/Functions listeners were unavailable; it was left untouched. The timekeeping runtime gained only an explicit allowlist entry for the already-isolated Phase 3C ports so compatibility tests could run there. No original test company or user was reconstructed or replaced.

## Authorization and data boundary

Financial operations retain Phase 3C's **Owner-only** authorization. A Phase 3D Admin or Technician does not gain financial access. Every financial read/write transaction requires verified Firebase authentication, resolves company membership from the server's `users/{uid}` record, verifies an active same-company Owner membership, and rejects a mismatched requested company ID. Client roles, actors, ownership and calculated totals are never authoritative.

New callable endpoints are `financialView` and `financialCommand`. They refuse to run outside explicitly allowed local demo projects, exact loopback Auth/Firestore ports and the Functions emulator flag. Normal production builds still disable company cloud access. No new Firebase service, billing change or production setting was needed for this phase.

Company records use:

```text
organizations/{companyId}/estimates/{id}
organizations/{companyId}/changeOrders/{id}
organizations/{companyId}/invoices/{id}
  versions/{issuedVersion}          immutable issued content
  events/{eventId}                  immutable actor/time/revision/snapshot history
  payments/{paymentId}              immutable manual invoice payment records
  paymentReferences/{referenceHash}  duplicate-reference reservation
  approvals/{issuedVersion}         immutable applied change approval
organizations/{companyId}/financialOperations/{operationId}
organizations/{companyId}/financialWorkOrders/{workOrderId}
organizations/{companyId}/billingLocks/{workOrderId}
organizations/{companyId}/numberSequences/financial_estimates
organizations/{companyId}/numberSequences/financial_changeOrders
organizations/{companyId}/numberSequences/financial_invoices
```

Firestore rules block **all direct client financial writes**, including Owner writes, payments, versions, events, locks and numbering. Protected financial reads are Owner-only; technicians no longer inherit the former generic read permission for financial collections. Financial history remains scoped to the company. Operations revalidate linked active customer/property relationships, work orders, originating estimates and catalog references.

New documents carry `financialSchema: phase3e-v1`, schema version, company, kind, currency, record revision and server timestamps. Existing records without that marker are excluded from the new UI, counted as unsupported, and never reinterpreted or overwritten. New numbering is blocked if unsupported records or missing/inconsistent numbering state require recovery. Counters use a separate reserved prefix, and candidate numbers are checked against existing records. A separate reviewed migration would be necessary to adopt unknown legacy financial data.

Commands use transactional revision checks and caller-bound operation IDs with a payload fingerprint. Retrying the same uncertain request returns the committed result; reusing an ID for another payload fails. Record changes, audit history, counters, reservations and related pricing changes commit together. Unknown failures do not fall back to localStorage or production. Draft controls remain locked while an uncertain request awaits retry, avoiding competing submissions.

## Estimates

Owners can create, edit, duplicate and archive drafts, with company-scoped numbers; company/customer/property links; optional existing work order; catalog services, labor and materials; custom charges; discounts; explicit tax; expiration; internal notes; and customer-facing scope. Archiving preserves the record indefinitely and exposes it through the archive filter.

Issuing captures an immutable numbered version, issuer company name and customer/property snapshots. Issued content cannot be silently edited. Owners can record acceptance/decline with authenticated actor, server time, reason, exact issued version and revision. This is an administrator's recorded attestation, not authenticated customer consent or an electronic signature. No public links, portal or unauthenticated access were added.

Expired status is derived from the expiration date and current UTC date while an estimate is issued. Expired estimates cannot be accepted. An accepted estimate stays accepted after its offer expiration. Superseding is explicit; a revised draft can then be edited and issued as a new version, retaining every prior issued version and decision in history. An estimate already converted to a work order requires change orders rather than revision of the accepted scope. Duplication copies the current estimate into a separately numbered draft and preserves historical catalog prices.

## Conversion and approved work-order scope

Conversion requires an accepted estimate and explicit confirmation. A transaction allocates a work-order number, creates a Phase 3B-compatible header/activity entry, adjusts property work-order count and creates pricing/history from the exact accepted quote. Repeated or concurrent conversion cannot create duplicate work orders.

If the estimate already links an existing work order, conversion accepts only absent or exactly matching existing pricing. Different saved charges cannot be overwritten. The work-order/estimate/version link lives separately in `financialWorkOrders`, avoiding additional fields that the existing work-order editor would drop. Missing or invalid existing numbering state fails closed rather than being initialized over existing work orders.

Approved financial scope is pinned: Phase 3C's trusted pricing endpoint refuses direct charge changes on a financially managed work order, and rules prevent moving its customer/property identity. Ordinary work orders retain their existing pricing behavior. Operational header edits and Phase 3D clock tracking remain separate. Internal tracked labor costs are never copied into customer charges.

## Change orders

Each change order records the complete proposed billable scope and the exact original pricing revision/snapshot, plus added/removed/revised item identifiers and signed before/after/delta totals. This reuses nonnegative Phase 3C charge lines while allowing an explicit negative overall delta for removed/reduced scope. Derived running amounts do not falsely count as revised work.

Draft, issued, approved, rejected and canceled states are supported. Issuance does not change work-order charges. Approval and application occur in one transaction, saving the approved snapshot and pricing history and applying the change once. A changed base pricing revision or concurrent approval fails instead of applying against stale scope. Approved changes cannot be canceled; a new reversing change order is needed. Rejected/canceled changes do not affect charges.

## Invoices and payments

Owners can create manual customer/property invoice drafts or capture a work order's current explicit billable charges. Applied change orders are already included in those charges; their deltas are **not added again**. A work-order draft must refresh explicitly if approved scope changes before issue. Its lines cannot be independently edited outside the approved work-order scope; manual invoices have their own editor.

This phase supports **one full active invoice per work order**. Draft reservations prevent duplicates. An archived draft or explicitly voided unpaid invoice releases the reservation. Once issued, further change application to that work order is blocked pending a separate billing/credit review. Progress billing, deposits, multiple partial-scope invoices and credit notes are not implemented. Partial **payments** against one invoice are supported.

Invoice states include draft, issued, partially paid, paid and void. Overdue is derived from due date and an unpaid issued balance, without replacing the payment state in storage. Zero-value issued invoices are paid with zero balance and no invented payment record. All date-only expiration/due/payment calculations currently use explicitly labelled UTC dates.

Manual payments record positive integer cents, date, method, reference, actor, time and issued version. Negative/fractional payments, overpayments, future dates and duplicate payment IDs/references are rejected. Reference matching trims whitespace and ignores case. Repeated operation IDs and simultaneous payments cannot double-post or create negative balances. This detects duplicate records, not an externally forged receipt: an authorized Owner is attesting the payment happened elsewhere.

Issued content remains immutable while payment state/balance change through audited operations. Explicitly confirmed voiding is permitted only for an unpaid issued invoice. Paid/partially paid invoices require a separately reviewed adjustment/refund workflow; this phase never silently deletes a payment, invoice or history.

## Pricing, previews and user interface

USD only; all amounts use Phase 3C integer-cent calculations and deterministic rounding. Quantities use thousandths. The 50-charge limit, $100,000/unit bound, one explicitly named tax rate applied to discounted subtotal, and fixed cent discount remain unchanged. No jurisdiction, tax rate or exemption is inferred. Historical catalog sources and issued prices survive catalog updates/deactivation.

The expandable/collapsible sidebar adds Estimates, Change Orders and Invoices for Owners. Pages provide searchable/status-filtered lists, archives, linked customer/property/job views, draft forms, catalog/custom line editing, previews, issued-version selection, approvals/conversion, change history, invoice payment controls and responsive mobile layouts. Internal notes are displayed only in the authorized management view.

PDF downloads use saved draft/issued content, company-name branding and customer-facing fields only. Invoice payment/balance summaries reflect current recorded state; original issued scope and amounts remain frozen. Voids are marked visibly. Internal notes, purchase costs and Phase 3D labor costs are excluded. Fifty-charge/long-scope PDFs paginate with repeated table headings, a single totals block and page numbers. The initial company model has only a supported company name; no browser-local branding/templates were imported into company documents.

Estimated quotes, approved scope deltas, invoiced charges, recorded payments and internal labor estimates remain distinct records. There is no combined revenue figure, profitability/accounting integration, automatic time-to-invoice charge or payment gateway.

## Changed files in this phase

| Files | Change |
| --- | --- |
| `functions/financial.mjs` | New trusted financial commands, views, lifecycle, conversion, payment/numbering guards and audit history |
| `functions/pricingValidation.mjs` | Existing Phase 3C validation extracted unchanged for reuse |
| `functions/index.mjs` | Financial exports, shared validator import/re-export and managed-scope pricing guard |
| `functions/timekeeping.mjs` | Explicitly allow the existing isolated Phase 3C test profile; timekeeping logic retained |
| `src/company/financialModel.ts` | Financial types, date/status helpers, projections and scope deltas using Phase 3C pricing |
| `src/company/CompanyFinancials.tsx`, `financial.css` | Financial pages, editors, previews, lifecycle/payment controls and responsive styles |
| `src/company/financialPdf.ts` | Customer-safe paginated PDF rendering using existing PDF dependencies |
| `src/auth/AccountPage.tsx` | Owner financial navigation and routing |
| `firestore.rules` | Protected financial reads/writes, immutable child history and managed work-order identity guard |
| `package.json`, `scripts/build-pricing-backend.mjs` | Test/start commands, shared model generation, JS import rewriting, unchanged-output preservation and syntax checks |
| `scripts/wait-financial-emulators.mjs` | Bounded read-only readiness probes before financial tests; no service restart or data write |
| `scripts/prepare-phase3e-compatibility.mjs` | Temporary configurations to run earlier time tests on matching existing services |
| `scripts/create-isolated-financial-fixture.mjs` | Explicit optional synthetic manual demo; never app-startup seeding |
| `emulator-tests/phase3e-fixtures.mjs`, `financial-fixtures.mjs` | Synthetic, bounded local test helpers |
| `emulator-tests/financial-model.test.mjs`, `financial-backend.test.mjs` | 27 financial model/backend/security tests |
| `emulator-tests/financial.config.ts`, `financial.spec.ts` | Six financial browser/PDF/mobile workflows |
| `emulator-tests/auth.spec.ts` | Company lookup through its own verified membership instead of a capped all-company scan |
| `emulator-tests/time-backend.test.mjs` | Deterministic overtime-request fixture that remains valid across local midnight |
| `vite.config.ts` | Ignore generated test artifacts so HTML/PDF/traces do not reload another business editor |
| `docs/firebase-phase-3e.md`, `docs/phase3e-local-testing.md` | Architecture, validation, setup, limitations and production gates |

Other dirty files predate Phase 3E and were preserved. Test-regenerated tracked preview PNGs are restored to their initial state. No dependency or lockfile was changed in this phase. Indexes were inspected: company-path collection reads use no new compound filters/orders, so no index change/deployment was needed.

## Verification and remaining production work

See [phase3e-local-testing.md](phase3e-local-testing.md) for the exact suite counts, PowerShell commands and rerun notes. All 172 distinct tests pass after the documented fixes/reruns. TypeScript, JavaScript syntax checks and production build pass. Root and backend dependency audits each report zero vulnerabilities. The existing-style large account bundle warning remains an optimization task.

This is not production readiness or certified accounting/tax software. Review invoice issuer/legal fields, numbering/retention rules, tax treatment, currency/date/timezone requirements and credit/refund procedures for the relevant jurisdiction before live use. Company branding is currently name-only; multilingual PDF font embedding and cloud template/branding management are future work.

Other blockers include deployment-specific IAM/App Check/token-revocation policy, monitoring/rate limits, pagination and reporting aggregation (views fail clearly above 1,000 records per queried collection), backup/recovery coverage and retention for the new company collections, approved financial-role expansion, and verified production recovery points. A financial document is capped at 850 KB to leave room for Firestore audit metadata; very long descriptions may need shortening even within 50 charges. Browser-local exports do not back up Firestore company financial records.

Public customer approval/signature access, automatic sending/email, payment processing, live accounting integration, refunds/credit notes and progress billing remain outside this phase. A future portal must project customer-safe fields rather than expose full management/audit snapshots containing internal notes. Payment references are deduplicated within each invoice, not reconciled against an external bank ledger. No original company recovery was attempted. Any deployment, production connection or data migration requires separate approval and verified backups.
