# ORVEX security and recovery test plan

Production rollout is gated on executable security tests and an isolated restore drill. The three completed local audit probes demonstrate current hazards; they do not validate Firebase security. No Firestore or Storage rules, backend membership checks, login flows, or managed recovery controls have been tested yet.

Local implementation update: the three audit probes now require preservation/recovery and pass as regressions. Sixteen additional local security tests cover stale writes, failed/empty loads, sample protection, soft restore, complete backup hashes and credential-store exclusion, confirmed restore, invalid imports, stale import review, expiry, rollback, interrupted recovery, empty collection replacement, nested records, and concurrent draft edits. These do not satisfy the Firebase-specific gates below.

## Environments and fixtures

Use Auth, Firestore, Functions, and Storage emulators with synthetic organizations A and B, two employees per organization, all five roles, inactive members, an unverified user, a nonmember, and a signed-out client. Security tests must fail immediately unless emulator hosts and an explicitly approved demo project are selected. Never silently fall back to a production project when an emulator is unavailable.

Also use separate staging projects and fresh browser contexts/computers for IAM, real multi-device sessions, network behavior, and recovery features that emulators cannot validate. Production Firestore must never receive automated destructive test fixtures.

## Required tests

| Area | Attempts and expected outcome |
| --- | --- |
| Tenant isolation | A user reads, queries, creates, updates, archives, restores, and downloads B's records/files using guessed IDs, alternate URLs, collection-group queries, and forged body fields. Every unauthorized attempt fails. |
| Membership | Missing/inactive membership, disabled organization, unverified identity, stale claims, forged discovery index, and token revocation cannot grant access. Rule predicates and backend authorization both fail closed. |
| Role escalation | Members cannot modify their own role, create an Owner/Admin membership, reuse an invitation for a different email, or modify invitation roles. Last-Owner deactivation is denied. |
| Privileged commands | Admin cannot transfer ownership, alter another Admin/Owner without authority, purge a collection, modify audit events, or delete backups. Platform recovery access requires its separate IAM boundary. |
| Technician restrictions | Assigned service views work. Unassigned jobs, private pricing, company roster, and unrelated photographs do not. Status/notes commands cannot change prices, assignments, or deletion metadata. |
| Record writes | Direct client writes are denied. Backend validates organization references, allowlisted fields, types, totals, integer cents, limits, actor, timestamps, and expected revisions. Unknown paths are denied. |
| Concurrent employees | Different records survive simultaneous saves. Same-record stale updates produce conflicts. Retried creates and parallel document-number allocations cannot duplicate records or numbers. |
| Registration | Retried company creation returns one workspace; an interrupted setup resumes. Auth failure cannot leave accessible partial memberships. Failed setup never deletes unrelated organizations. |
| Invitations | Wrong verified email, expired token, reused token, caller-selected elevated role, and duplicate acceptance are rejected without overwriting existing permissions. |
| Sessions | Login, logout, refresh, account switch, organization switch, and late old-organization responses do not mutate records. Previous-company information disappears from visible UI while the new company loads. |
| Network failures | Cached emptiness, permission failures, failed listeners, slow responses, offline startup, and retried writes never trigger collection replacement or delete operations. Unsent edits do not replay under another user or organization. |
| Recovery | Authorized archive adds actor/time/reason and recovery deadline. Authorized restore within the window succeeds; expired recovery and link/number conflicts are handled explicitly. Staff/Technicians cannot bypass policy. |
| Audit | Each committed important mutation creates its authoritative event; duplicate retries do not duplicate events. The actor/time cannot be spoofed. Ordinary users cannot modify/delete events. Failed transactions do not report successful audit completion. |
| Storage | Cross-tenant reads, direct write/delete bypasses, invalid types/sizes, manifest tampering, generation conflicts, and unscanned downloads fail. Backend checks role/assignment independently of rules. No public token bypass exists. |
| Legacy migration | Missing verified backup blocks migration. Repeated imports are idempotent; conflicts abort. Damaged source data, broken references, different target organization, interrupted uploads, and destination validation failures preserve original keys and unrelated cloud data. |
| Disaster recovery | A completed managed backup and matching object copies restore into an isolated target. Counts, hashes, references, financial totals, memberships, tenant isolation, and measured recovery objectives are verified before any production repair. |

## Evidence and release decision

Record the rules/backend commit, environment IDs, test results, failed-access evidence, restore source/target, file manifests, recovery measurements, and reviewer. Test the actual deny/allow behavior through Firebase SDKs and authenticated backend calls, not only mocked frontend visibility. Emulator success does not prove backup retention or platform IAM.

Release requires all applicable tests passing, reviewed authorization/rules, a verified personal-data backup before migration, configured and verified managed/object backups, an isolated restore report, and an explicit production migration/deployment plan. An unchecked box or absent project must remain pending, not be labeled complete.

The recommended next code changes are local fail-closed loading, stale-save rejection, and complete verified backup export. After those, implement the emulator-backed organization and command model from [Firebase architecture](firebase-architecture.md).
