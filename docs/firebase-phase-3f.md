# Phase 3F — Employees, roles and permissions

Implemented locally on October 15, 2026, on `firebase-preparation`, following approval of the authorization design. **Emulator-only; not production-enabled.** No import, migration, reset, push or deployment occurred.

## What is implemented

- Employee directory, search, profiles, phone/job-title editing, and active/suspended/deactivated employment. Invited people appear separately under pending invitations until activation; an invitation does not itself grant membership.
- Owner/Administrator invitations, copyable local activation links, invitation-specific account creation/sign-in, verified-email acceptance, expiry and revocation. No real invitation email is sent.
- Five roles: Owner, Administrator, Manager, Office Staff and Technician. Existing legacy `Admin` retains timekeeping administration, including its prior internal cost/GPS review, and gains no financial access.
- Owner-only explicit permission grants, separate internal-cost access, employee-management delegation limits, company switching, immutable membership events, revision checks and idempotent commands.
- Safe suspension/reactivation and deactivation without deleting the Firebase Auth identity or historical records. An active clock session must be closed/reviewed first. Last-active-Owner protection applies to suspension, deactivation and demotion; concurrent removals serialize safely.
- Existing operational modules are reused. Managers can create/edit/schedule work orders and assign active company employees. Office Staff can maintain customers/properties and read operational jobs; further workflows require explicit grants.
- Technician assigned-job projections, narrowly controlled status updates and append-only service reports. Operational managers can read reports from work-order details. No customer pricing, internal notes or labor costs are included in the assigned-job response.
- Existing dashboard shell, logo, navigation icons, sidebar expansion/collapse and mobile administration are retained. Technicians reopen on their existing time clock. A restored membership can recover in an already-open tab after a fresh server membership check.

## Permission contract

`src/company/permissions.ts` is the finite policy registry, compiled into the backend by the existing shared-model build. `functions/authorization.mjs` supplies transactional authorization for the pricing, timekeeping, financial and employee/job functions.

Every sensitive callable requires verified Firebase authentication and a live active membership whose document UID/company ID match the requested company path. The requested company ID selects scope; it is never proof of authority. Company root existence/identity and permissions are checked inside the same transaction as the operation. No browser role, email domain, discovery pointer or global default-company link grants authority.

| Role | Default permissions | Financial/internal costs |
| --- | --- | --- |
| Owner | Full company administration | Full access |
| Administrator | Operational directory/work orders, ordinary employee management, time review/configuration | Only explicit Owner grants; no default financial or cost access |
| Manager | Operational directory reads, work-order editing/assignment/scheduling, own time | Time review or financial/cost access only when explicitly Owner-granted |
| Office Staff | Directory maintenance and operational work-order reads | Explicit Owner grants required |
| Technician | Own time and sanitized assigned-job operations | Explicit Owner grants required for any broader role capabilities |
| Legacy Admin | Existing timekeeping administration, internal time-cost/GPS access | No new financial/catalog authority; explicitly change role to Administrator before configuring broader new permissions |

New Administrator/Manager/Office Staff memberships require `permissionSchema: 1`. A legacy record containing one of those formerly unsupported role labels does not silently acquire the new defaults. Owner and Technician legacy records remain compatible. Unknown roles/permission keys are rejected; unsupported grant versions do not enable grants.

Only Owners may assign Owner/Administrator roles or explicit permissions. Administrators may invite/manage ordinary Manager, Office Staff and Technician employees, but cannot manage protected peers, grant finance, or delegate their own explicit grants. Self-role/grant changes are rejected. React controls are supplementary: backend operations and server rules enforce the policy.

Financial permissions separate document read/edit/issue/approve, estimate conversion, invoice payment and unpaid void operations. Estimate conversion also requires work-order write authority. Financial grants do not grant internal labor cost, employee compensation or profitability access. The latter two have no new storage/editor/export endpoint in this phase; unexpected compensation fields on legacy employee records are excluded from employee/assignment projections. No compensation or profitability collection was enabled.

## Existing phase integration and privacy

