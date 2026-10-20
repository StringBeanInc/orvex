# ORVEX small-cohort beta launch — October 17, 2026

Target: existing `stringbeaninc/orvex`, project `prj_tjmJ8WTlCJLYjqjaqzGXFmIsVIf9`, https://orvex-iota.vercel.app/. Firebase: `orvex-2f496`. Branch: `firebase-preparation`. No deployment or live write was performed.

## Ready in source

- Landing/account routes and SPA rewrite; hosted Enterprise App Check client supports the exact production and branch Preview domains.
- Explicit hosted-beta project/environment validation; emulator settings remain separate, with no fallback to cloud when emulators fail.
- Operational employee/membership/invitation, assignment and work-order Functions have the explicit hosted path, require a verified App Check context and retain trusted transaction/membership/permission authorization. Other runtime paths remain emulator-only.
- `firestore.beta.rules` adds verified-email, enabled, unexpired platform enrollment grants to the existing atomic Owner bootstrap. Clients cannot create enrollment grants or membership roles. Existing users can sign in without an enrollment grant. The independent global signup gate remains required.
- New `firebase.beta.json` selects beta rules and current indexes without changing the local emulator configuration.
- Hosted navigation now offers only Dashboard, Customers, Properties, Employees, Work Orders and Assigned Jobs, subject to existing permissions. Pricing editing, accounting, QuickBooks, API/webhooks, dispatch and timekeeping are not offered in hosted mode. Their unfinished backend paths remain emulator-only; do not deploy them.
- Business records are in Firestore under `organizations/{companyId}`, separate from browser-local records. Vercel frontend deployments do not recreate/seed/delete these collections. Keep the same Firebase project, database, IDs and namespace in future releases; schema changes require separate backward-compatible review and backups. Frontend rollback does not restore data.

## Exact tests this run

- Default production build and explicit `VITE_FIREBASE_MODE=hosted-beta` production build: passed (TypeScript and backend syntax checks included). Vite warns about a chunk >500 kB.
- Focused baseline security/directory/work-order/employee/runtime/enrollment run: **54 passed, 1 failed** of 55. Failure: unverified-invitee test encountered `fetch ECONNRESET` in synthetic Auth setup. Targeted rerun: **1 passed, 0 failed**. This was not a permission assertion failure.
- Customer/property and work-order tests explicitly using **beta rules**: **13 passed, 0 failed**. This includes persistence reads, concurrency, reference validation and tenant isolation. Baseline run also included 4 enrollment and 6 hosted-runtime tests.
- No real hosted registration, email, App Check token, function invocation or restore drill has yet been verified. Existing browser tests were not rerun this turn. Local rules tests used isolated synthetic projects/fixtures; original data and checkpoint were not used, imported or reset.

## Remaining launch blockers, in order

