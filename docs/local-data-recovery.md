# ORVEX local data protection and recovery

Implemented October 11, 2026. These controls protect the current browser workspace. They do not connect Firebase, isolate different authenticated companies, or turn browser storage into shared production storage.

## Download your complete backup

Open ORVEX in the **same browser profile and exact origin** where your records are saved. A different hostname, port, browser, or profile has different localStorage. Codex tests use separate synthetic contexts and do not capture records from your personal browser.

Go to **Settings → Backup & Recovery → Download complete verified backup**. The exported JSON contains exact bytes from `orvex-v0.1` and `orvex-documents-v1`, including active and archived records, document/template snapshots, IDs, relationships, original timestamps, branding, and embedded logos/receipts. It records source origin, export time, store schema versions, counts, embedded asset count, per-store SHA-256 hashes, and a whole-package SHA-256 hash.

Missing stores are explicitly represented as absent. Unsaved sample previews, unsaved edits, and browser authentication storage are not included. The exporter reads only the two business-data keys; it rejects known credential fields, private-key markers, and credential-like values. Do not place passwords or keys in business notes or attachments. Invalid or unreadable business stores stop complete export rather than being silently replaced by sample data or omitted.

Export verification checks schema, unique IDs, core relationships, amounts and layout bounds, counts, and both levels of hashes before download. SHA-256 verifies integrity, not authenticity; someone able to replace a file and recompute hashes can create a different valid package. The file is unencrypted private business data. Keep a protected independent copy outside the browser. Clearing site data can remove records and all local checkpoints.

## Save conflicts and failed loads

All application writes share a browser Web Lock across both stores. Before a normal write, the app creates and reopens a complete verified local checkpoint. If locking, backup verification, or storage writes fail, the intended record change is not reported as saved.

The app compares the loaded baseline, intended changes, and latest saved records. Unrelated record changes are preserved; overlapping record changes or stale record revisions are rejected. Configuration fields use a baseline comparison. Workspace revisions track successful writes; a new workspace epoch on restore invalidates old tabs. Missing records and empty replacement arrays are not deletion instructions.

A failed load is read-only. A tab initialized with samples cannot write over a workspace that appeared after its initial load. A disappearing saved store triggers a conflict, not reseeding. Conflicting edits remain open; reload the latest workspace and review the edit before retrying. Reload all old ORVEX tabs to activate the current protections. Wait for saving to finish before closing the browser.

The JSON stores remain whole localStorage blobs physically, with record-level reconciliation before writing. These are not Firestore transactions or a replacement for future targeted backend commands. Old application versions, developer tools, or other scripts that bypass the storage layer are outside the cooperative lock protocol.

## Recycle bin

Customer, property, technician, work-order, catalog, document, and custom-template records can be archived. Removed priced items in work orders/documents are retained too. Normal lists and totals exclude archived data.

Archive records retain their IDs and content and add revision, deletion time, local actor label, reason, and a 30-day recovery deadline. Use **Settings → Recycle Bin → Restore record** to restore an eligible record. Restore the parent first for nested items; linked properties/customers and work orders must remain consistent. Original starter templates cannot be archived. Document numbers remain reserved by retained documents.

Expired records stay retained with normal recovery disabled. There is no automatic purge or permanent-delete UI. An older validated backup can be used for separately confirmed recovery. Local actor names and browser clock checks are not authenticated roles or authoritative audit history.

## Validate and restore a backup

1. Download an independent backup of your current valid workspace before replacing it.
2. In Backup & Recovery, select **Validate backup file**. The app checks the package and shows source, export date, counts, and assets. Validation does not change business records.
3. Review the replacement warning. This replaces both local stores; a store absent from the backup becomes absent in the destination. It is not a merge and does not touch authentication storage.
4. Type **REPLACE LOCAL DATA** and select **Confirm replace local data**. Any change to the destination after validation causes the restore to fail with a request to review again.
5. The app preserves a private, hash-checked preimage before changing either store. Valid current data also becomes a verified local checkpoint. Imported data is read back after replacement, workspace epochs/revisions are refreshed, and ORVEX reloads. Business IDs, relationships, record timestamps, and archive metadata are preserved.

Invalid formats, mismatched hashes, invalid schemas, duplicate IDs/numbers, broken core relationships, forbidden secret fields, and unconfirmed replacement cannot overwrite records. Large backups or insufficient browser quota can still cause an operation to fail safely; the file validation limit is 50 MB.

**Download last verified checkpoint** exports the last verified pre-change package. Check its timestamp and counts: it can predate recent changes, and the first checkpoint may contain absent stores if nothing was saved yet. This is recovery convenience, not a daily history or an independent backup service.

## Interrupted restores

localStorage has no atomic multi-key transaction. The restore writes a persistent journal and retained preimage first. Other writes block while the journal exists. A caught write failure attempts to roll both stores back and verifies the rollback; if rollback cannot finish, the journal remains and normal writes remain blocked.

After a crash, **Backup & Recovery** identifies the interruption. Type **RESTORE PREVIOUS DATA** and choose **Recover interrupted restore** to roll back only after validating the journal and checking that each current store matches its recorded before/after bytes. Unexpected divergent data blocks automatic recovery instead of overwriting it. The private preimage retained at `orvex-restore-preimage-v1` also preserves unreadable original bytes after an explicitly confirmed restore; it is not exported as a verified business backup. Manual support may be needed for damaged original data.

## Verification and remaining work

The normal browser suite has 45 tests, including 16 local security/recovery tests. The separate audit suite now has three preservation/recovery regressions rather than probes that require data loss. Both run only against isolated local browser contexts. The production build uses `npm run build -- --configLoader runner`, which avoids the config-bundling parent-directory scan in the restricted workspace while producing the normal Vite production output.

Still unfinished: Firebase Authentication, organization memberships and tenant isolation, backend role enforcement, trusted server timestamps/audit history, managed Firestore backups/PITR, separately protected file backups, privileged purge and recovery controls, and real isolated cloud restore drills. No production Firebase connection, migration, push, or deployment was performed for this implementation.

