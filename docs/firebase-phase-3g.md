# Phase 3G — Accounting integration (local mock only)

Implemented on `firebase-preparation`. No real Intuit OAuth, credentials, network transport, imports, migrations, emulator resets, pushes or deployments. Original company data remains unverified; no replacement original company/user was created.

## Security and behavior

Accounting / Integrations reuses the company shell and mobile sidebar. Owners have access; other supported roles need explicit Owner-granted `accounting.read`, `accounting.connect`, `accounting.configure`, `accounting.sync` and/or `accounting.reconcile`. These grants do not imply invoice access, internal costs, compensation or profitability access. Legacy Admin receives no new accounting access. Invoice exports and reconciliation additionally require `invoice.read`; customer operations require `directory.read`.

Every sensitive command revalidates verified authentication, active company membership and permissions in a trusted emulator transaction. Company IDs select a namespace but never establish authorization. Direct client access to accounting state, credentials, mappings, jobs and audit is denied by Firestore rules. Existing business rules were not relaxed.

Mock consent uses identity/company-bound hashed state and nonce, five-minute expiry, single use and disconnect epochs. Realm identity is derived server-side, globally reserved, and retained across disconnect. Private credential documents contain simulated validity/expiry/generation metadata only: no actual access or refresh token is created. Refresh is serialized; invalid refresh requires reconnect. Disconnect preserves jobs, mappings and history.

Customers require explicit review for ambiguous names. No automatic name merge occurs. Reverse mappings prevent two local customers claiming one accounting customer. Explicit separate creation and linking to an unmapped mock customer are supported. Source or accounting-side changes become conflicts; historical invoice customer mappings cannot be silently redirected.

Only eligible issued immutable invoice versions are exported. Payloads allowlist customer-facing fields, integer-cent prices, explicit discount/tax configuration and issued date/version. Internal notes and costs are excluded. This is an ORVEX canonical mock payload, **not a verified QuickBooks API wire format**. A mismatched returned total/tax blocks mapping. No existing accounting invoice or ORVEX issued invoice is overwritten.

Queue keys, caller-bound operation IDs, payload hashes and remote receipts support concurrent processing and retry after an uncertain response. Bounded exponential/provider backoff stops after four attempts; explicit recovery preserves total attempts. Conflicts require review and cannot be automatically retried. There is no background scheduler: users explicitly run or retry jobs and refresh the dashboard when a delay expires.

Simulated partial/final payments produce deduplicated, audited reconciliation proposals, including unmatched/overpayment conflicts. They never post payments, alter original totals/tax, or rewrite ORVEX financial history. Repeated events/payment IDs are deduplicated and changed payload reuse is rejected. Unmatched fixture balances are illustrative and must not be treated as an identified invoice balance.

## Storage

All state is under `organizations/{companyId}`: `qboConnections`, `qboOAuth`, `qboPrivate`, `qboMock`, `qboJobs`, `qboMappings`, `qboRemoteLinks`, `qboOperations`, `qboAudit`, `qboInbox`, `qboPayments` and `qboReconciliations`. Server-only `qboRealmClaims` binds mock realms. Audit entries are append-only through the backend. Lists fail explicitly beyond 500 records; the mock ledger is capped at 700 KB. No business-module data is migrated.

## Changed files for this phase

Added:
- `functions/accounting.mjs`, `functions/quickbooksMock.mjs`
- `src/company/accountingModel.ts`, `src/company/CompanyAccounting.tsx`, `src/company/accounting.css`
- `emulator-tests/accounting-fixtures.mjs`, `emulator-tests/accounting.test.mjs`, `emulator-tests/accounting.spec.ts`, `emulator-tests/accounting.config.ts`
- `docs/firebase-phase-3g.md`, `docs/phase3g-local-testing.md`

Updated:
- `src/company/permissions.ts`, `src/auth/CompanyWorkspace.tsx`
- `functions/index.mjs`, `scripts/build-pricing-backend.mjs`
- `firestore.rules`, `package.json`

Generated shared backend model output is produced by the existing build. Other uncommitted files predate this phase and were preserved.

## Remaining production blockers

Real OAuth and token persistence are deliberately absent. Before a separately approved sandbox phase: configure an Intuit developer sandbox app and exact HTTPS redirect URI; implement trusted callback/state handling, company realm ownership checks and encrypted token envelopes using managed KMS/Secret Manager; restrict backend IAM; redact secrets from logs/backups; serialize refresh rotation with compare-and-swap; revoke/delete credentials on disconnect; test token rotation/revocation and failure recovery. Never store tokens in browser localStorage or return them to the frontend. Real service setup/billing and deployment require approval.

A real external request cannot be atomic with Firestore. Implement a durable outbox, expiring worker leases, stable provider request IDs and reconciliation before retrying uncertain commits. Verify Intuit retention/idempotency limits rather than assuming mock receipts are equivalent. Add signed webhook verification, replay protection, realm resolution, authenticated payment fetches and explicit posting approval. Validate country-specific tax/AST, discounts, service items, dates, currencies and API validation errors in sandbox. Add pagination, monitoring, log retention, recovery tooling, encrypted token backup exclusions and security review. Customer changes after an uncertain committed export can remain a manual conflict requiring future reconciliation tooling.

Official references: [Intuit OAuth](https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0), [Invoice API](https://developer.intuit.com/docs/api/accounting/invoice), [webhook configuration](https://static.developer.intuit.com/output_html/qbo/docs/develop/webhooks/configure-webhooks.html). These inform future work; no real connection was tested.

Validation details and exact commands are in `phase3g-local-testing.md`.