- **Phase 3C:** Catalog reads/writes require both pricing management and separate cost access because the existing catalog includes costs. All prior shape, code reservation, revision, money, relationship and audit guards remain. The trusted pricing-save function applies the same pair of permissions and preserves the financial-scope lock.
- **Phase 3D:** Self-time and authorized review remain separate. Managers with time-review grants receive hours/approvals without rate snapshots or calculated costs. Cost-bearing rates require separate cost permission. Configuration, retained GPS reads and cost-profile assignment have additional checks. Legacy Admin behavior is preserved. Original server times, meals, corrections, rate snapshots and event history are retained.
- **Phase 3E:** `financialCommand`/`financialView` in `functions/financial.mjs`, the React financial module, shared financial model and PDF generator remain the application implementation. Financial views redact catalog internal/purchase costs, markup and supplier unless separately authorized. A new trusted financial work-order-scope endpoint supplies billable charges without granting raw catalog/internal-cost access. Direct financial writes remain denied, including Owner writes; delegated financial reads use the backend instead of widening raw Firestore reads.
- Raw employee documents are now Owner-only to prevent future compensation/profile fields leaking through assignment lists. Work-order assignment uses the new backend name/ID/role projection. Assignment rules also verify live active membership at commit. This tightens raw access; legacy timekeeping uses its existing sanitized backend projection.
- Directory/work-order rules recognize the approved versioned operational roles while preserving existing record/relationship/numbering/revision/audit validation. Manager property writes are limited to the linked work-order count bookkeeping fields, not general property editing. No business-record validation was removed to enable roles.

## Invitation and membership storage

All state is under the existing `organizations/{companyId}` namespace:

```text
members/{uid}                         authoritative membership, role, status, grants, revision
employees/{uid}                       employee profile and assignment availability
employeeInvitations/{invitationId}    private token hash, intended email/role/grants, expiry and status
invitationEmails/{emailHash}          concurrent pending-invitation reservation
membershipGuards/main                 serializes membership/invitation transactions
membershipOperations/{operationId}    caller-bound idempotency fingerprint/result
membershipEvents/{eventId}            immutable actor/time/reason and membership history
jobOperations/{operationId}           caller-bound service-update idempotency
workOrders/{id}/serviceReports/{id}   immutable technician service notes
users/{uid}/companyMemberships/{cid}   backend-managed discovery pointer
```

Invitations use a random 256-bit token; only its SHA-256 hash is stored. The raw value is returned once for copying the local link, never stored in readable operation results or audit events. Repeating an uncertain invitation request returns its committed ID, not the lost token: revoke/reissue if the first response/link was lost. Exact normalized email and verified Auth identity are required at acceptance. The backend rechecks issuing authority, expiry, status and company, then consumes the invitation and creates membership/profile/discovery state atomically. Duplicate memberships are rejected rather than overwritten.

Employee changes use expected revisions and a shared transaction guard, including legacy memberships with initial revision zero. Owner membership queries and guard writes prevent two concurrent actions from removing every Owner. The original company `ownerUid` remains historical bootstrap metadata; it is not treated as current sole-owner authority. Memberships, invitations, counters/guards, discovery pointers, operation records and audit history cannot be written directly by clients.

`users/{uid}.companyId` is preserved as the default company. Joining another company never overwrites it. Discovery combines the default link with new pointers and validates each live membership. Company selection is reflected in the URL and revalidated after refresh. When the default membership is inactive, the account recovery screen lists other live memberships and revalidates the chosen company before opening it. Switching companies unmounts previous business views/editors/subscriptions and discards their pending UI state. It does not move records or change their ownership.

## Preservation

Existing business documents, pricing/time/financial snapshots, local storage, templates, backup/recovery tools and previous uncommitted work were preserved. Tests used random synthetic companies and disposable browsers on the complete existing Phase 3C isolated group. No original company/account was reconstructed. The temporary isolated auth-test frontend was stopped and its synthetic server signup gate closed afterward.

The October 12 checkpoint remains six files / 20 Auth users, with manifest SHA-256:

