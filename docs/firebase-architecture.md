# ORVEX Firebase architecture

Proposed architecture for review before authentication or persistence changes. Each company owns an independent organization workspace; ORVEX remains the software platform. No Firebase service, membership enforcement, or rule set described here is deployed yet.

## Organization data model

Use separate Firebase projects for development, staging, and production. Use a random server-generated organization ID, independent of company name, email, browser storage, or the currently logged-in user. One person can belong to several organizations; membership is not ownership of all records under their user ID.

```text
organizations/{orgId}                          lifecycle and schema version
organizations/{orgId}/members/{uid}            role, active, joinedAt, changedAt
organizations/{orgId}/companyProfile/main      document issuer branding
organizations/{orgId}/workOrders/{recordId}
organizations/{orgId}/memberWorkOrders/{uid}/assignments/{recordId}
organizations/{orgId}/customers/{recordId}
organizations/{orgId}/properties/{recordId}
organizations/{orgId}/technicians/{recordId}
organizations/{orgId}/catalogItems/{recordId}
organizations/{orgId}/invoices/{recordId}
organizations/{orgId}/estimates/{recordId}
organizations/{orgId}/changeOrders/{recordId}
organizations/{orgId}/documentTemplates/{recordId}
organizations/{orgId}/documentDefaults/{type}
organizations/{orgId}/numberSequences/{type}
organizations/{orgId}/files/{fileId}
organizations/{orgId}/auditEvents/{eventId}
organizations/{orgId}/recordVersions/{versionId}
organizations/{orgId}/invitations/{invitationId}
organizations/{orgId}/operations/{operationId}
users/{uid}/organizationMemberships/{orgId}    server-maintained discovery index
platformOperations/{uidAndRequestKeyHash}      private bootstrap idempotency
```

Every business record includes `organizationId`, `schemaVersion`, `revision`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy`, `deletedAt`, `deletedBy`, and `deletionReason`. References must resolve to the same organization. Documents preserve their saved branding and pricing snapshots; their line items can be separate scoped records when size requires it. Never store an entire company's collections in one Firestore document.

`members/{uid}` is the authoritative access record. The user discovery index helps choose an organization but cannot grant access. `technicians` are business records, not automatically authenticated members; an explicit user assignment links the two. Unknown collections and arbitrary subcollections default to denied access.

## Authorization boundaries

The initial design permits authorized client reads and routes all business writes through trusted backend commands. Firestore Security Rules deny direct client writes to records, memberships, counters, invitations, revisions, and audit events. The backend rechecks the caller's active membership and role inside the mutation transaction, validates each organization's references and writable fields, and commits the record, revision, and audit event together. Client-supplied actor IDs, timestamps, role claims, organization ownership, and calculated totals are never authoritative.

Authenticated endpoints must validate the caller's token, including revocation for sensitive commands, apply request limits, and enforce App Check when configured. App Check is abuse protection, not a replacement for membership or role checks. Organization selection in the browser supplies a requested scope, not authorization.

Server Firestore libraries bypass Security Rules, so backend authorization and restrictive service-account IAM are essential alongside the client rules. This boundary follows [Firebase's rules guidance](https://firebase.google.com/docs/firestore/security/rules-conditions).

Proposed role policy:

| Operation | Owner | Admin | Manager | Office Staff | Technician |
| --- | --- | --- | --- | --- | --- |
| Read operational customers and properties | Yes | Yes | Yes | Yes | Assigned-job projection only |
| Create and update work orders | Yes | Yes | Yes | Yes | Assigned-job status and service notes only |
| Create and update customer or property records | Yes | Yes | Yes | Yes | No |
| Create and edit financial documents and prices | Yes | Yes | Yes | Yes | No |
| Edit organization branding and templates | Yes | Yes | Yes | No | No |
| Archive and restore business records | Yes | Yes | Yes | No | No |
| Read organization audit history | Yes | Yes | No | No | No |
| Invite Manager, Office Staff, or Technician | Yes | Yes | No | No | No |
| Grant Admin or transfer ownership | Yes | No | No | No | No |
| Deactivate ordinary memberships | Yes | Yes | No | No | No |
| Deactivate an Owner or Admin | Owner-controlled workflow | No | No | No | No |
| Request company closure | Owner with recent authentication | No | No | No | No |
| Purge records or restore databases | Separate platform recovery identity and explicit review | No | No | No | No |

The last active Owner cannot leave or be demoted without a completed transfer. Roles cannot edit their own role or assign a role above their authority. Owner is an application role, not GCP project-owner IAM. App users have no backup-deletion or database-restore IAM.

Technicians must not receive entire work-order documents containing private financial line items. Use a server-maintained assignment projection containing only permitted service fields, addressed by member UID, or an authenticated backend read endpoint. Firestore queries must be designed to satisfy membership and assignment rules; frontend filtering is not a protection.

## Security rule contract

The implementation must use exact collection matches. The following is a review sketch, not a deployable rule file:

```text
activeMember(orgId, uid): authenticated, verified user;
                         membership exists and active;
                         organization is active

organizations/{orgId}/members/{uid}:
    read own membership or privileged roster according to role
    all client writes denied

organizations/{orgId}/{approvedBusinessCollection}/{recordId}:
    reads require active membership and collection-specific read permission
    deleted records require recycle-bin permission
    financial records denied to Technician
    all client writes and hard deletes denied

users/{uid}/organizationMemberships/{orgId}:
    owner UID may read; client writes denied

invitations, operations, auditEvents, recordVersions, counters:
    restricted reads where required; all client writes denied

all unmatched paths:
    read and write denied
