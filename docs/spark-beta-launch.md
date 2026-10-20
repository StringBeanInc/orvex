# Strict $0 Spark beta — October 17, 2026

This replaces the Blaze deployment plan **for the reduced Spark cohort only**. No deployment, billing change, live write, data migration/reset or checkpoint change occurred. Existing emulator workflows remain available.

## Functions dependency audit and outcome

| Workflow | Dependency before / Spark result |
|---|---|
| Registration, email verification/reset, login, atomic initial Owner | Firebase Auth + Firestore already; restricted enrollment rules retained, no Functions needed |
| Company discovery/switching | `companyMemberships` callable replaced by rule-authorized own user links and live membership checks |
| Customers/properties | Already direct Firestore; unchanged validation, relationships, revision checks and soft-delete rules |
| Work-order list/assignment candidates | `employeeAssignments` replaced by existing Owner-authorized employee reads; no new employee read permission |
| Work-order creation/edit/history | `saveCompanyWorkOrder` replaced by atomic client transaction; existing rules validate actor/company, references, numbering, property counts, immutable activity and revisions |
| Employee invitations, activation, role/status changes | `employeeCommand`, `employeeInvitationInfo`, `employeeView`; **disabled**, not reimplemented with weaker client permissions |
| Technician assigned-job access/updates | `technicianJobs`, `technicianJobUpdate`, reports; **disabled**; raw work orders contain private fields, so broad technician read access is not a safe substitute |
| Pricing commands, financials, labor/GPS/timekeeping, dispatch, QuickBooks/accounting, API/webhooks | Functions-dependent and/or incomplete; **disabled in hosted Spark UI**; emulator implementation preserved |

Hosted mode defaults to Firestore-only unless the explicit backend value is `functions`. Set `VITE_FIREBASE_BACKEND=firestore` for this release. The callable accessor fails closed in Spark mode. Only company discovery and employee assignment reads have direct replacements; all other `employeeApi` commands reject before a network call. New companies have only their Owner employee. Assignments can reference existing valid same-company employees, but this reduced release cannot add employees or onboard technicians. Do not manually loosen membership rules to work around this.

Company records persist under the same Firebase project/default database/`organizations/{companyId}` namespace. Deployments do not seed, clear or migrate them. Future schema changes require their own reviewed plan. Cloud persistence is not equivalent to a backup.

## Tests and changes

- Hosted Spark `npm run build`: passed including TypeScript/backend syntax checks; existing >500 kB chunk warning.
- **23/23** enrollment, hosted runtime, customer/property and work-order tests passed. Work-order positive/concurrent/stale/reference tests now exercise the actual application's new transaction implementation against beta rules, rather than a duplicate test-only implementation.
- Additional bootstrap/isolation/security suite: **8/8 passed**. No real hosted tests were executed.
- No Firestore rule permissions were relaxed. No Cloud Functions were deployed or invoked against hosted services. Tests used isolated synthetic emulator data; no originals were used or reset.
- Changed: `src/firebase.ts`, `src/company/CompanyEmployees.tsx`, `src/company/workOrderRepository.ts`, `src/auth/CompanyWorkspace.tsx`, `emulator-tests/work-orders-rules.test.mjs`, `.env.beta.example`. Added: `src/company/sparkRepository.ts`, `src/company/firestoreWorkOrder.ts`, `firebase.spark.json`, this report.

## Remaining steps (approval required before live changes)

1. **Resolve hosting eligibility first.** Vercel Hobby is restricted to non-commercial personal use. A business SaaS beta is not automatically eligible just because testers pay nothing. Obtain Vercel confirmation for the intended use or approve evaluating a suitable free hosting alternative. Do not upgrade or create another project. The exact Vercel URL cannot be promised as a compliant $0 commercial launch. [Vercel fair use](https://vercel.com/docs/limits/fair-use-guidelines).
2. **Approve the reduced Owner-only cohort.** Approve applying the unchanged beta enrollment rules/indexes, Auth authorized domains/action URLs, and existing App Check configuration to the selected project. Keep Spark/no linked paid services; monitor Firebase/Auth/reCAPTCHA quotas. Set the existing Firebase web identifiers in Vercel Production as well as Preview: mode `hosted-beta`, backend `firestore`, project `orvex-2f496`, Auth domain `orvex-2f496.firebaseapp.com`, actual API key/app ID/Enterprise site key. No private keys. No emulator hosts or Functions runtime settings.
3. **Approve restricted registration and release.** Publish beta rules first. Then approve platform-managed `betaEnrollment/{lowercaseEmail}` grants (`enabled:true`, timestamp `expiresAt`) and `platformConfig/publicSignup.enabled=true`. Enable the client signup flag only after rules validation. No unapproved email can create a company; Auth identity creation itself is not blocked by Firestore rules. Approve a specific commit/push or deployment and two synthetic hosted Owner tests before inviting the cohort. No employees/technician testing is promised.

Commands prepared, **not executed**:

```powershell
node scripts/prepare-beta-rules.mjs
npm run build
# Only after explicit rules/index deployment approval:
firebase deploy --project orvex-2f496 --config firebase.spark.json --only "firestore:rules,firestore:indexes"
# Only after Vercel eligibility, configuration and deployment approval:
vercel link --project orvex --scope stringbeaninc
vercel pull --yes --environment=production --scope stringbeaninc
vercel build --prod
vercel deploy --prebuilt --prod --scope stringbeaninc
```

Confirm the existing Vercel project ID before upload; cancel any project-creation or resource-deletion prompt. Do not run the earlier Blaze/Functions deploy commands. Use a protected stable branch Preview for acceptance first (the app permits only its configured stable Preview domain and production domain). Keep the signup flag false until the grant/rules gate is ready. Do not replace emulator wording with a claim of verified hosted operation until real service tests pass.

## Free-tier limits and recovery gap

Firestore free quota is 1 GiB stored, 50,000 reads/day, 20,000 writes/day, 20,000 deletes/day and 10 GiB outbound/month, shared by all companies. Transactions, membership checks, history and indexes consume quota; service may be unavailable when limits are reached. Auth email sending and reCAPTCHA/App Check also have quotas; keep the cohort small and monitor usage. Never enable automatic paid overages. [Firestore limits](https://firebase.google.com/docs/firestore/quotas), [App Check Enterprise configuration](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider).

Managed backup/PITR/restore operations require billing and are **not part of this release**. Existing browser-local backups do not back up cloud company records. A verified no-cost cloud logical export/restore process is still missing; do not accept irreplaceable business records under a claim of disaster recovery. Use disposable beta data until that gap is resolved. No paid backup, Cloud Storage, email extension, transactional email provider or Functions service was introduced. Existing direct record revision checks/audit events remain protections against accidental changes, not a disaster backup.

**Next decision:** accept the reduced Owner-only scope and resolve Vercel Hobby eligibility. Full employee/technician functionality is not ready under this $0 implementation; it needs a separately designed and tested no-cost trusted alternative or a future revised budget. No payment approval is requested.
