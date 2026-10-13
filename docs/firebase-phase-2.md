# Phase 2: company registration and authentication

Implemented on `firebase-preparation`. No push, deployment, migration, production settings change, or production Firebase connection was made.

## Run the local preview

Prerequisites: installed npm dependencies, Firebase CLI, and Java 21 (Firestore emulator). Run `npm run emulators` in one terminal, then `npm run dev -- --configLoader runner` in another. Open http://127.0.0.1:5173/account. The app connects exclusively to `demo-orvex` on Auth port 9099 and Firestore port 8080. Emulator services must be available; failures show a retry message and never switch to `orvex-2f496`.

The registration form accepts company name, owner name, email, password (at least 12 characters), and matching confirmation. Both business and personal emails work; domains grant no ownership. Registration does not require an invitation. Auth registration is independent of company setup: if email delivery or setup fails, the account remains and the user can sign in, resend verification, refresh verification, and resume setup. Passwords and tokens are never written to business records or business backups.

Email verification and password-reset links appear in the emulator terminal/UI, not a real inbox. Follow those local links, then use Refresh verification or Verify and create company. Auth sessions persist across refresh. Logout clears the company view. Membership changes are observed and inactive membership removes access; server rules independently enforce every read.

## Atomic creation contract

This phase deliberately uses a narrowly validated client batch instead of a new backend service. It supersedes the earlier backend-only bootstrap proposal for this one operation. Firestore Rules are the trusted authorization mechanism, not client ownership fields. A random SDK company ID is generated; the ID is an identifier, not a credential. No ownership is inferred from the name or email domain.

The batch creates exactly the company, initial Owner membership, owner employee, and caller's company lookup. Rules require verified Firebase Auth, bind every identity to request.auth.uid, enforce exact field allowlists and request.time timestamps, and use getAfter to require all four documents together. Existing companies and user lookups cannot be overwritten; forged owners, partial batches, direct role changes, and additional owner claims are denied. Concurrent retries return the already created company. This smallest version supports one company per account; invitations, multiple-company selection, ownership transfer, and role administration are future work.

The only initial employee is the owner. All customers, properties, work orders, catalog items, invoices, estimates, change orders, and templates start absent. No samples or browser-local data are read during bootstrap. Authorized company reads are scoped under organizations/{companyId}; unknown collections and all business writes are denied. This phase only has Owner memberships. Future role-specific reads must be designed and tested before adding other roles.

Company accounts currently have an empty, read-only module shell. The existing local dashboard, sidebar, business editors, backup and recycle bin remain available separately at `/`. That legacy workspace is browser-local and has no authenticated company identity; never present it as tenant-isolated storage. Its original keys remain intact. Cloud module persistence and any explicit, backed-up import are a separate phase.

The production build deliberately disables company service initialization. `orvex-2f496` is still listed in the existing CLI project configuration, but all emulator scripts explicitly use demo-orvex. Do not deploy this phase without reviewing production setup and authorization. No Functions, Storage, or additional billed backend services were introduced.

## Validation

Run `npx tsc -b`, `npm run build -- --configLoader runner`, `npm test`, `npx playwright test --config audit/playwright.config.ts --output tmp/audit-test-results`, `npm run test:rules`, and `npm run test:auth`. Keep the dev server and emulators running for tests. Run rules and auth suites sequentially: the rules suites now reset only the separate demo-orvex-rules and demo-orvex-directory-rules test projects. It does not access browser-local business keys or production data. Emulator state is disposable unless explicitly exported; do not enter real credentials or business data.

The security suite verifies atomic creation, unverified/unauthenticated denial, forged ownership, cross-company reads, enumeration, role changes, inactive membership, unknown collections, and disabled business writes. Auth browser tests cover verification, actual empty Firestore collections (one owner employee), unchanged legacy bytes, persisted sessions, login/logout, duplicate emails, password reset, resumed setup, membership revocation, and offline emulator fail-closed behavior. These tests use isolated browser contexts; they do not back up the user's browser data.

Remaining production work: provider setup, production email templates/action URLs, password policy and abuse/rate controls, App Check strategy, security review, scoped business repositories, role policy, trusted administration/audit commands, deployment approval, and cloud backup/recovery. The local tests are not evidence of currently deployed production rules. Future server SDKs bypass Rules and require their own authorization.

See [Firebase atomic rules validation](https://firebase.google.com/docs/firestore/security/rules-conditions) and [Auth emulator behavior](https://firebase.google.com/docs/emulator-suite/connect_auth).

Phase 3A now enables Customers and Properties; see [current implementation](firebase-phase-3a.md). Other business modules remain read-only.
