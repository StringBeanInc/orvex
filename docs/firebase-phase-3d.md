# Phase 3D — GPS technician time tracking and labor management

## Scope and data safety

Implemented on `firebase-preparation`. This is an emulator-only implementation, not a production release or payroll certification. The existing local workspace, backup/recovery code, Phase 3C catalogs and customer charges remain separate. No original company records were imported, migrated, reset, or edited. Existing uncommitted source work was retained. Only synthetic test companies were created during tests.

The October 12 export `firebase-export-1791850651525C6Q8mE` was inspected read-only before and after implementation. It still has six files, 20 Auth users and SHA-256 manifest fingerprint:

`8f36515546b333cc8b022bc0afb95896d83fefeca1a03ea154ceab50ce47ccf5`

That proves the checkpoint files are unchanged, not that they represent current company data. The original company's current state remains unverified. No recovery claim is made.

## Trust boundary and storage

`timekeepingView` and `timekeepingCommand` are trusted callable functions. Every transaction requires verified Firebase authentication, resolves company ID from the authenticated user's server-side user link, checks active same-company membership and role, and rejects a mismatched browser company ID. Owner/Admin roles manage timekeeping; Technicians operate only their own time and assigned jobs. Role grants and employee onboarding are not exposed by this backend.

New records live only under `organizations/{companyId}`:

| Collection | Purpose |
| --- | --- |
| `timePolicies/main` | Revision-checked company geofence, lunch, overtime and privacy policy |
| `timeSites/{propertyId}` | Administrator-verified property coordinates, without changing property records |
| `timeProfiles/{uid}` | Internal Phase 3C labor-rate assignment |
| `timeEntries/{id}` | Original server clock timestamps, meals, immutable rate/policy snapshots, review flags and correction overlay |
| `activeTimeSessions/{uid}` | Transactional lock preventing duplicate active sessions |
| `timeEvents/{id}` | Append-only clock, configuration, exception, review and approval history |
| `timeOperations/{requestId}` | Idempotent command results and payload fingerprint; prevents conflicting retries |
| `overtimeRequests`, `overtimePending` | Pending requests, single pending-request lock and reviewed decisions |
| `timeCorrections` | Proposed changes, original entry revision and independent administrator decisions |
| `timeReviews` | Administrator findings tied to the reviewed entry revision |
| `geoOverrideGrants` | Expiring, single-use administrator clock-in exceptions |
| `timeGps` | Optional, private, expiring raw coordinates kept separately from immutable history |

Firestore client reads and writes to all timekeeping collections are denied, including for Owners. The callable backend provides sanitized technician views; it does not widen access to raw work-order documents, internal notes, labor costs, other technicians, catalogs, or GPS. Account navigation follows verified membership role, and membership revocation removes privileged editors immediately. Existing Owner business modules remain available.

The backend refuses to run unless Functions, Auth and Firestore emulator flags, project ID and exact loopback endpoints match an explicit local profile. Phase 3D tests use a new project and high ports. The existing normal emulator profile remains supported, but no original data was used to test it. Production builds do not enable company cloud access.

## Clock and GPS behavior

The backend calculates Haversine distance from the submitted GPS fix to the administrator-verified property coordinates. The default radius is 500 feet. Acceptance requires distance **plus reported accuracy** to fit within the radius, reported accuracy at most 25 meters by default, and a fresh fix (at most 60 seconds old; at most ten seconds in the future). The company can configure radius and accuracy limits. No client-calculated distance or timestamp becomes authoritative.

Only an active employee assigned to an active company work order can clock in, with an active same-company property and configured internal labor rate. Clock timestamps come from the backend clock. Clock and session writes occur atomically; concurrent clicks cannot create duplicate sessions. Repeating an uncertain network request uses the same operation ID. A changed payload cannot reuse that ID.

Denied, missing, stale, inaccurate or outside fixes prevent clock-in. An Owner/Admin can issue a reasoned, one-use exception valid for 30 minutes for the assigned technician/work order. Consuming it is audited. Clock-out and lunch events still attempt GPS; a failed fix records a review flag instead of erasing work or trapping an active session. Assignment changes during a session are flagged. Administrator clock-out requires a reason and review flag.

The browser requests one fix per clock/meal event. No continuous tracking, route history or `watchPosition` is implemented. Browser GPS can be spoofed: backend distance verification does not prove physical presence. Device attestation/managed native devices would be a separate architectural project. Property geocoding is not automatic; an administrator must verify coordinates.

## Meals, overtime and corrections

Company policies define lunch schedule, reminder interval and duration. The browser can request notification permission and unlock sound only after the user enables reminders. Reminders run at the configured local schedule or elapsed interval while the page is open. They are advisory and do not start a meal or deduct time. Closed/suspended browsers cannot guarantee audible or background delivery.

Unpaid meals default **off**. Enabling them requires a reviewed jurisdiction/policy reference. A meal becomes unpaid only if the policy captured at clock-in allows it, both meal events confirm fully off-duty/uninterrupted time, and the actual recorded meal reaches the configured duration (minimum 30 minutes). Short, interrupted, unconfirmed and unfinished meals remain paid and are flagged. No unrecorded scheduled meal is deducted. A reviewed correction can restore meals as paid without changing original events.

Daily and weekly overtime thresholds, workweek start and company timezone are configurable. The ledger splits work at local midnight, including DST, and flags the union of daily/weekly excess without double-counting overlapping excess within a segment. Original policy thresholds and cost multiplier are snapshotted for each session; later policy changes apply to new sessions. Timezone and workweek start are locked after the first entry because changing historical reporting periods needs a separate migration/review design.