1. **Billing approval:** Functions cannot be deployed on Spark; approve Blaze for `orvex-2f496`. Usage, build artifacts, backups, networking and logs may incur charges even with no-cost allowances. No guaranteed monthly total is possible without actual usage. Configure a budget (suggested alerts at $5/$10/$20, approved by owner), instance quotas and a named operator; alerts are not a hard spending cap. [Firebase pricing](https://firebase.google.com/pricing).
2. **Review cloud configuration:** confirm the Firebase web app configuration, runtime IAM and project ownership. Zero Auth users does not prove there are no Firestore records; do not inspect/delete/import original business data. Authorize the production and stable Preview hostnames in Auth and Enterprise/App Check configuration. Ensure verification and reset action URLs lead to valid Firebase handlers and authorized continue URLs. No broad wildcard domains or App Check debug token on hosted services.
3. **Variables:** Preview settings alone do not configure Production. In the existing Vercel project's Production scope, prepare `VITE_FIREBASE_MODE=hosted-beta`, `VITE_FIREBASE_PROJECT_ID=orvex-2f496`, `VITE_FIREBASE_AUTH_DOMAIN=orvex-2f496.firebaseapp.com`, plus its actual `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_APPCHECK_SITE_KEY`. Keep `VITE_ENABLE_PUBLIC_SIGNUP=false` until the restricted enrollment/rules gate is validated. These are client-visible identifiers, not Admin credentials. Never add private keys or service-account JSON to Vercel frontend variables.
4. **Backend runtime:** the selected deployed functions need `ORVEX_RUNTIME_MODE=hosted-beta`. Copy the checked-in example into an ignored per-project Functions environment file only after approval. No emulator host variables in hosted settings. Use Node 22 as declared by the Functions package.
5. **Enrollment, separate approval for live writes:** provision `betaEnrollment/{lowercaseApprovedEmail}` documents, each with `enabled: true` and Firestore Timestamp `expiresAt`. Set `platformConfig/publicSignup.enabled=true` only after the beta rules are published and verified. Then the client flag may be set true for this restricted beta. Grant expiry blocks new company creation, not existing sign-in. One email/UID can bootstrap one initial company; the existing user link prevents duplicates. This does not enable unrestricted company creation. Raw Firebase Auth identities may still be registered directly: rules block company access, not Auth signup. If blocking even unused Auth identities is required, approve Identity Platform/Auth blocking-function work separately; do not claim that the current grant implements that.
6. **Invitations:** single-use, expiring, verified-email-bound acceptance is implemented and tested locally. Invitation emails are **not automatically sent**. Minimum cohort launch: Owner privately emails the generated invitation link using their normal email service. Firebase sends verification/reset emails after hosted Auth configuration is verified. An automated transactional email provider and sender-domain verification are an additional approval/integration; not required to manually invite a few testers. Never log invitation tokens or post them publicly. Existing `no-referrer` response header protects activation link referrers.
7. **Before business data:** configure daily Firestore backups, approved retention (proposed 30 days), backup-failure alerts, and rehearse recovery into an isolated database; never overwrite the live database. Auth identity recovery is separate and highly restricted. Preserve source/rules/index/release versions and audit records. Object backups are needed only if uploads are later enabled; no application Storage bucket is required for this cohort workflow. Set error/latency, permission-denial, signup/invite volume and spend alerts with an operator. Monitor App Check and authorization failures. Review quotas/rate limits; App Check and an enrollment list do not eliminate abuse. Existing backup design: `docs/firebase-backup-recovery.md`.
8. **Release/test approval:** review dirty files and commit scope, confirm Vercel's connected Git deployment branch and prevent an accidental automatic production release. Approve targeted Firebase deployment, protected Preview release, and creation of two synthetic hosted companies/users. Verify real email, App Check, Owner creation, fresh workspace, customer/property saves and refresh, technician invitation/activation, assignment/access, cross-tenant denials and unavailable integrations. No hosted acceptance test can be certified from emulator results.
9. **Promotion:** only after those checks approve the existing Production URL deployment. Keep enrollment restricted. The existing emulator banner has deliberately not been relabeled as verified hosted service; contextual hosted wording should be finalized after hosted verification, before inviting testers. No new Vercel project is needed.

## Commands prepared — approval required, not executed

Run from the repository root in PowerShell. Do not run a generic `firebase deploy` or deploy all Functions. Explicit `--project`/`--config` prevents accidental target selection. Cancel any CLI prompt proposing function deletion or unreviewed changes; never use `--force`.

```powershell
git branch --show-current
git status --short
npm run build
node scripts/prepare-beta-rules.mjs
# Only after runtime/billing/deployment approval; this contains no secret.
if (Test-Path -LiteralPath functions/.env.orvex-2f496) { throw 'Existing runtime configuration requires review; do not overwrite.' }
Copy-Item -LiteralPath functions/.env.orvex-2f496.example -Destination functions/.env.orvex-2f496 -ErrorAction Stop
firebase deploy --project orvex-2f496 --config firebase.beta.json --only "firestore:rules,firestore:indexes"
firebase deploy --project orvex-2f496 --config firebase.beta.json --only "functions:companyMemberships,functions:employeeView,functions:employeeCommand,functions:employeeInvitationInfo,functions:employeeAssignments,functions:saveCompanyWorkOrder,functions:technicianJobs,functions:technicianJobUpdate,functions:workOrderServiceReports"
```

Before copying the runtime file, ensure the destination does not already exist; preserve/review any existing file instead of overwriting it. Do not copy over a configured environment file. Authentication domains, grants, signup gate, App Check configuration, budgets and backups require separately approved console actions; these commands do not configure them.

Vercel CLI alternative after release approval and Production variables are set (requires normal CLI authentication). Link the **existing** project and confirm its project ID; cancel if the CLI proposes creation. Preview deployment must be tested before the production commands below. A generated one-off Preview URL is intentionally rejected by the hostname allowlist: use the configured stable branch Preview alias, not an arbitrary hostname.

```powershell
vercel link --project orvex --scope stringbeaninc
vercel pull --yes --environment=preview --git-branch=firebase-preparation --scope stringbeaninc
vercel build
vercel deploy --prebuilt --scope stringbeaninc
# AFTER protected Preview acceptance and explicit promotion approval:
vercel pull --yes --environment=production --scope stringbeaninc
vercel build --prod
vercel deploy --prebuilt --prod --scope stringbeaninc
```

Confirm the Preview deployment has the stable allowed branch alias before testing; if the CLI does not attach it, an approved alias action or the existing Git Preview workflow is required. Do not claim a Preview URL is accepted just because upload succeeds. Alternatively, an approved push to `firebase-preparation` can trigger the existing Git Preview pipeline after branch settings are verified. No push/commit was performed here. [Firebase deploy selection](https://firebase.google.com/docs/cli), [Functions environment files](https://firebase.google.com/docs/functions/config-env).

## Files changed for this launch pass

`src/auth/CompanyWorkspace.tsx`, `.gitignore`, `emulator-tests/directory-rules.test.mjs`, `emulator-tests/work-orders-rules.test.mjs`; added `firebase.beta.json`, `functions/.env.orvex-2f496.example`, and this report. Existing `src/firebase.ts`, beta rules, runtime and routing preparation were preserved. New examples contain no credentials. No original records, checkpoint, emulator startup/reset/import settings, billing, live rules, Git commit/push or deployment were changed.

**Exact next approval:** approve Blaze/billing with a budget and narrowly scoped hosted beta configuration/deployment, plus synthetic hosted acceptance testing. Do not approve unrestricted signup or real-data intake yet. Real company data begins only after the recovery and tenant-isolation gates pass.
