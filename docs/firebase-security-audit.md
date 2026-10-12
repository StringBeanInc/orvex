# ORVEX data protection audit

Audit date: October 11, 2026. ORVEX currently stores records in this browser, without Firebase Authentication, Firestore, or company memberships. The present persistence code must not be connected directly to a shared database. Three isolated browser tests reproduced data loss in core workspace storage; the tests use synthetic records, not the user's browser profile.

Follow-up implementation: the three local hazards are now guarded by locked record reconciliation/revision checks, read-only failed loads, and retained soft-deletion metadata with a 30-day recycle bin. Complete verified backup export and confirmed restore are implemented locally. The findings below record the original audit; cloud authorization, tenant isolation, and managed recovery are still pending. See [Local data protection and recovery](local-data-recovery.md) for the implemented controls and their limits.

## Confirmed risks

| Priority | Finding and evidence | Required correction |
| --- | --- | --- |
| High | `src/App.tsx:30` saves the complete `Data` object with `localStorage.setItem`. A stale tab saving its profile discarded a customer created by another tab. | Replace whole-workspace saves with individual record commands and revision checks. Until then, reject stale writes rather than silently replacing newer storage. |
| High | `src/data.ts:40` returns sample data when parsing or validation fails. `commit` does not distinguish that fallback from successfully loaded data. Saving settings after a failed load overwrote the damaged original payload. | Failed loads must be read-only. Preserve original bytes, expose recovery/export, and require a deliberate separate recovery action. Never seed cloud business data during login or loading. |
| High | Both storage keys, `orvex-v0.1` and `orvex-documents-v1`, are shared by all people using the same browser origin. They have no organization or authenticated-user scope. | Treat these as legacy local workspaces. Never automatically upload either key for whichever user happens to log in. Require an explicit, verified migration binding to one organization. |
| High | Customers and properties are removed with array filtering in `src/App.tsx:79` and `:80`; catalog items and custom templates have comparable permanent removal. The deletion probe found no tombstone or recovery copy. | Archive important records with actor, date, and reason; implement a permission-controlled recycle bin. Apply the same policy to templates and file manifests. |
| High | There is no role enforcement, authoritative audit log, organization model, or cloud security rule configuration. | Authentication and authorization must be implemented and tested before any shared production storage. UI button visibility alone is insufficient. |
| Medium | `src/documents/repository.ts:10` serializes document-store updates with browser Web Locks and rereads current storage. This protects some same-origin local concurrency but still replaces one large blob. Editing the same draft remains last-save-wins. | Keep the abstraction, replace the whole-store transaction contract with scoped record commands, and use server-side record revisions. Browser locks cannot provide multi-computer consistency. |
| Medium | Document JSON backup at `src/documents/DocumentsPage.tsx:19` excludes the core workspace. Work-order CSV excludes most records. Neither is a complete, independently verified recovery package. | Add a complete export covering both stores, assets, schema versions, hashes, counts, and relationship validation; rehearse an isolated restore before migration. |
| Medium | Branding logos and legacy receipts are embedded as data URLs in local JSON. Storage quotas, site-data clearing, or a different hostname can make data unavailable. | Preserve embedded bytes in the pre-migration backup. Move assets to organization-scoped object storage only through an explicit migration with verified object hashes. |

## Existing protections worth retaining

The app catches failed storage writes instead of reporting success. It does not automatically persist state during initial rendering. Linked-property checks protect some customer deletions, and linked work orders protect property deletion. Saved documents keep company, pricing, and template snapshots, so catalog changes do not silently rewrite earlier drafts. The document repository refuses malformed stored data instead of immediately replacing it.

These protections reduce specific risks but do not establish tenant isolation, recovery, or multi-user safety. There are no login handlers in this project to audit for cloud deletion. The cause of the previous application's incident cannot be determined from this code.

## Reproduction evidence

The probes in `audit/storage-audit.spec.ts` reproduce:

1. A stale browser tab replacing a newly created customer during an unrelated profile save.
2. A settings save replacing an unreadable original workspace with sample data.
3. A confirmed customer deletion permanently removing the record without recovery metadata.

All three original probes reproduced the hazards on October 11, 2026. They have now been converted into tests requiring preservation and recovery and remain separate from the ordinary regression suite. Their current passing result establishes those local behaviors, not Firebase security.

Run only against the local development app with fresh browser contexts:

```powershell
npx playwright test --config audit/playwright.config.ts
```

## Work completed and boundaries

The initial audit added documentation and isolated probes only. The follow-up changes local persistence/recovery behavior but does not migrate personal records, create Firebase accounts, configure cloud backups, or deploy rules. No claim is made that Codex captured a backup from the user's personal browser; the user must download it in that browser and origin.

The next implementation should first block corrupt-load and stale-save overwrites and build the verified local backup path. Then introduce the architecture in [Firebase architecture](firebase-architecture.md), with recovery controls from [Backup and recovery plan](firebase-backup-recovery.md). Actual project selection, database region, billing approval, and recovery ownership remain prerequisites for cloud provisioning.
