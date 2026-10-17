# ORVEX Phase 3I — Dispatch, scheduling and local mapping

Implemented on `firebase-preparation`, October 16, 2026. Emulator-only; no production access, paid map provider, live API key, import, migration, reset, push or deployment. Earlier uncommitted Phase 3C–3H work was preserved. Original company data remains unverified. Phase 3J was not started.

## Implementation and integration decisions

The existing company workspace, membership/permission registry, work-order model/history, property directory, server geofence/timekeeping and financial services were reviewed first. Existing work orders hold a date-only `scheduledDate` and `assignedTechnicianId`; they do not have precise appointment windows. Property geofence locations already live in administrator-configured `timeSites`. No useful company dispatch/calendar existed beyond legacy date fields and a scheduling placeholder.

Dispatch uses additive company-scoped sidecars instead of rewriting old work orders or financial snapshots. Date-only legacy jobs remain explicitly untimed until someone saves a booking. They do not reserve appointment time. No data is automatically converted on startup or viewing a board.

The main consistency issue was assignment changes through the old editor or Phase 3H API after creating a precise booking. Active bookings now protect assignment, scheduled date, customer and property through stricter Firestore rules and backend checks. Use Dispatch to move/reassign a timed appointment; cancel its timed booking before changing its customer/property. Notes, status and other compatible work-order editing remain available. Phase 3H cannot bypass timed assignment protection.

The existing work-order editor now calls `saveCompanyWorkOrder`, a trusted replacement for its former browser transaction. It preserves the existing draft, record, sequence, property-count and activity schemas, while checking live membership, source permissions, references, active employee status, expected revision, financial parent locks and timed-booking protection. It adds caller-bound idempotency and shares the dispatch serialization lock. Existing rule-protected direct SDK compatibility remains for **untimed** headers; direct SDK writes cannot create/alter dispatch sidecars or bypass active booking protection. Untimed dates are not presented as conflict-checked reservations.

## Screens and navigation

Authorized users see **Dispatch** in the existing collapsible sidebar, using the current ORVEX branding and responsive shell. The previous unrelated Scheduling placeholder remains compatible; it is not the new dispatch module.

- **Board:** unassigned queue, technician jobs, reference/property/priority/status, exact appointment windows, duration, overdue and untimed indicators, unavailable-employee warnings, assignment/move controls, property details and work-order links.
- **Schedule:** selected day or seven-day range, appointments in the company timezone, shifts and unavailable/time-off periods. Overnight appointments appear on every day they overlap. Availability is explicit dated intervals; no recurring shift template is inferred.
- **Map:** local property-coordinate schematic and accessible keyboard-selectable markers/job buttons. It uses only validated company property sites, warns about missing address/location data and shows selected property details. There are no tiles, external requests, live geocoding or technician GPS positions.
- **Routes:** technician/day selection, current active timed stops, appointment windows/durations, up/down move controls, missing-location and chronology warnings, advisory straight-line nearest-neighbor suggestion and explicit route save. No drag-and-drop is required for keyboard access.

The assignment/availability forms keep unsaved input after failures and show server validation errors. An advisory local conflict preview uses the same pure interval model, but the server always rechecks. Saves are reported successful only after the callable confirms. Company navigation is disabled while a company switch is pending, preventing interaction with the previous scope during the transition. Dispatch data/forms are cleared by the existing company-keyed workspace boundary.

## Permissions and tenant isolation

The finite Phase 3F registry adds:

| Permission | Purpose |
|---|---|
| `dispatch.read` | Company operational board/schedules, additionally requiring `workOrders.read` |
| `dispatch.manage` | Scheduling, availability and route mutations, additionally requiring dispatch read and `workOrders.write` |
| `dispatch.override` | Explicit audited missing/outside-shift override; never a hard-conflict bypass |
| `dispatch.self` | Own assignments, appointments, availability and routes; additionally requires `time.self` |

Owner has these through existing Owner authority. Administrator/Manager/Office Staff require explicit Owner grants for the new company dispatch features; no automatic financial or dispatch administration grant was added. A Technician receives only `dispatch.self` by default and cannot schedule/override. The legacy `Admin` retains its old timekeeping-only permissions and gains no new dispatch or financial authority. Existing work-order management permissions continue to support untimed legacy editor operations.

Each callable validates verified Firebase authentication, company identity/existence, live same-company membership and explicit permissions. Explicit inactive/suspended/deactivated company state is rejected. Client company/employee IDs select records only after authorization and never establish authority. Self-only users are queried and projected by their authenticated UID; a supplied foreign technician filter is rejected.

Assignment candidates require a live active membership, active employee profile and existing `time.self` authority. This supports authorized working Owners/managers as well as Technicians; it does not assign work to arbitrary directory profiles. Cross-company, inactive, suspended, deactivated and unauthorized candidates fail server validation.

Responses contain operational job/property/availability data and minimal employee ID/name only. Internal notes, catalog/rate IDs, compensation, invoice data, labor costs, profitability, raw GPS events and geofence exception grants are not included. Team clock status additionally requires `time.review`; self viewers see only their own active session. New private sidecars, locks, operations and audit are denied to all direct client SDK reads/writes. Existing authentication, financial permissions and last-Owner safeguards were not weakened.

