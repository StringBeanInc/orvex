# Phase 3J Part 1 — interface audit

Audit completed before UI implementation, October 16, 2026, on `firebase-preparation`. Earlier uncommitted work is preserved. Scope is the authenticated company dashboard and shell only; no backend rewrite or original-data inspection.

## Structure and shared patterns

`App.tsx` owns the separate browser-local application and recovery tools. `/account` uses `AccountPage`, company selection and the company-keyed `CompanyWorkspace`. Company modules use in-memory page selection rather than distinct URL routes. CSS is plain shared tokens in `index.css`, authentication shell overrides and per-module styles. Reusable patterns include panel, page/panel heading, buttons, status badges, modal forms, table scrolling and permission-aware modules. No UI framework is needed.

The current company shell has a flat, long navigation list, limited collapsed labels, no proper mobile drawer and no consistent account footer. Company switching rechecks trusted membership and disables navigation while pending; preserve this. Permission visibility uses the Phase 3F finite registry and the backend rechecks sensitive actions. The dashboard is only an instructional placeholder, not a source of real operational KPIs.

## Page inventory

| Screen | Purpose / existing functionality | Usability issue | Recommendation |
|---|---|---|---|
| Company dashboard | Placeholder welcome; no aggregation | No actionable overview | Part 1: real authorized work-order summary, current queue, recent updates, clear source/date and refresh/error states |
| Work Orders | Server-confirmed CRUD, status/history, pricing, reports | Long detailed forms and dense detail panels | Part 2: refine list/detail hierarchy without changing saves or billing |
| Assigned Jobs | Technician self-only jobs/completion | Separate navigation context from Dispatch | Preserve self access; later unify visual language |
| Dispatch | Board, day/week, availability, map, daily routes | Many controls and explanatory notes | Preserve all views; Part 2 progressive disclosure |
| Time Tracking | GPS clock, meals, overtime, review/corrections, policy | Dense role-specific controls | Part 2 separate clock controls and admin review visually |
| Customers | Company CRUD/search and linked properties | Form/list hierarchy inconsistent with other modules | Part 2 directory consistency |
| Properties | Company CRUD/search, customer relationship | Address/relationship details dense | Part 2 shared directory cards/forms |
| Estimates | Financial draft, issue/accept and conversion | Long financial forms/tables | Later financial UX pass with permission boundaries intact |
| Invoices | Issue/payment/balance, PDFs | Dense actions; sensitive data | Later dedicated financial UX pass, no dashboard financial aggregation now |
| Change Orders | Delta approval and immutable application | Complex workflow explanations | Later review/approval hierarchy |
| Employees | Owner/admin management, invitations, explicit grants | Permission matrix long | Later accessible role/grant grouping; never broaden defaults |
| Service Catalog | Service scopes and pricing | Complex editing and rate relationships | Later consistent editor/list layout |
| Labor Rates | Separately protected internal rates | Sensitive information mixed in pricing navigation | Preserve cost gate and distinct entry |
| Materials & Supplies | Company materials/pricing | Dense form/table | Later shared catalog layout |
| Accounting / Integrations | Mock QuickBooks, mappings and sync review | Configuration/status density | Later settings subsections; retain financial gate |
| API & Webhooks | Mock credentials, scopes, delivery/retry | Advanced controls interleaved | Later administration hierarchy |
| Company Settings | Link to separate local recovery workspace | Generic placeholder text | Part 1 explicit account/company context and meaningful supported links |
| Company Documents / Scheduling / Reports | Owner navigation entries but no module renderer | Dead-end placeholder destinations | Omit unimplemented Documents/Reports from navigation; preserve actual local versions. Scheduling compatibility opens existing Dispatch schedule view when authorized |
| Account / sign-in / reset / verification / invitation / company choice | Emulator authentication and membership lifecycle | Separate styling, some verbose environment notes | Preserve all behavior; outside visual scope |
| Local Dashboard | Browser-local live metrics, recent work and activity | Separate source/role model | Leave unchanged to protect recovery workflows |
| Local Work Orders / detail | Browser-local CRUD, catalog charges, quote PDFs | Styling predates company modules | Future isolated visual pass |
| Local Line Items | Saved Labor/Supplies/Expenditures, price/cost/details/link/SKU | Different catalog model | Leave unchanged; never migrate implicitly |
| Local Customers / Properties / Technicians | Browser-local directory | Different persistence model | Leave unchanged |
| Local Scheduling / Reports | Browser-local date list and status/workload reports | Not company-backed | Keep separate; do not imply cloud capability |
| Local Documents / template builder / PDF preview | Document drafts, templates and PDFs | Complex editor | Later dedicated document review |
| Local Settings / backup / recycle bin | Validated export/restore, recovery, settings | Long settings page | Preserve all safety and restore behavior |

## Part 1 design and data decisions

Use compact neutral surfaces, restrained blue actions, original logo assets and readable type. Group company navigation into Operations, Business and Administration, preserving exact supported module names, permission gates and company switch behavior. Desktop keeps collapse/expand with titles/labels; mobile gets a focus-contained drawer with Escape, backdrop, return focus and touch targets. An account footer retains Settings and logout. Hide unimplemented company links rather than implying backend support.

Dashboard uses read-only `loadWorkOrderOverview` using the existing repository pattern only when `workOrders.read` is allowed. That repository uses server Firestore reads after verified company scope validation, not localStorage. Derive active, overdue due-date, date-scheduled and unassigned counts from those returned records; distinguish legacy date schedules from exact Dispatch windows. Show recently updated records, not a fabricated cross-module audit stream. Dates use the browser calendar and must be labeled accordingly. Empty, loading and failed-server states are distinct; errors must not display fabricated zero metrics. Technician/self-only roles receive meaningful authorized module links without broad work-order reads. Financial values, compensation, availability KPIs and pending-approval totals are omitted: they would require extra separately authorized sources and are not needed for this focused pass.

Keep business modules, Firestore rules, Functions, GPS, permission definitions and financial calculations unchanged. Existing historical read-all work-order query is the dashboard scalability limit; do not claim production analytics or live subscription behavior. Quick actions open real modules; dashboard work-order links open existing details.

## Recommended next screens

For review after Part 1: Work Orders list/detail, then Customers/Properties, then Dispatch filter hierarchy. Time Tracking and financial/admin screens need their own later review. Do not begin Part 2 without approval.
