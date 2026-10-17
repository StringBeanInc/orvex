# ORVEX Phase 3H — Secure API and integration foundation

Implemented locally on `firebase-preparation`. This is an emulator-only operational API and mock webhook foundation, not a public production API. No paid service, dependency, credential, deployment, push, import, migration or emulator reset was introduced. Earlier uncommitted work was preserved; Phase 3G remains uncommitted. A reviewed local Git checkpoint is recommended before a future merge; no automatic commit was made.

## Architecture and authorization

The existing Firebase Functions backend now exports `integrationApi` (HTTP), `integrationView` and `integrationCommand` (verified-user callables), plus `integrationWorkOrderEvents` (future work-order writes only). All use the existing exact-project/loopback emulator guard. No separate backend or real outgoing transport exists.

`functions/authorization.mjs` remains the shared membership/permission authority. A background-worker issue was fixed by checking for the **default** Admin app rather than assuming any named app initializes the default. No permission or existing Firestore business rule was relaxed. New integration/private/index documents are inaccessible directly through client SDKs, including to Owners.

Owner application permissions alone do not authorize an HTTP request. The caller must present a separately created API credential containing explicit implemented scopes. Credential administration requires a verified signed-in active company Owner; it does not inherit accounting grants. Each HTTP request derives company ID from a server-only credential index, checks its hash, expiry and revocation, and validates its owning active Owner membership and active company. It rechecks authorization inside the data/mutation transaction. Losing Owner membership or suspension stops that credential. Other active Owners can revoke it or rotate it into their own ownership.

Internal labor costs, employee compensation/contact records, profitability, timekeeping, payroll, catalog prices, accounting and financial documents are absent from this API. The company projection exposes ID and name only. Customers expose ID/name/city/state/country/revision; properties expose operational address/parent/type/revision; work orders expose opaque relationship/assignment IDs, number/revision/status/priority/scheduling only. Free-text notes, descriptions and employee profiles are excluded.

## API contract

Local base URL:

`http://127.0.0.1:5301/demo-orvex-phase3c-tests/us-central1/integrationApi/api/v1`

| Endpoint | Scope | Additional live application authority |
|---|---|---|
| `GET /company` | `company:read` | Active owning Owner membership |
| `GET /customers`, `GET /customers/{id}` | `customers:read` | `directory.read` |
| `GET /properties`, `GET /properties/{id}` | `properties:read` | `directory.read` |
| `GET /work_orders`, `GET /work_orders/{id}` | `work_orders:read` | `workOrders.read` |
| `PATCH /work_orders/{id}` with `status` | `work_orders:update` | `workOrders.write` |
| Same PATCH with `assignedTechnicianId` | `assignments:write` | `workOrders.write` |

A PATCH containing both fields requires both scopes. There is no employee-directory, customer/property write, work-order create/delete or financial endpoint. Assignment identity is an existing active same-company employee UID, not a browser-supplied role. Completed/Closed work orders require review in the application. Scheduled status requires an existing scheduled date.

Lists accept only `limit` (default 20, maximum 50) and `cursor` (last record ID). Ordering is by document ID, scoped server-side to the credential's company. Pagination scans at most limit+1 records. Deleted rows are omitted; a page can be shorter than the limit while still returning a cursor. Client-supplied company query/body fields are rejected; a foreign record ID cannot change namespace. There is no unrestricted export endpoint.

Every success has `{data, requestId}` and lists additionally have `{pagination:{limit,nextCursor}}`. Errors use `{error:{code,message},requestId}` and an `X-Request-ID` header; no internal stacks are returned by application handlers. Framework-level rejection of malformed JSON or oversized transport bodies can precede the application handler. API-managed body size is capped at 16 KiB; only exact supported PATCH fields are accepted. Error statuses include 400 validation, 401 invalid credential, 403 missing scope/authority, 404 unavailable route/record, 409 stale/idempotency/transition conflicts, 413 body limit, 429 quota and 503 unexpected local service errors.

PATCH requires a record revision and `Idempotency-Key` (1–128 safe identifier characters). Successful mutations return only ID/revision and the requested changed fields; a write-only scope does not disclose the full read projection. Same-credential, same-key, identical payload replays the original result; a changed payload conflicts. The narrow `operationalService.mjs` reuses shared work-order statuses and `activityChanges`, writes the existing revision/activity format and leaves pricing, approved financial scope, property links and issued documents unchanged. It does not attempt to replace the existing full work-order editor.

Fake example (not a working credential):