## Data model and consistency

All new records live under `organizations/{companyId}`:

| Collection | Purpose |
|---|---|
| `dispatchBookings/{workOrderId}` | Exact appointment, technician/property/work-order IDs, timezone snapshot, estimated elapsed duration, active flag, revision and metadata |
| `dispatchAvailability/{id}` | Explicit shift or unavailable interval with technician, timezone, revision and withdrawal state |
| `dispatchRoutes/{hash(technician,date,timeZone)}` | Explicit daily stop order and appointment fingerprint; no coordinates or driving estimates |
| `dispatchLocks/main` | Company serialization revision, shared by booking, availability, route and trusted editor mutations |
| `dispatchOperations/{operationId}` | Caller-bound request fingerprint and idempotent result |
| `dispatchAudit/{id}` | Append-only reason/actor/time/action, before/after operational snapshots and override warnings |
| `workOrderOperations/{operationId}` | Trusted legacy-editor idempotency receipts |

Booking updates atomically write the sidecar and existing work-order assignment/date/revision/activity. Same-day time changes are recorded precisely in dispatch audit; the legacy activity flag continues to reflect its date-only fields honestly. No old history is replaced. New work orders maintain atomic unique numbering and customer/property links through the trusted editor service.

Every dispatch mutation reads and writes the company lock inside the same Firestore transaction. Parallel bookings, availability changes and route saves therefore serialize and are revalidated after contention. The work order and booking each have expected revisions. Request IDs cannot be reused by another caller or with changed input. Unsupported booking/availability/route/lock schemas fail rather than being migrated.

Cancelling a booking marks it inactive and retains its history; it deliberately keeps the work-order assignment and legacy date. The board labels it untimed. It does not delete business data. Cancelling/rescheduling a job with an active time session is blocked until the time session is closed/reviewed through the existing authorized service.

## Scheduling rules and timezone behavior

- Bookings are 15–960 **elapsed** minutes. Starts are explicit wall date/time plus the current company IANA timezone, sourced from the existing timekeeping policy (default `America/Chicago`). A stale supplied timezone is rejected.
- Epoch start/end values and timezone snapshots are stored. Past snapshots are not rewritten when company policy changes. Views explicitly use the current company timezone; route keys include timezone, preserving prior timezone-specific records.
- Local times in a daylight-saving gap are rejected. Repeated local times require an explicit earlier/later occurrence. Date validation is bounded to 2020–2100. Standard Intl timezone data is used; there is no added date library or paid service.
- Intervals are half-open: ending at 10:00 and starting at 10:00 is allowed. Simultaneous appointments for different technicians are allowed.
- **Hard blocks:** overlapping active appointments for one technician, unavailable/time-off periods, inactive/foreign/unauthorized assignees, invalid references or intervals, stale revisions, terminal work orders and active time sessions. Owner cannot bypass these with an override checkbox.
- **Reviewable conflict:** appointment outside one recorded work-shift interval, including no shift configured. Requires `dispatch.override`, an explicit checkbox and a nonempty audited reason. No default workday is invented.
- Availability cannot silently invalidate bookings. Overlapping time off is blocked until appointments are moved. A shift edit/withdrawal that newly uncovers an appointment needs an authorized override. Withdrawal retains exact historical instants, including repeated DST times.
- A booking cannot move beyond an existing work-order due date; review that due date in Work Orders first, preserving the existing header invariant.

Completed/Closed work orders remain visible historically, but no longer reserve active planning capacity. Completing a job does not close its time session; actual clock events remain explicit and are never removed by scheduling.

## Routing and map limits

Routes include each active booked job for the selected technician/day exactly once. Duplicate, missing or foreign stop IDs and stale appointment fingerprints are rejected. Reordering touches only the route sidecar and audit; it cannot alter assignments or customer appointment windows. Changing the appointment set requires route review again. Route chronology conflicts remain visible rather than silently rescheduling confirmed appointments.

The heuristic starts at the first known stop and repeatedly chooses the nearest known coordinate using the existing distance helper. Missing locations remain at the end in their prior relative order. Distance is the sum of straight-line segments, **not driving distance, travel time, traffic, road access or route optimality**. With fewer than two known stops, no useful distance estimate is displayed. Suggested order is local/advisory until explicitly saved.

The map is an intentionally simple SVG coordinate schematic, not a street map. Several jobs at one property can share a marker position; keyboard-accessible job buttons remain available for each. Current property sites are shown, not a historical technician-location trail. A future provider can consume the existing property location DTO without changing tenant/authorization boundaries.

## GPS, timekeeping and financial integration

Dispatch only reads minimal active-session state when authorized. It never writes `timeEntries`, rates, meal/overtime/correction records, GPS grants or device coordinates. Scheduling creates no clock event. Clock-in/out stays with the existing trusted Phase 3D service, including default 500-foot geofence, accuracy/permission checks, server timestamps, assignment validation and separately audited exceptions. Existing overtime and labor correction controls remain intact.

