# ORVEX Phase 3J Part 1 — dashboard and company navigation

Implemented on `firebase-preparation`, October 16, 2026. This is an incremental company-shell UI refinement, not a backend rewrite. Part 2 is not started and requires review/approval.

## Audit and scope

See `phase3j-ui-audit.md` for the pre-implementation page inventory, functionality, problems and recommendations. The company dashboard was an instructional placeholder. The company sidebar was flat and long; Owner Documents/Reports/Scheduling entries did not render their advertised modules. Existing company modules, permissions and server services were already implemented and were preserved.

The separate browser-local application, document templates, backup/recovery, recycle bin and sample-data safeguards are unchanged. No new UI framework or dependency was introduced. The original ORVEX logo asset and its expanded/cropped presentation are retained.

## Screens changed

- **Company Dashboard:** real active/open, overdue by due date, scheduled-calendar-date today and unassigned work-order counts. Select a metric to inspect its queue, open a work-order detail, review recently updated jobs or enter authorized modules through quick actions. Compact neutral panels, readable type, consistent restrained accent colors and working links replace the placeholder.
- **Company shell/sidebar:** grouped Operations, Business and Administration; active `aria-current` state; original branding; accessible icon-only collapsed desktop state; titles/labels; existing trusted company selector; account-role footer, logout and Settings. Navigation scrolls independently so long module lists do not hide account controls.
- **Mobile shell:** menu button and backdrop drawer, close action, Escape, contained Tab/Shift+Tab, return focus, modal semantics, inert background content and resize cleanup. Selecting a destination closes the drawer and focuses main content. Skip-to-content is keyboard accessible.
- **Scheduling compatibility:** existing sidebar entry now opens the real Dispatch Schedule tab through an optional initial-tab prop. It uses the same existing backend and controls; no second scheduler was added.
- **Company Settings:** describes membership/access and the separate local recovery workspace with a working link. Unsupported company Documents/Reports placeholders are omitted from navigation; actual local Documents/Reports and all implemented module entry points remain available. Company pages use existing in-memory navigation; no URL route was removed.

Technician Dashboard now offers authorized self-module links rather than silently substituting Time Tracking for the Dashboard label. Time Tracking remains available through both navigation and the dashboard; actual clock behavior is unchanged.

## Navigation structure

| Group | Supported entries, each still permission-gated |
|---|---|
| Operations | Dashboard, Work Orders, Assigned Jobs, Dispatch, Scheduling, Time Tracking, Customers, Properties |
| Business | Estimates, Invoices, Change Orders, Employees |
| Administration | Service Catalog, Labor Rates, Materials & Supplies, Accounting / Integrations, API & Webhooks, Settings |

The existing finite permission checks are reused unchanged. Catalog/rate entries retain their separate cost gate, financial pages retain explicit grants, and API administration remains Owner-only. Group headings disappear when no entries are authorized. A user can expand the desktop rail to use the company selector; the mobile drawer always shows it. Switching revalidates membership and clears old company content; existing company-keyed remount boundaries remain intact. Busy navigation and switching controls remain disabled while membership is being checked.

## Dashboard data and privacy

`loadWorkOrderOverview` follows the existing repository pattern: `companyScope`, server-only Firestore read from `organizations/{companyId}/workOrders`, and `serverDeadline`. Firestore rules enforce membership and `workOrders.read`; no rule or backend change was required. The overview deliberately does not call the employee-assignment service or load employee profiles, financial documents, payroll, internal cost, availability, raw GPS or cross-company records. No localStorage fallback or migration exists.

Active means statuses other than Completed/Closed. Overdue means an active record with a due date earlier than today's browser calendar. Scheduled today uses the existing date-only header, not exact Dispatch bookings. The source note explicitly labels browser calendar/date-based counts and server confirmation time. Recent activity is honestly labeled **Recently updated / Latest work-order changes**, not a fabricated multi-module audit feed.