```powershell
$api='http://127.0.0.1:5301/demo-orvex-phase3c-tests/us-central1/integrationApi/api/v1'
$headers=@{Authorization='Bearer FAKE_LOCAL_CREDENTIAL_DO_NOT_USE'}
Invoke-RestMethod "$api/customers?limit=20" -Headers $headers
$headers['Idempotency-Key']='example-request-1'
Invoke-RestMethod "$api/work_orders/EXAMPLE_ID" -Method Patch -Headers $headers -ContentType 'application/json' -Body '{"revision":1,"status":"In Progress"}'
```

Example response:

```json
{"data":[{"id":"EXAMPLE_CUSTOMER","name":"Example Customer","revision":1}],"pagination":{"limit":20,"nextCursor":null},"requestId":"EXAMPLE_REQUEST_ID"}
```

## Credentials and secrets

Credentials have the format `ovx_mock_{random UUID}.{32 random bytes encoded as base64url}`. The entire value is SHA-256 hashed for storage and compared with a timing-safe byte comparison. High-entropy random tokens are not user passwords. Metadata records contain explicit owner/creator, scope list, creation/expiry/last-used/revoked times and revision. Expiration is 1–90 days; no scope is selected by default and an explicit nonempty supported list is required. Rotation creates a new ID/hash and atomically revokes the previous credential. Expiry is not extended implicitly. Concurrent rotations cannot both replace the same revision.

Secrets are returned only in the successful creation/rotation response, held in component memory, and can be copied/dismissed. They are absent from views, audit records, idempotency receipts and browser storage. An identical creation-command retry returns metadata with `secretUnavailable`; it cannot redisplay the secret. After an uncertain response, refresh the list and rotate/revoke the entry. Browser/SDK developer tooling and the clipboard can retain data the user explicitly copies; do not use real secrets in this emulator.

Webhook HMAC keys are separate, synthetic secrets stored in **server-only emulator** `webhookPrivate` documents because signing requires the key, not its hash. They are displayed once and never returned by subsequent reads. This is not production encrypted-secret storage. Production requires reviewed KMS/Secret Manager encryption, narrow IAM, redaction and backup exclusions. API credential hashes are never replaced with plaintext storage.

## Webhooks

Supported event types: `work_order.created`, `work_order.updated`, `work_order.status_changed`, `work_order.assigned`. A creation emits created, and emits assigned if initially assigned. Updates emit updated plus status_changed/assigned when applicable. Assignment removal is represented by the updated event. Events use deterministic company/work-order/revision/type IDs, server-saved timestamps, schema version 1 and the minimal operational projection. Pricing and employee contact/compensation fields never enter the payload.

```json
{"id":"EXAMPLE_EVENT_ID","companyId":"EXAMPLE_COMPANY","type":"work_order.status_changed","schemaVersion":1,"occurredAtMs":1792100000000,"data":{"id":"EXAMPLE_WORK_ORDER","revision":2,"number":1,"status":"In Progress","customerId":"EXAMPLE_CUSTOMER","propertyId":"EXAMPLE_PROPERTY","assignedTechnicianId":""}}
```

The trigger observes future writes, not historical data. It never updates business records. Subscriptions are company-specific, Owner-created, explicitly event-selected and enabled/disabled. They do not receive events preceding their creation. Duplicate/reordered trigger invocations cannot rewrite a saved event or create duplicate subscription deliveries. No event ordering guarantee is assumed; consumers use revision plus event ID.

Only `mock://receiver-name` destinations are accepted. There is **no HTTP/DNS client** in the delivery code. Real HTTPS URLs, localhost/IP destinations, URL credentials, paths and redirects are rejected rather than contacted. The future real transport must allow HTTPS only, validate every A/AAAA address, reject private/loopback/link-local/metadata/reserved ranges, bind the connection to the validated address to prevent DNS rebinding, and disable redirects or revalidate every hop. These defenses are production prerequisites, not a claim that the mock parser implements a real SSRF-safe HTTP client.

Each mock attempt signs `timestamp + '.' + exact JSON body` with HMAC-SHA256. Timestamp is Unix milliseconds. The receiver validates signature, a five-minute absolute clock tolerance, and event identity. Signature verification compares bytes safely and rejects tampering. Standalone verification requires a durable seen-event store; a newly allocated Set alone cannot protect across processes. The mock receiver stores a company/subscription/event receipt and payload hash transactionally: a duplicate valid retry is acknowledged without a second effect, while changed-payload reuse conflicts.

Verification example using fake values and the actual helper:

```js
import {verify} from '../functions/integrationCore.mjs';
const seen = new Set(); // demo only; use durable company/subscription/event receipts in production
const accepted = verify('FAKE_SIGNING_SECRET', timestampMs, exactRawBody, signatureHex, Date.now(), seen);
if (!accepted) throw new Error('Invalid, expired or replayed event');
```

