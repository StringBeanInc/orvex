# ORVEX — public landing and company registration

Implemented on `firebase-preparation`. Existing uncommitted Phases 3C–3J work is preserved. Local Firebase emulators and synthetic records only; no production access, import, migration, reset, push or deployment.

## Routes and pages

No earlier standalone welcome/landing component was found. `main.tsx` previously rendered the browser-local `App` at every non-account path. A new minimal branded landing is connected at `/`, without replacing the company dashboard or authentication system.

| Route | Result |
|---|---|
| `/` | Public ORVEX welcome page, original logo, Create Company Account and Sign In actions; remains public even for signed-in visitors |
| `/account?mode=register` | Existing account flow in registration mode, subject to both local UI configuration and the server gate |
| `/account?mode=login` | Explicit existing sign-in screen |
| `/account` | Existing sign-in/setup/company workspace behavior; verified active membership remains mandatory |
| `/account?company=…` | Existing validated company selection |
| `/account?inviteCompany=…&inviteId=…&inviteToken=…` | Existing single-use employee invitation activation |
| `/local` and `/local/…` | Preserved browser-local dashboard, documents, backup/recovery, recycle bin and business modules |

Unknown non-account paths show the welcome page. Company modules retain in-memory navigation; no implemented company module route was removed. The account logo returns home, while recovery links explicitly use `/local`. LocalStorage is origin-scoped, so moving its interface from `/` to `/local` does not copy, import, rename or erase its saved keys. Existing local business data is never loaded into a new company.

The landing checks only the existing Firebase Auth session to offer Open Workspace. It does not fetch company business records or automatically redirect signed-in visitors. Clicking an account/workspace link invokes the existing membership checks. Login, logout, password reset, verification, invitation activation and company switching remain the existing implementations.

## Registration architecture and security

Self-registration already existed and was intentionally gated. It uses Firebase email/password Authentication and email verification, followed by a Firestore atomic batch creating exactly one company, the user's home-company pointer, their Owner membership and initial Owner employee profile. No second authentication system or new paid/backend service was added.

The existing Firestore `bootstrap` design enforces ownership on the server:

- Verified Firebase authentication and the server signup gate are required.
- The company, initial membership, employee and user pointer must not already exist.
- All linked records must be present in the same atomic operation.
- The initial Owner UID must be the authenticated UID; membership and employee fields are independently constrained.
- A client cannot claim an existing company, create a standalone Owner membership, alter roles directly or create another home company by resubmitting.
- Concurrent submissions serialize at the user-pointer precondition: one succeeds, one is denied. The existing client recovery reads the committed company rather than creating a replacement.
- Employee/technician membership is still created through the trusted invitation service, with live membership/role validation, immutable history and last-Owner protections.

The signup UI is now enabled by default only in local Vite development, with `VITE_ENABLE_PUBLIC_SIGNUP=false` remaining an explicit kill switch. The independent Firestore server gate remains authoritative. Neither URL changes nor a client flag grants company ownership. Production company services and registration remain disabled by the existing runtime guard; nothing was deployed or enabled in production.

Only `demo-orvex-phase3c-tests` has been opened for registration using the explicit, fixed-target `scripts/local-registration-gate.mjs`. The original/default emulator project and its gate were not inspected or changed. The working registration preview is **http://127.0.0.1:5180/**. A separately running frontend must target that synthetic project and have its own UI flag enabled to use the same flow; do not silently switch an existing account's project.

Firebase's client signup API can still create an Auth identity when a company gate is closed. The gate controls company/bootstrap authority, not the underlying Firebase email/password identity endpoint. Production-wide identity signup restriction would require separate Auth controls; no such production change is part of this work.

## Collected details and timezone behavior

The form collects company name, Owner name, business email, password and confirmation, optional phone and company timezone. Email/password use Firebase Auth; passwords are never saved in company records, custom local storage or business backups. Name/phone/timezone inputs are validated before Auth creation and again before company bootstrap. Firestore independently checks company metadata, including a finite supported IANA timezone list and bounded phone format with a digit requirement. Existing bootstrap payloads without the new optional fields remain valid.

Company records gain optional `phone` and `timeZone` fields on creation only. Existing records are not updated or migrated. The company timezone provides the default for new-company Timekeeping and Dispatch when no explicit time policy exists. An explicit historical policy always takes precedence. Legacy companies without this field continue using the prior America/Chicago default. No radius, GPS verification, overtime, labor cost, billing calculation or historical snapshot was changed.

Supported timezone choices cover UTC and selected Americas, Europe, Africa, Asia and Pacific zones. This is a finite initial list, not every IANA zone. Extending it requires matching UI/server validation. Company profile editing is not added here; existing authorized Timekeeping policy controls remain available.

Email verification remains required before company creation. Failed registration retains form fields and displays errors; retry probes local services again. If Auth creation succeeds but verification/company setup is interrupted, the user can sign in and finish setup. Draft company details are held in memory and must be re-entered after a full page reload; passwords are never persisted by a custom draft mechanism. Existing committed companies are recovered rather than duplicated.