Technician/self-only users do not request company-wide work orders. They see meaningful authorized quick actions and an explanation of the permission boundary. Unsupported financial/availability/approval metrics are omitted. The server query inherits existing read-all behavior; this is not production-scale analytics. Refresh is explicit, and data is an as-of snapshot until refreshed. Large-company bounded aggregation/pagination and company-timezone exact booking KPIs remain future work.

Loading, confirmed empty collections and failed loads have different presentations. Failed refresh clears displayed metrics so stale/failed data is never presented as fresh zero totals; retry repeats the server read. Generation guards ignore results from unmounted or superseded requests. No business records are written by the dashboard.

## Components and changed files for this part

Added:
- `src/auth/CompanyNavigation.tsx` — permission-filtered grouping, accessible desktop rail/mobile drawer and account controls.
- `src/auth/workspace.css` — company-scoped shell and dashboard responsive styles; no local workspace redesign.
- `src/company/CompanyDashboard.tsx` — read-only overview, metric queue buttons, recent records and loading/empty/error states.
- `emulator-tests/workspace-ui.spec.ts`, `emulator-tests/workspace-ui.config.ts` — seven synthetic browser tests and screenshots.
- `docs/phase3j-ui-audit.md`, `docs/firebase-phase-3j-part1.md`, `docs/phase3j-part1-local-testing.md`.

Updated:
- `src/auth/CompanyWorkspace.tsx` — reuse new shell/dashboard and supported navigation, keep business module renderers and membership boundary.
- `src/company/workOrderRepository.ts` — small read-only work-order overview helper, avoiding unnecessary employee reads; save logic untouched.
- `src/company/CompanyDispatch.tsx` — optional initial tab for the existing Scheduling destination; default Board unchanged.
- `emulator-tests/dispatch.spec.ts`, `emulator-tests/accounting.spec.ts`, `emulator-tests/employees.spec.ts`, `emulator-tests/integrations.spec.ts`, `emulator-tests/time.spec.ts`, `emulator-tests/financial.spec.ts`, `emulator-tests/pricing.spec.ts` — mobile tests explicitly use the new drawer; time test returns to its module after refresh; company-switch test waits for new scope before reopening the drawer. Assertions on business/security behavior are retained.
- `emulator-tests/auth.spec.ts` — await completed initial overview read before synthetic membership revocation and include REST error detail in failures; registration/revocation assertions retained. Pre-existing edits preserved.

No Functions, Firestore rules, permission definitions, financial calculations, GPS validation, API authentication, dependency manifests or production configuration were changed in this part. All earlier dirty/untracked files remain preserved. Tracked local preview PNGs generated by existing tests are restored after validation rather than included as product changes.

## Visual verification and remaining UI work

Actual Edge-rendered views inspected at desktop 1280/1366, tablet 768 and phone 390 pixels, plus expanded/collapsed navigation and phone drawer. Screenshots use fake emulator companies and are stored in `tmp/phase3j-dashboard-desktop.png`, `tmp/phase3j-dashboard-owner-tablet.png`, `tmp/phase3j-dashboard-owner-phone.png`, and `tmp/phase3j-sidebar-phone.png`. Firebase's visible emulator credential warning is retained; it is not a product notification or production theme element.

See `phase3j-part1-local-testing.md` for exact validation totals/commands and local preview instructions. Remaining UI issues: module forms/tables retain earlier styling; advanced Dispatch/Timekeeping/financial/admin screens remain dense; company settings is intentionally limited to supported actions. The desktop nav can require scrolling for Owner accounts with every module. Recommended Part 2: Work Orders list/detail, then Customers/Properties, then Dispatch filtering. Do not begin without approval.

## Data safeguards

October 12 checkpoint inspected read-only: six files, 20 Auth users, unchanged SHA-256 `8f36515546b333cc8b022bc0afb95896d83fefeca1a03ea154ceab50ce47ccf5`, metadata modified `2026-10-13T00:17:31.593Z`. Original company data remains unverified. Only synthetic emulator data was used. No imports, migrations, resets, real credentials, production access, paid services, pushes or deployments occurred. The temporary registration regression frontend was stopped and its synthetic signup gate closed again. Part 1 stops for visual review.