Actual mock delivery uses the persistent Firestore receipt, not this temporary Set. It creates no external request or public webhook receiver. A future HTTP protocol can carry timestamp/signature/key version in reviewed headers, but is not enabled here.

Deliveries are manually run in the UI. Success, rejection, rate-limit and timeout-after-accept fixtures are tested. Retries have `nextAttemptAtMs`, exponential delay 1/2/4 seconds capped at 60 seconds and a four-attempt maximum. There is no background scheduler. Refresh after the deadline enables retry; failed/exhausted jobs remain visible and are not automatically replayed. Attempt history preserves sanitized status, key version and body hash, without signatures/secrets or raw private payloads. Signing-key rotation is immediate; pending retries use the new key, so a real receiver would need the replacement key before retrying. A disabled subscription or inactive creator cannot deliver.

## Rate limits and storage

Firestore transactions implement 30 requests/credential/minute and an ingress ceiling of 200 requests/socket-peer/minute, including invalid authentication. Quota is consumed before endpoint processing. The peer address comes from the socket, not untrusted forwarding headers. Firebase emulator proxying can collapse many clients into a shared peer bucket; this is an intentionally conservative local control. The limiter is not an in-memory counter, but its hot-document fixed windows, boundary bursts, proxy identity and denial-of-service characteristics are **not production-ready distributed abuse protection**. Before public exposure, add a reviewed trusted edge identity, distributed/sharded limits, global budgets, account abuse detection and load testing. New index/limiter paths cannot be written by client SDKs.

Company-scoped collections: `apiCredentials`, `apiRequestLimits`, `apiOperations`, `integrationOperations`, `integrationAudit`, `webhookSubscriptions`, `webhookPrivate`, `webhookEvents`, `webhookDeliveries`, `webhookReceipts`, `webhookAttempts`. Server-only root collections: `apiCredentialIndex`, `apiIngressLimits`. No existing business record was imported or migrated. Settings endpoints have explicit local limits (100 credentials/returned history rows, 50 subscriptions) and fail clearly beyond them; full settings pagination/retention is future work. Lists and audit are not a bulk-export facility.

## Changed files

Added:
- `functions/integrationCore.mjs`, `functions/operationalService.mjs`, `functions/integrations.mjs`
- `src/company/CompanyIntegrations.tsx`, `src/company/integrations.css`
- `emulator-tests/integrations.test.mjs`, `emulator-tests/integrations.spec.ts`, `emulator-tests/integrations.config.ts`
- `docs/firebase-phase-3h.md`, `docs/phase3h-local-testing.md`

Updated:
- `functions/authorization.mjs` (default Admin app initialization)
- `functions/index.mjs` (exports)
- `scripts/build-pricing-backend.mjs` (shared work-order model compilation)
- `src/auth/CompanyWorkspace.tsx` (Owner-only API & Webhooks navigation)
- `firestore.rules` (additional explicit direct-access denial)
- `package.json` (syntax checks and test scripts)

Generated: `functions/shared/workOrderModel.js` through the existing build. Earlier dirty/untracked files remain preserved. Generated test preview images are restored to their pre-task bytes after validation.

## Production blockers and preserved data

No public hosting rewrite is enabled. Keep all runtime guards until a separately approved production architecture/security review. Real delivery needs encrypted signing keys, encrypted backups/exclusions, narrow IAM, secrets-safe observability, receiver ownership validation, trusted HTTPS/SSRF defenses, durable scheduling/leases, circuit breakers, distributed rate limiting, retention/pagination, revocation operations, key-overlap protocol and load/failure testing. New company inactive-state controls should be harmonized across earlier modules before production; this phase rejects explicit inactive/suspended company flags in its own boundary without changing legacy permissions.

The October 12 checkpoint remains six files / 20 Auth users, SHA-256 `8f36515546b333cc8b022bc0afb95896d83fefeca1a03ea154ceab50ce47ccf5`. It was inspected read-only, never imported. Original company data remains **unverified**. No original company/user was reconstructed or modified. Tests use synthetic companies and disposable browser contexts; no claim is made to have backed up another browser's localStorage.

Official references: [Firebase trigger delivery and ordering](https://firebase.google.com/docs/functions/firestore-events), [OWASP webhook guidance](https://cheatsheetseries.owasp.org/cheatsheets/Webhook_Security_Cheat_Sheet.html), [OWASP SSRF guidance](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html). Trigger deduplication and the disabled real transport address these concerns locally; they do not certify production readiness.

Exact tests, commands and startup procedure are in `phase3h-local-testing.md`.