`8f36515546b333cc8b022bc0afb95896d83fefeca1a03ea154ceab50ce47ccf5`

Its integrity does not verify the current original company. **Original company data remains unverified.** No claim is made that another browser's localStorage was backed up. Generated test screenshot fixtures were restored to their clean pre-test contents.

## Validation

See `phase3f-local-testing.md` for exact suite results and commands. TypeScript compilation and production build passed. Root and Functions npm audits each report zero vulnerabilities. The existing nonblocking Vite large-chunk warning remains. Initial browser failures exposed a technician landing-page regression, legacy role compatibility/recovery, and ambiguous test/select labels; these were corrected and the affected suites rerun. No test expectation was loosened to permit unauthorized access.

## Changed-file report for this phase

Earlier uncommitted files remain uncommitted. The following 31 files were added or edited by Phase 3F; this list does not claim earlier changes in those files originated here.

| Area | Files |
| --- | --- |
| Policy/backend | `src/company/permissions.ts`, `functions/authorization.mjs`, `functions/employees.mjs`, `functions/technicianJobs.mjs`, `functions/index.mjs`, `functions/timekeeping.mjs`, `functions/financial.mjs`, `firestore.rules` |
| Authentication/workspace | `src/auth/company.ts`, `src/auth/AccountPage.tsx`, `src/auth/CompanyWorkspace.tsx`, `src/auth/CompanyChoice.tsx`, `src/auth/InvitationActivation.tsx` |
| Employee/job UI | `src/company/CompanyEmployees.tsx`, `src/company/employees.css`, `src/company/CompanyAssignedJobs.tsx`, `src/company/WorkOrderServiceReports.tsx` |
| Existing module integration | `src/company/CompanyDirectory.tsx`, `src/company/CompanyWorkOrders.tsx`, `src/company/CompanyFinancials.tsx`, `src/company/CompanyTimekeeping.tsx`, `src/company/directoryRepository.ts`, `src/company/workOrderRepository.ts` |
| Build/test tooling | `package.json`, `scripts/build-pricing-backend.mjs`, `emulator-tests/employee-fixtures.mjs`, `emulator-tests/employees.test.mjs`, `emulator-tests/employees.spec.ts`, `emulator-tests/employees.config.ts` |
| Documentation | `docs/firebase-phase-3f.md`, `docs/phase3f-local-testing.md` |

Generated backend shared JavaScript and test outputs remain ignored. No dependency, lockfile, production Firebase setting, new cloud service or billing configuration was changed.

## Limitations and production blockers

- Production access remains deliberately blocked by exact project/loopback/emulator runtime checks and the frontend development guard. Do not remove these to test a real project.
- Firebase email/password identity creation cannot be globally blocked by a Vite flag or Firestore rules. A direct Auth signup can create an identity, but grants no company membership. Invitation validation and verified email protect activation. Production abuse controls/Auth signup restrictions need a separately approved design; no Identity Platform service/billing change was made.
- No real invitation email delivery, public company registration, platform administration, company closure, employee deletion, payroll, compensation editor or profitability reporting was added. Public company signup remains disabled outside the temporary synthetic auth regression.
- Invitation tokens are local bearer links; protect copied links/browser history. No production secret delivery, automated account cleanup or invitation rate limiting is claimed. Lost raw links require revoke/reissue. Invitation acceptance that creates Auth but fails membership leaves an identity with no company access.
- Existing time review remains independent: a sole Owner cannot approve their own overtime/correction request. Active time sessions must be closed/reviewed before deactivation. Existing historical assignments are retained and may require explicit reassignment.
- Employee discovery/list/history endpoints fail closed beyond 500 records; production pagination is not implemented. The prior time/financial reporting limits remain. UI lists are not claimed to be live reports; refresh after other administrators' edits. Membership revocation is observed live, but server checks are authoritative.
- Production still requires reviewed IAM and deployment policy, recent-auth/revocation policy, App Check and request/abuse limits, secure invitation delivery, monitoring, privacy/retention and labor-compliance review, backup/restore verification, and staging validation. No import or migration of original records is authorized by these docs.
