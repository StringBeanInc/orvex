# Phase 3A: company Customers and Properties

Implemented on `firebase-preparation`, in local emulators only. No deployment, production settings change, push, or migration occurred.

## Use the modules

Open http://127.0.0.1:5173/account and sign in to your verified company account (for example ORVEX Demo Services). Click Customers, then Add customer. The form retains its input if saving fails. Save completion appears only after the Firestore transaction is acknowledged. Edit, search, and confirmed deletion use the existing directory-card and modal styles. Add a customer before creating a property. Properties support name, address, city, state, ZIP code, type, and an active customer in the same company. Both directories support a Refresh directory button and survive browser refresh.

The separate local workspace remains at `/`, with its existing business modules, backup and recycle-bin tools. Company code does not read or write the legacy business keys. Registration, login and directory loading never import local data or samples. Other company modules remain read-only.

## Scope and authorization

Use the existing `organizations/{companyId}/customers/{customerId}` and `organizations/{companyId}/properties/{propertyId}` paths; do not rename or copy existing company namespaces. Before each repository operation, resolve the current Auth user's company lookup and active membership from the server. A requested company ID must match that lookup. Firestore Rules independently require verified Auth and active Owner membership at the path. Browser checks do not grant access. No other roles are enabled for these modules in this phase.

Rules enforce exact field allowlists, required values and bounded strings, immutable company/record identity and creation metadata, actor IDs matching Auth, server write timestamps, schema version and sequential revisions. Stale editor revisions fail with a conflict; cancel, refresh and reopen the editor before applying a reviewed edit. Physical deletes are denied. Deleted records retain their original IDs and fields, actor/timestamp metadata and a recovery-until marker around 30 days after server time (29–31 days accommodates clock/transaction timing). There is no automatic purge. A company recycle-bin restore UI and authorized restore commands remain future work; the existing local recycle bin is unchanged and cannot restore cloud records.

## Relationship invariant

Every active property references an active customer under the same company path. A customer's `propertyCount` is server-rule-validated, not a freely writable browser count. Each link/unlink/reassignment is a transaction affecting the property and appropriate customer records. Customer counter changes are allowed only when `relationshipMutationId` names a property whose before/after relationship justifies exactly that increment/decrement; property rules require the reciprocal matching count change. Reassignments update both parents. Multiple properties cannot share a single counter increment in one batch. Customer deletion requires zero active properties, checked in the transaction and again in Rules. Concurrent linking versus deletion cannot both commit an orphaned result. Future Admin SDK writers must preserve this invariant because they bypass Rules.

## Availability and persistence

Firestore is the only company directory source of truth. Reads explicitly request server data; no localStorage or sample fallback exists. Writes use server transactions and await acknowledgement, not optimistic local success. Loading, saving, error and retry states are explicit. A bounded confirmation timeout keeps the draft and instructs the user to refresh before retrying. A timeout can be ambiguous if the server committed but its acknowledgement was lost; the same draft ID and revision checks prevent a silent overwrite/duplicate retry. Other-browser changes appear on Refresh directory or browser reload; continuous directory subscriptions and pagination are future work.

These are local emulators, not a durable production database. Browser refresh preserves records while the emulator runs; stopping/restarting an emulator without a configured export/import loses its in-memory state. Configure and verify emulator persistence before relying on it for real data. The initial CLI export attempt failed; a separate checksum-verified Firestore JSON snapshot preserved all 33 original emulator documents in `tmp/phase3a-firestore-before.json` (no Auth credentials), and a post-test comparison verified every original document was unchanged, including ORVEX Demo Services. This local diagnostic snapshot is not a production backup or a browser-local backup, and it is not automatically imported.

## Tests and setup

Start `npm run emulators` and `npm run dev -- --configLoader runner`. Development continues to use only demo-orvex, Auth 9099 and Firestore 8080; production initialization is disabled. No new Firebase service or billing setup is required.

Run `npm test`, the audit Playwright configuration, `npm run test:rules`, `npm run test:auth`, `npx tsc -b`, and the production build with `--configLoader runner`. Rule tests now use separate disposable `demo-orvex-rules` and `demo-orvex-directory-rules` projects and clear only those test projects. Browser-test setup loads current emulator rules into demo-orvex but never clears its records; browser tests create unique synthetic companies in isolated profiles. Do not enter real credentials in emulators. Existing local tests still cover backup integrity, recovery and lost-write protections.

Phase 3A tests cover customer/property CRUD, searching, browser-refresh persistence, confirmed archive, linked-delete prevention, forged metadata, stale revision rejection, same-company references, reassignment, fake counters, bulk undercount attacks, cross-company reads/writes, inactive/unverified/non-Owner denial, concurrent archive/link races, offline saves, permission-denied writes, retained drafts and successful retry. Successful counts: 45 application checks, 3 audit checks, 13 rules checks, and 9 auth/company browser checks; TypeScript and production build pass.

See [Firebase transactions and atomic rules validation](https://firebase.google.com/docs/firestore/manage-data/transactions). Production authorization review, restore UI, managed backup, additional roles, larger-directory pagination, and the other business modules remain pending.