## Employees and technician workflow

Owners continue using Employees to create invitations, select Technician/Administrator roles, manage employee status and explicitly grant permissions. A copied, single-use invitation is activated only by the intended verified email. Technicians then use the normal Sign In page and see only authorized self modules and assigned work. No automatic financial permission was added. Legacy Admin and internal-cost boundaries are unchanged.

Invitation delivery is manual in this emulator foundation: the UI provides a copyable link and explicitly states that no email was sent. Verification/reset email links are available through the Auth emulator rather than a real mail service. Production mail delivery, anti-abuse controls and Auth password policy setup remain separate production tasks.

## End-to-end verification

The new browser workflow performs real UI registration for two independently named synthetic companies using the same business email domain. It verifies the Owner email using the emulator's verification-code mechanism, completes the atomic bootstrap, confirms phone/timezone and Owner membership, and proves repeated setup resolves to the same company.

It then signs the Owner out and back in through normal Sign In; creates a Technician invitation in Employees; creates and verifies the invited account; accepts the invitation; signs the Technician out and back in normally; creates a customer, linked property and assigned work order through the Owner UI; verifies that the Technician sees that assignment without financial navigation; and proves a second company's server and repository requests cannot access the first company's records. The new timezone is also verified through the existing trusted timekeeping view.

Separate tests cover landing routes, mobile overflow, signed-in landing behavior, empty-company bootstrap, malformed metadata, concurrent duplicate submissions, closed-gate denial and registration failure/recovery state. Existing Phase 3C–3J workflows are rerun rather than replaced.

## Changed files in this work

Added:
- `src/LandingPage.tsx`, `src/landing.css` — public welcome page and responsive branding.
- `src/auth/companyOnboarding.ts` — bounded field validation and supported timezone options.
- `scripts/local-registration-gate.mjs` — explicit enable/disable of only the disposable synthetic project's signup gate.
- `scripts/reconnect-isolated-firestore.mjs` — reconnect the existing synthetic work-order trigger after split emulator startup without a Firestore restart or import.
- `emulator-tests/landing.spec.ts`, `emulator-tests/landing.config.ts`, `emulator-tests/onboarding.test.mjs`.
- `docs/landing-registration.md`, `docs/landing-registration-local-testing.md`.

Updated:
- `src/main.tsx` — public root and preserved `/local` route.
- `src/features.ts`, `.env.example` — local-development registration defaults and explicit off switch.
- `src/auth/AccountPage.tsx` — explicit login mode, onboarding fields/validation and `/local` recovery link.
- `src/auth/company.ts` — reuse atomic creation, persist validated new-company metadata, preserve committed-company recovery.
- `src/auth/CompanyWorkspace.tsx` — separate local recovery link updated to `/local`.
- `firestore.rules` — bounded optional company metadata and nonblank-name validation; existing ownership, tenant, role and bootstrap conditions remain enforced.
- `functions/timekeeping.mjs`, `functions/dispatch.mjs` — new-company timezone default only; explicit policies and legacy defaults preserved.
- `tests/app.spec.ts`, `tests/company-workspace.spec.ts`, `tests/documents.spec.ts`, `tests/security.spec.ts`, `audit/storage-audit.spec.ts` — existing local tests follow `/local` with original assertions.
- `emulator-tests/auth.spec.ts`, `emulator-tests/directory.spec.ts`, `emulator-tests/signup-disabled.spec.ts` — local legacy-data setup follows `/local`.
- `emulator-tests/workspace-ui.spec.ts` — recovery-link expectation follows `/local`.

All earlier changes remain preserved. No dependency was added and no dependency manifest was changed in this work. Existing generated preview PNGs are restored to their pre-task bytes after tests.

## Local service condition and safeguards

At validation time, Firestore was running on 8280 but Auth 9299 and Functions 5301 were absent. The running Firestore process was not stopped or reset. Only the missing synthetic Auth/Functions services were started, using an empty workspace-local CLI configuration rather than saved Firebase login credentials. No original users were reconstructed and no checkpoint was imported.

Split-service startup skipped the automatic Firestore trigger attachment. The installed Firebase CLI's local v2 registration protocol was used to reconnect exactly the existing synthetic `integrationWorkOrderEvents` trigger. Its API/webhook browser and backend regressions then passed. The helper is fixed to loopback, the disposable project and the existing work-order trigger; it is not a production deployment mechanism or a data migration.

The October 12 checkpoint remains unchanged (six files, 20 archived Auth users, SHA-256 `8f36515546b333cc8b022bc0afb95896d83fefeca1a03ea154ceab50ce47ccf5`). Original company data remains unverified and was not accessed or modified. No production connection, push, deploy, import, migration or reset occurred. Only fresh synthetic fixtures and the synthetic platform signup/trigger configuration were written.

See `landing-registration-local-testing.md` for exact commands, validation counts and screenshots. Stop here for visual review; no further phase or deployment is started.

The explicitly disabled UI flag also hides Create Company Account on the public landing, retaining Sign In and a closed-registration notice. The requested enabled local preview shows both primary actions.
