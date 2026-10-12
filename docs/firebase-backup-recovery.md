# ORVEX backup and recovery plan

Status: proposed controls, not configured or verified. No production Firebase project has been selected, no managed backup schedule has been enabled, and no backup of the user's actual local workspace has been verified. These gates must be satisfied before migration or production rollout.

Local implementation update: complete export, SHA-256/schema/reference verification, explicit restore confirmation, preserved preimages, and interrupted-restore recovery are now available in Settings. See [Local data protection and recovery](local-data-recovery.md). Local automated tests verify synthetic backups only; managed cloud backup and actual-user backup verification remain separate gates.

## Recovery objectives and retention

Proposed initial objectives are recovery within four hours of a declared incident and recovery of database changes within the available PITR window. These are targets, not a promised SLA, until isolated drills measure them. A daily-backup-only fallback can lose changes since the latest successful backup; object-copy recovery can likewise lose files since its last verified run. State the actual recovery point from evidence during each incident.

| Asset | Proposed protection | Verification and access |
| --- | --- | --- |
| Firestore | Daily managed backups retained 35 days; weekly backups retained 14 weeks; enable PITR if approved | Inspect actual schedules, completed backups, PITR settings/earliest recovery time, alerts, and a successful isolated restore. |
| Storage files | 30-day soft-delete policy, object versioning with deliberate lifecycle retention, and daily generation-aware copies to a separate protected backup bucket | Record original path, generation, checksum, size, organization, and copy time. Rehearse restoring file bytes and manifests together. |
| Audit evidence | Transactional app audit events plus a restricted logging destination with an independently administered retention policy | Ordinary users and runtime commands cannot erase security history or backup logs. |
| Configuration | Version-controlled rules, indexes, backend code, schema mappings, and reviewed infrastructure configuration | Keep deployed versions and rollback artifacts; do not store service-account keys in the repository. |
| Auth and membership | Firestore membership backups plus separate identity/configuration recovery procedures | A Firestore backup is not an Auth-user backup. Verify supported identity-export/recreation procedures separately and protect credential-related exports. |

