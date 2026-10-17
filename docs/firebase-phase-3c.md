# Phase 3C — Service Catalog and Pricing

Implemented and validated locally on October 14, 2026, on `firebase-preparation`. This continues the uncommitted Phase 3B implementation. No push, merge, deployment, production connection, public signup enablement on the normal workspace, import, migration, or reset was performed.

## Features

Company navigation now includes Service Catalog, Labor Rates, and Materials & Supplies. Each page supports creation, viewing, editing, deactivation/reactivation, search, category/status filtering, sorting, and pagination. Categories are company-specific free text with suggestions for Plumbing, Electrical Maintenance, Drywall, Painting, Janitorial, HVAC Maintenance, and Preventive Maintenance. Suggestions never create records.

Services include unique code, name, description, category, fixed/hourly/per-unit pricing, selling price, unit and estimated duration. Labor rates include code, trade/role, description/category, standard/overtime hourly rates and optional internal cost. Materials include SKU, description/category, unit, purchase cost, selling price, optional computed markup and supplier. Codes are normalized uppercase, unique across all three catalogs within a company, immutable after creation, and reserved when inactive. Create a new code instead of reusing a historical code.

Work Order details include a charge editor for catalog services, standard/overtime labor, materials, and custom charges. Description, quantity, unit and selling price can be edited explicitly. Charges can be removed and reordered. Saved totals include subtotal, an optional fixed USD discount, optional explicitly configured tax, and total. Tax defaults to off; no rate is inferred from location or company. The named percentage applies to the discounted subtotal. Tax-exempt/per-line and multiple-jurisdiction tax handling are future work.

Catalog descriptions and original prices are copied into each charge's immutable source snapshot. The billable charge description/price may be adjusted explicitly without rewriting the source snapshot. Updating or deactivating the catalog cannot alter saved charges. Catalog and pricing changes retain immutable history with the verified actor, server time, revision, and full saved snapshot. Removing a charge retains earlier history.

## Data and security

```text
organizations/{companyId}/pricingCatalog/{itemId}
organizations/{companyId}/pricingCatalog/{itemId}/history/{eventId}
organizations/{companyId}/catalogCodes/{normalizedCode}
organizations/{companyId}/workOrders/{workOrderId}/pricing/current
organizations/{companyId}/workOrders/{workOrderId}/pricingHistory/{eventId}
```

The new catalog is separate from the existing read-only cloud `catalogItems` collection and from browser-local catalog data. No existing collection is reinterpreted or migrated. Pricing is a separate document: opening a Work Order does not initialize, rewrite, or price its existing header. The backend tests compare the full original header before/after saving charges.

Catalog CRUD uses client Firestore transactions with rule-enforced active, verified Owner membership, scoped identifiers, field allowlists, integer money, immutable codes/metadata, expected revisions, atomic code reservation and append-only audit snapshots. Codes cannot be reassigned or removed by clients. Concurrent creation cannot reserve the same company code twice. Financial reads are Owner-only; direct client writes to pricing or pricing history are denied, including for Owners.

Pricing saves use the trusted `saveWorkOrderPricing` callable. Firebase supplies its authenticated context. The operation requires verified email, discovers the company from the server's `users/{uid}` record, and verifies company existence and active Owner membership inside the transaction. A supplied company ID is only a requested scope and must match; it never determines authorization. It verifies the Work Order, source references, immutable historical snapshots, quantity/price limits, field types, tax and discount configuration, then derives totals itself. The transaction saves pricing and immutable audit history together. Expected revisions reject stale edits; concurrent saves cannot silently overwrite one another.

The final implementation has no staged candidate/proof writes. That experimental approach was removed. Only the confirmed catalog transaction or confirmed backend pricing transaction writes business records. Failed saves keep editor input. Ambiguous timeout errors require refreshing/reviewing before retrying; a server operation may have committed after the client lost confirmation. There is no localStorage or production fallback.

The function is deliberately emulator-only. It refuses runtime access unless `FUNCTIONS_EMULATOR=true`, the project is the explicitly supported demo project, and Auth/Firestore hosts match the expected loopback ports. A test proves it rejects execution without the emulator flag. Production company access is also disabled by the existing frontend guard. Public signup remains off for the normal frontend and its server gate was not changed.

A trusted operation avoids Firestore's rule expression/access limits for validating a full financial document. The Functions emulator is a new local development requirement; no cloud service or billing setting was enabled. Production Functions enablement, billing requirements, IAM, App Check, token-revocation policy and deployment need separate review and approval before lifting the runtime guard.

## Money strategy and limits