Invoice creation and issue remain under the existing Phase 3E/3F permissions and immutable financial snapshots. Dispatch neither computes labor cost nor inserts customer charges. The integration test separately prices the completed job through the authorized Phase 3C service and issues its invoice through the existing financial service, without double-counting tracked labor.

## End-to-end workflow verification

The new browser workflow uses only synthetic emulator fixtures. Company, verified Owner and authorized Technician are created by the trusted test harness; it does not reopen public signup or reconstruct an original company. Registration remains separately covered by the existing isolated registration tests.

The test then performs these actual operations:
1. Creates a new customer and linked property through the existing UI.
2. Creates a new work order through the existing UI/trusted editor backend.
3. Configures its test property site with the existing authorized timekeeping service and records a shift.
4. Schedules and assigns the job through Dispatch UI.
5. Signs the Technician into a separate browser context and verifies the assignment in their self-only dispatch view.
6. Proves denied GPS clock-in fails, then clocks in using the approved synthetic geofence fix through the existing service.
7. Verifies active clock status, clocks out, and completes the job through the trusted assigned-technician operation.
8. Saves a $100 billable scope through existing pricing, generates and issues its invoice through existing financial permissions, and confirms Technician invoice access is denied.
9. Confirms completed dispatch status, retained booking audit, closed time session and historical labor-rate snapshot.

This workflow passed. It uses no real customer/company record, actual location, production Auth, external payment or map provider. Public company registration is not part of this single workflow and remains disabled normally; its separate emulator regression is reported in the test document.

## Changed files

Added:
- `functions/dispatch.mjs`, `functions/workOrderCommands.mjs`
- `src/company/dispatchModel.ts`, `src/company/CompanyDispatch.tsx`, `src/company/dispatch.css`
- `emulator-tests/dispatch-model.test.mjs`, `emulator-tests/dispatch.test.mjs`, `emulator-tests/dispatch.spec.ts`, `emulator-tests/dispatch.config.ts`
- `docs/firebase-phase-3i.md`, `docs/phase3i-local-testing.md`

Updated:
- `functions/index.mjs` (callable exports)
- `functions/operationalService.mjs` (Phase 3H timed-assignment guard)
- `src/company/permissions.ts` (finite dispatch grants/self default)
- `src/company/workOrderRepository.ts` (trusted editor save)
- `src/company/CompanyWorkOrders.tsx` (dispatch-origin selection/error guidance)
- `src/auth/CompanyWorkspace.tsx` (Dispatch navigation/work-order links and safe company switching)
- `scripts/build-pricing-backend.mjs` (shared dispatch model)
- `firestore.rules` (stronger header guard and private collection denials)
- `package.json` (syntax/test scripts)
- `tests/documents.spec.ts` (wait for the confirmed default-template save before testing refresh persistence; no local business implementation change)

Regression testing also exposed the Firestore expression limit on existing full work-order validation. Repeated property/member/activity lookups and calendar parsing are now cached; always-false private collection guards are simplified to `false`. The validation predicates and access denials remain unchanged. All 40 existing security/directory/work-order/backup rules tests pass, including legacy editor compatibility. The trusted editor retains the legacy 1900–2200 date bounds and rejects corrupt relationship/counter/lock metadata without writing.

Generated through the existing build: `functions/shared/dispatchModel.js` and updated `functions/shared/permissions.js`. No dependency was added. Other pre-existing dirty/untracked files remain preserved.

## Remaining production limitations

This is a bounded local foundation: up to 500 records per queried dispatch dataset and 100 recent audit rows. There is no production pagination, recurring shifts, automatic dispatch, travel buffer, traffic/road routing, live GPS feed, background polling subscription or map-provider account. Refresh explicitly after external updates. The coarse company serialization lock favors correctness in the emulator; production requires per-resource lock design, indexed bounded date queries, pagination/retention, contention/load tests, observability, recovery tooling and security review.

Review real company timezone policy, DST behavior across supported jurisdictions, availability/employee lifecycle rules and labor/privacy obligations before production. Add appropriate Firestore indexes before deploying date-scoped queries. No production rule or function has been deployed. A future map provider needs approval, key restrictions/server protection, privacy/retention decisions, address validation, licensing/billing review and truthful travel-time guarantees. Do not replace missing coordinates with guesses or expose technician GPS.

The October 12 checkpoint was inspected read-only and remains six files / 20 Auth users with SHA-256 `8f36515546b333cc8b022bc0afb95896d83fefeca1a03ea154ceab50ce47ccf5`. It was not imported or changed. Original current-company data remains **unverified**. Tests use disposable browser contexts; no claim is made to have backed up another browser's localStorage.

References: [Firestore serializable transactions](https://firebase.google.com/docs/firestore/transaction-data-contention), [Intl timezone formatting](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat), [local-time ambiguity](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal/ZonedDateTime). The implementation uses Intl and explicit ambiguity selection, not Temporal or a production scheduling certification.

Exact commands and validation results are in `phase3i-local-testing.md`.