```

Backend commands must independently enforce the same membership, field, and lifecycle restrictions. Audit-event append rights exist only in trusted code; normal app users cannot alter or delete history. Send privileged security events to a separately protected logging destination as well, because an application audit collection alone is not resistant to compromised backend credentials.

## Authentication and company setup

Use Firebase Authentication with verified email, recent authentication for high-risk operations, and stronger authentication for privileged staff where the selected Auth tier supports it. Never seed a company, replace records, or delete business data from an auth listener.

Registration creates an Auth identity first. An explicit `createCompany` command uses a caller-bound idempotency key. A transaction creates the organization, initial Owner membership, discovery index, defaults, audit event, and completed-operation result together. Duplicate retries return the same organization. If Auth registration succeeds but company setup fails, show resumable setup; do not create a second workspace or delete unrelated user memberships. A deliberate additional company requires a new explicit request key.

Invitations are server-created, hashed, expiring, single-use tokens bound to an organization, verified recipient email, and permitted role. Accepting an invitation transactionally creates membership and the discovery index, consumes the invite, and adds an audit event. It cannot replace an existing member's role. Email delivery is an explicit invitation action, not an automatic side effect of login. Do not store plaintext invite tokens in logs.

Deactivation, role changes, and transfers use privileged commands. Check membership on every server operation; custom claims alone can be stale. Compromised-session recovery uses token revocation and backend revocation checks, alongside membership deactivation. [Firebase session management](https://firebase.google.com/docs/auth/admin/manage-sessions) documents revocation support.

## Session and loading safety

Use distinct states: signed out, authenticating, choosing organization, loading, ready with records, ready but genuinely empty, permission denied, and recoverable error. No state transition writes business data.

Each organization selection has a generation token. Unsubscribe previous listeners, abort requests, remove prior-company data from the visible UI, clear transient forms, then load the new organization. Ignore late responses and save completions whose user, organization, or generation no longer matches. Logout clears credentials and temporary memory only; it never deletes Firestore, Storage, audit logs, backups, or legacy browser data.

A server-confirmed empty query is different from a cache-only snapshot or a network failure. Errors show retry/status rather than setting records to an empty array and saving it. During disconnection, show explicitly labeled last-confirmed data for that organization if policy allows, and block mutations initially. Avoid persistent offline financial caching on shared devices in the first release. Unsent edits must not be replayed automatically under a different login or organization.

## Targeted commands and concurrency

Replace `commit(nextWholeWorkspace)` and document-store-wide transactions with commands such as `createCustomer`, `updateWorkOrder`, `createDocument`, `updateDraft`, `archiveRecord`, and `restoreRecord`. Every call includes organization scope, target ID, expected revision, and an idempotency key. The backend transaction checks the latest revision before applying an allowlisted patch. Conflicting edits produce a conflict UI instead of silent last-save-wins.

Saving a record must never enumerate a collection and delete documents absent from the client's snapshot. Creation uses server-generated record IDs or deterministic operation-bound IDs. Document number allocation and creation occur in one transaction; counts are not numbers. Financial totals are validated server-side from integer cents and quantities. Retries must not duplicate records, numbers, or audit events.

Store immutable previous versions for recoverable changes. Each audit event includes actor UID, organization, server timestamp, action, record reference, previous/new revision, operation ID, and a redacted change summary. Do not put secrets or arbitrary personal document bodies into security logs. Update/deletion hooks on the client are not the authoritative audit mechanism.

## Soft deletion and files

Archive records in place with `deletedAt`, `deletedBy`, optional reason, and `recoverUntil`, initially 30 days. Active lists exclude archived records; authorized recycle-bin queries include them. Archive/restore checks references and permissions transactionally. Restore conflicts, such as a reused document number or an archived parent, require an explicit resolution; they must not overwrite a different active record.

No client can hard-delete records. The first release should have no automatic business-record purger or Firestore TTL policy. A later platform purge workflow requires expired recovery periods, legal-hold checks, verified retention coverage, explicit review, and audit evidence. Account deletion and company closure must not cascade-delete shared company records.

Files use `organizations/{orgId}/{assetKind}/{fileId}/{generation}` object names and protected manifests. Initially use authenticated backend uploads with size/type checks, organization and assignment authorization, object-generation preconditions, and scan/quarantine status. Privileged operations use backend credentials, not uploaded client role claims. Private reads use authenticated retrieval; avoid persistent public download tokens for business attachments.

Storage Rules require active membership, a permitted asset class, and appropriate assignment or role for reads; direct client writes/deletes are denied in this initial upload design. Backend authorization remains mandatory. Storage Rules can consult membership in the default Firestore database, with dependency reads subject to limits and billing. This is documented in [Storage rules conditions](https://firebase.google.com/docs/storage/security/rules-conditions). File restoration and disaster recovery are covered separately in the backup plan.

## Implementation gates

1. Address the local hazards and create a complete verified backup path. No personal-data migration yet.
2. Review this model and implement default-deny rules and command authorization in emulators. Require all cross-tenant and role tests to pass.
3. Build registration and explicit invitations in development. Select actual Firebase projects, region, providers, billing, recovery contacts, and privileged MFA policy before provisioning.
4. Convert UI saves to commands, add session-generation isolation, record revisions, soft deletion, recycle bin, and authoritative audit events. Exercise two employees and two companies in isolated staging.
5. Configure backups and object recovery, produce successful recovery-drill evidence, then review the migration plan. Production deployment remains blocked until security tests and recovery gates pass.

Emulator rule testing must use controlled synthetic identities; real restore and IAM behavior also require staging verification. [Firebase rule testing](https://firebase.google.com/docs/rules/unit-tests) provides the emulator test approach. No emulator or cloud security tests have passed merely because this architecture is written.