- USD money is stored as integer cents. Quantities are integer thousandths (up to three decimal places).
- Percentages are integer basis points (two decimal places in the UI).
- Extended amounts, markup and tax use deterministic half-up rounding to cents.
- Up to 50 charges per Work Order, up to 1,000 units per charge, and up to $100,000 per unit price/cost.
- These bounds keep all intermediate calculations within JavaScript's safe integer range, including maximum tax calculations. Boundary tests verify the maximum document and reject a 51st charge.
- Discounts cannot exceed the subtotal. Negative/fractional cent amounts, nonfinite numbers, invalid quantities and forged extended amounts are rejected by the backend.

## Preservation

No existing business records, browser-local stores, document templates, backups, or original company/users were migrated, overwritten, reset or deleted. No replacement for ORVEX Demo Services was created. Tests explicitly create synthetic identities/companies on separate Phase 3C ports (Auth 9299, Firestore 8280, Functions 5301). Existing emulator processes were not reset to make ports available. Synthetic fixtures are not actual business backups.

The October 12 export `firebase-export-1791850651525C6Q8mE` remains unchanged. Its before/after manifest SHA-256 is `8f36515546b333cc8b022bc0afb95896d83fefeca1a03ea154ceab50ce47ccf5`. It has not been imported. Current original company data remains unverified; this implementation does not claim that the recovery checkpoint is current. See the Phase 3B preservation report and safe restart procedure. The browser owns its localStorage; tests run in disposable contexts, not the user's browser profile.

## Validation

109 distinct automated tests pass after the documented reruns:

| Suite | Count |
| --- | ---: |
| Existing local app/storage/document tests | 45 |
| Existing storage audits | 3 |
| Existing authentication/directory browser assertions on isolated ports | 9 |
| Existing signup-disabled browser assertions on isolated ports | 3 |
| Existing Work Order browser assertions on isolated ports | 5 |
| Existing Firestore rules tests | 21 |
| Backup procedure tests | 3 |
| New catalog/pricing access rules tests | 6 |
| New decimal-money boundary tests | 3 |
| New trusted backend tests | 7 |
| New catalog/pricing browser tests | 4 |

TypeScript (`tsc -b`), backend JavaScript syntax checking and the production build pass. Vite reports the existing-style non-blocking large account bundle warning. The newly added backend dependency audit reports zero vulnerabilities after upgrading to Firebase Admin 14.5 and Functions 7.4.

The first browser attempt encountered cold Vite dependency optimization; Firebase Functions is now explicitly pre-optimized. A company logout overlap with Firebase's emulator notice was fixed by reserving footer space and scrolling the company navigation. The isolated legacy Auth assertions now request an explicit REST page size so an accumulated set of synthetic fixtures does not truncate company discovery. One existing local document concurrency test exceeded 30 seconds under parallel test load; it passed in 21.8 seconds on the focused rerun with a 60-second ceiling. No storage implementation change was needed.

## Files

New product code: `src/company/CompanyCatalog.tsx`, `WorkOrderCharges.tsx`, `pricingModel.ts`, `pricingRepository.ts`, `pricing.css`.

New backend: `functions/index.mjs`, `functions/package.json`, `functions/package-lock.json`; `functions/shared/pricingModel.js` is generated from the shared TypeScript model and ignored by Git. SDK dependencies are confined to the backend package.

Integration/configuration: `src/auth/AccountPage.tsx`, `src/company/CompanyWorkOrders.tsx`, `src/firebase.ts`, `firestore.rules`, `firebase.json`, `firebase.phase3c-test.json`, `vite.config.ts`, `package.json`, `.gitignore`, the guarded emulator restart wrapper and isolated-regression generator. Existing Phase 3B rules tests accept only the explicitly allowed isolated ports 8180/8280.

Tests/tooling: `emulator-tests/phase3c-fixtures.mjs`, `pricing.spec.ts`, `pricing.config.ts`, `pricing-rules.test.mjs`, `pricing-money.test.mjs`, `pricing-backend.test.mjs`, `scripts/build-pricing-backend.mjs`, `scripts/run-phase3c-tests.mjs`.

## Remaining scope

This is local emulator development, not a deployed SaaS service. Owner-only permissions remain; employee management and finer office/technician roles are not enabled. Pricing is USD-only, with a single explicitly named tax rate and fixed monetary discount. Lists load the company collection before client-side filtering/pagination. Cloud estimates, invoices, change orders, customer-specific pricing, profitability reporting, inventory and purchasing are not enabled by this phase. Local equivalents remain intact. Codes cannot be renamed/reused. The original current company recovery point remains unresolved.

See `phase3c-local-testing.md` for exact local commands. Do not import October 12 or deploy these changes.