Firestore supports daily and weekly schedules, retention up to 14 weeks, and backup restore into a new database. The service chooses backup times; scheduling is not an exact nightly clock time. Use the actual backup timestamp for recovery. [Firestore managed backups](https://firebase.google.com/docs/firestore/backups).

PITR provides minute-granularity historical recovery within the available seven-day window, bounded by the database's earliest retained version. Enabling it does not recover data lost before that boundary. [Firestore PITR](https://firebase.google.com/docs/firestore/pitr).

Backup storage, restore, clone, and PITR are billable and do not have Firestore free usage. Enable billing/appropriate Firebase plan before provisioning, approve a region-specific cost estimate, and monitor spend; budget alerts are not hard spending caps. Include functions, reads, rules dependency reads, file versions, retained deleted files, copies, egress, and recovery environments in the estimate. Do not quote a flat price without actual size, region, and retention. [Firestore billing](https://firebase.google.com/docs/firestore/pricing).

## Separation of privileges

Application members, including company Owners, get no GCP IAM permission to delete backups, change schedules, restore databases, or purge buckets. The application runtime must not have backup-administrator permissions. Use dedicated least-privilege scheduling, monitoring, and recovery identities; restrict backup deletion to separately reviewed break-glass access with strong authentication and alerts.

A compromised application Admin should not control backup retention. A compromised GCP project owner is a broader threat: independently administered object/audit copies help reduce exposure, but native backups in the same project are not absolute protection against project-level compromise. Review this risk with the platform recovery owner. Keep secrets in managed secret storage or workload identities, not frontend environment variables.

## Storage recovery is independent

Firestore backups do not contain Storage object bytes. File manifests alone cannot recover photographs, logos, or receipts. Archive a business file by marking its manifest and retaining its object; do not physically delete the object merely because a user archives a work order.

Cloud Storage soft delete supports a configurable retention period from 7 to 90 days; the default for compatible new buckets is seven days, not ORVEX's proposed 30 days. Verify the actual bucket policy. Object versioning retains noncurrent object versions, subject to lifecycle configuration and storage costs. Neither protection substitutes for separately controlled copies. [Storage soft delete](https://docs.cloud.google.com/storage/docs/soft-delete), [Object versioning](https://docs.cloud.google.com/storage/docs/object-versioning).

Copy using recorded object generations, preserve metadata, and validate checksums. Monitor incomplete copy jobs and mismatched manifests. Review lifecycle rules so noncurrent versions or soft-deleted bytes cannot expire before the approved protection window. Never expose backup buckets through application Storage Rules, public ACLs, or permanent download tokens. Restoring a file creates or identifies a verified generation and updates its organization-scoped manifest through an authorized, audited operation.

## Operational recovery procedures

### Restore an archived record

An Owner, Admin, or Manager selects an eligible recycle-bin record. The server verifies active membership, role, archive timestamp, the 30-day recovery window, and reference/uniqueness conflicts. A transaction restores the record and writes a new revision and audit event. Restore required parent records first. File manifests and bytes must be checked separately. If the window expired or the record was permanently removed, use a version or backup-based recovery review; the browser must not manufacture a replacement from stale cached data.

### Recover a mistaken bulk update

Disable the offending command or job and preserve incident evidence. Identify affected organizations, record IDs, operation IDs, and last-good revisions. Prefer immutable per-record versions for a targeted reversal with expected-current-revision checks. For a larger incident, restore or clone the last-good database into an isolated target, compare affected records, and prepare a bounded reconciliation plan. Preserve valid changes made after the incident. Have a recovery operator review conflicts and the exact write set before any production mutation. Capture a fresh recovery point before applying the correction; record the repair and verify totals and references afterward.

### Restore a managed Firestore backup

1. Record source project/database, region, backup identifier, creation time, expected schema, and incident scope. Confirm a completed, readable backup and the operator's least-privilege restore access.
2. Restore to a **new isolated database**, not the live application's database. Managed restore targets a new database; verify project/location constraints for the selected service. A named recovery database in the source project can be isolated by IAM and default-deny rules, and a separate recovery project can be used for supported exports and rehearsal copies. Do not assume direct cross-project native restore support.
3. Keep the recovered database disconnected from public app traffic and production workers. Explicitly review rules, IAM, indexes, and configuration; restored business data alone does not make an environment safe. Storage Rules consulting `(default)` must not be assumed to follow a named recovery database.
4. Validate organization isolation, record counts, hashes where applicable, relationships, document numbers and totals, memberships, tombstones, audit continuity, and file generation availability.
5. Produce a diff and recovery report. Any targeted production import or cutover requires a separately reviewed plan with a fresh backup, maintenance controls, rollback, and human authorization. Never automate a production restore or route live traffic merely because a restore job completed.

### Recover a compromised administrator

Deactivate the affected membership using an independent authorized identity, revoke sessions, enforce server token-revocation checks, and freeze privileged operations while preserving evidence. Verify the last active Owner and contact recovery staff outside the compromised account. Reset authentication factors and rotate any exposed service credentials. Review invitations, role changes, exports, updates, and deletions across affected organizations. Repair authorized changes from revision history or isolated recovery data. Regrant the minimum required access only after investigation. Application-member compromise and platform-IAM compromise require different containment scopes.

### Test recovery without touching production

Before launch, restore a known fixture database and matching objects into an isolated recovery target. Production app identities and jobs must be unable to access or mutate it. Exercise a deleted record, bulk overwrite, corrupted prices, missing photograph, failed copy job, membership deactivation, and interrupted restore. Measure recovery time and recovery point; verify counts, checksums, tenant boundaries, and application behavior. Repeat quarterly and after relevant schema or IAM changes. Use synthetic data where possible and strictly restrict any necessary real recovery data.

## Backup verification evidence

Only mark backups verified when a record exists of the project/database, configured schedules and retention, actual completed backup timestamp, PITR configuration, file-copy manifest/checksums, successful isolated restore, measured recovery objectives, security test results, reviewer, and verification time. Alert on missed backups, stale verification, failed copy jobs, unauthorized retention changes, and unusual restore attempts. Keep evidence outside the same ordinary application write path.

## Verified local backup and migration gate

The current CSV and document-only JSON exports are insufficient. Before changing the legacy persistence format or importing personal data:

1. Export the **exact original bytes** of both browser storage keys, including unreadable payloads. Identify browser origin, schema versions, and timestamp. Preserve logos and any embedded receipts. Never silently replace missing or corrupt data with sample data in the backup.
2. Package the original data and decoded assets with SHA-256 hashes, counts, ID inventories, and a source manifest. Protect the package as private company information and keep an independently stored copy.
3. Reopen the saved package, verify its hashes, validate all parseable records/references, and restore it into a separate isolated browser workspace. Report corrupt or incomplete portions instead of treating them as a successful full backup.
4. Present a migration dry run: selected target organization and verified Owner; source counts; source-to-target ID map; embedded-asset map; unresolved links; number collisions; sample-data inclusion decision; expected writes and rollback. No login automatically chooses the owner of legacy data.
5. After the plan is reviewed and the user explicitly authorizes import, create organization-scoped records using deterministic migration IDs, targeted create-only operations, and an idempotent migration ledger. Abort on conflicts instead of replacing existing cloud records. Validate destination hashes/counts and file bytes before considering cutover.
6. Preserve original browser keys and backup packages until the approved recovery/retention period ends. Migration failure must leave both the source and unrelated cloud records intact. Never delete local data as an authentication side effect.

No personal migration or verified personal backup has occurred as part of this audit.