Technicians can request overtime; another Owner/Admin approves or rejects it with a reason. All actual worked time remains recorded regardless of approval. Unapproved excess is flagged, never deleted or blocked at clock-out. Approval status does not determine whether time is counted as worked.

Corrections are proposed for closed sessions and require another administrator's review. They retain original start/end events and add a separate effective-time overlay, including whether meals become paid. Stale revisions and overlaps with another recorded session are rejected. Requesters cannot approve their own corrections. A company with only one administrator needs an independently provisioned reviewer before corrections can be approved.

## Internal cost and customer billing

Clock-in snapshots the selected Phase 3C labor catalog ID, revision, name and **internal cost**, plus the company's internal overtime multiplier. Customer standard/overtime selling prices are never substituted for internal cost. A missing internal rate blocks clock-in instead of silently recording a zero cost. Later catalog edits/deactivation do not change an existing session's snapshot. Internal cost is calculated in cents from worked milliseconds, rounded per entry after calculation.

No timekeeping operation writes work-order pricing, quote/invoice charges or Phase 3C pricing history. This avoids double-counting already-entered customer labor charges. Automated time-to-invoice conversion is intentionally not implemented.

## GPS privacy

Default raw GPS retention is zero days: only the verification result remains. Optional retention is 1–30 days. Coordinates are stored separately with an expiry; immutable history and operation results do not copy coordinates. Raw GPS access requires an administrator, an enabled company access policy, an unexpired supplement and a reason, and creates an immutable access event. Direct client reads are always denied. An access-result retry does not replay raw coordinates; it requires a new audited request.

Expired coordinates are inaccessible through the callable view. During this local phase, physical deletion is an explicit admin purge (up to 200 expired supplements per call). No production TTL or scheduler was created. Before production, implement and verify automated physical expiry, deletion monitoring, access review and retention behavior in backups/logs. Payload fingerprints are hashes used for idempotency, not coordinate history.

## Validation and changed files

Final results and exact local commands are in [phase3d-local-testing.md](phase3d-local-testing.md). Expected permission-denied logs are assertions of forbidden client writes, not unexpected successful operations.

| Files changed in this phase | Purpose |
| --- | --- |
| `src/company/timeModel.ts`, `CompanyTimekeeping.tsx`, `timekeeping.css` | Shared calculations, technician clock, live admin dashboard, policy/setup and responsive controls |
| `src/auth/company.ts`, `src/auth/AccountPage.tsx`, `src/firebase.ts` | Verified membership role, role-aware sidebar and isolated emulator routing |
| `functions/timekeeping.mjs`, `functions/index.mjs` | Trusted commands/views and explicit Phase 3D emulator allowlist |
| `firestore.rules` | Explicit client denial for timekeeping/private GPS/history |
| `firebase.phase3d-test.json`, `package.json`, `scripts/build-pricing-backend.mjs` | Separate test ports, shared model build and test commands |
| `scripts/prepare-phase3d-regressions.mjs`, `scripts/create-isolated-time-fixture.mjs` | Safe regression configuration and explicit optional synthetic demo setup |
| `emulator-tests/phase3d-fixtures.mjs`, `time-model.test.mjs`, `time-backend.test.mjs`, `time.config.ts`, `time.spec.ts` | Synthetic fixtures, calculations, security, concurrency and browser workflows |
| `emulator-tests/directory.spec.ts`, `work-orders.spec.ts`, `pricing.spec.ts` | Role-revocation assertions now expect privileged editors to disappear; failed-network draft checks remain |
| This document and `phase3d-local-testing.md` | Architecture, compliance assumptions, limitations and test procedure |

Other dirty files predate this phase and were preserved. No dependency was added or upgraded for Phase 3D.

## Production gates and limitations

This is not a payroll engine or legal compliance guarantee. Recorded work must not be discarded because it was unauthorized. Unpaid meals require actual relief from duties; short breaks generally differ from bona fide meals. Review the [US DOL hours-worked guidance](https://www.dol.gov/agencies/whd/fact-sheets/22-flsa-hours-worked), [break guidance](https://www.dol.gov/general/topic/workhours/breaks) and applicable state/local rules with qualified advisers. Configurable thresholds do not cover every jurisdiction's regular-rate calculation, multiple rates, premium offsets, seventh-day rules, collective agreements or required meal penalties. The overtime union is an operational estimate, not certified payroll.

Remaining production work includes secure employee invitations/onboarding and role administration; payroll/legal review; durable server scheduling/notifications; pagination/report aggregation (views deliberately fail clearly above 1,000 records per queried collection instead of silently truncating totals); rate limiting and abuse controls; automated GPS expiry and backup retention; authentication hardening/App Check as appropriate; deployment-specific authorization and monitoring; and a reviewed recovery/export strategy including new time records. Browser-local backups intentionally do not include Firestore company timekeeping.

Live dashboards refresh every 30 seconds while open, without requesting GPS. Offline clock-in/backdated client events are not accepted; use audited review for time worked during device/network failure. Background alerts and spoof-resistant presence cannot be guaranteed by a browser. Costs are historical operational estimates, not payroll disbursements. Corrections can change reviewed totals while original timestamps remain visible.

Production Cloud Functions normally requires Firebase's Blaze billing plan and service setup. No billing change, production service enablement, rules deployment, push or application publication occurred. Any production connection or data migration requires a separately approved plan and verified backups.
