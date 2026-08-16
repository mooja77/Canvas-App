# QDPX interoperability — validation record

What the REFI-QDA (QDA-XML v1.0) import/export was validated against, so any
public claim naming a vendor can be traced to evidence and re-derived.

**Rule:** a vendor may be named in public copy only if a file **produced by that
vendor** appears below with a recorded result. MAXQDA is deliberately absent and
must not be named until a MAXQDA-produced export is validated here.

Schema of record: `Project.xsd`, QDA-XML v1.0, REFI, 18 March 2019.

## Why the vendor files are not committed

Both fixtures are real research projects belonging to third parties. They are
referenced by URL and SHA-256 rather than vendored, so this repository carries
no participant or research content. Committed instead are content-neutral,
structure-preserving fixtures per vendor shape:

- `apps/backend/src/__tests__/fixtures/qdpx/atlasti-shaped.qde`
- the NVivo-shaped archive built inline in `__tests__/integration/qdpx-archive.test.ts`

Both are exercised by CI (`utils/qdpxVendorShapes.test.ts`,
`__tests__/integration/qdpx-archive.test.ts`).

## Re-validating

```
npx tsc -b apps/backend
node scripts/validate-qdpx-fixture.mjs <path-to-project.qde>
```

Emits JSON with the counts below. Fetch a fixture from its source URL, confirm
the SHA-256 matches, then compare.

---

## 1. NVivo for Windows 12.6

|                     |                                                                                                          |
| ------------------- | -------------------------------------------------------------------------------------------------------- |
| `origin` attribute  | `NVivo for Windows 12.6`                                                                                 |
| Source              | `https://raw.githubusercontent.com/DEpt-metagenom/kvalitativSzovegelemzes/main/social/oltas/project.qde` |
| Licensing / storage | Public GitHub repository; third-party research content. **Referenced, not vendored.**                    |
| Bytes               | 67,841                                                                                                   |
| SHA-256             | `b83ec6ad74be09c1f296e770a7f6f5d5283c01771231b1c8854990b10aad8be7`                                       |
| Validated           | 2026-08-16                                                                                               |

**Result**

| Measure                                         | Value |
| ----------------------------------------------- | ----- |
| Top-level codes                                 | 11    |
| Total codes                                     | 60    |
| Max code depth                                  | 3     |
| Text sources                                    | 1     |
| Sources with inline text                        | 0     |
| Sources via `plainTextPath`                     | 1     |
| Selections                                      | 97    |
| Code references                                 | 97    |
| Resolvable references                           | 97    |
| Dangling references                             | 0     |
| Unsupported constructs                          | none  |
| Round-trip: codes                               | 60/60 |
| Round-trip: depth                               | 3/3   |
| Round-trip: code references                     | 97/97 |
| Round-trip: pair set identical after GUID remap | yes   |

---

## 2. ATLAS.ti 8.4.0 (macOS)

|                     |                                                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `origin` attribute  | `ATLAS.ti 8.4.0 573 , macOS Version 10.14.3 (Build 18D109)`                                                                          |
| Source              | `https://raw.githubusercontent.com/sky-loom/refi-qda/main/Project.qde`                                                               |
| Provenance          | The REFI vendor test set — the file's `basePath` reads `.../QDA-XML/Exports from vendors/ATLAS.ti standard project 04-03-2019 Media` |
| Licensing / storage | Public GitHub repository; standard-body sample project. **Referenced, not vendored.**                                                |
| Bytes               | 29,981                                                                                                                               |
| SHA-256             | `3c7f40b65b9caf9a6aad22e0bb546f0ce9f20fed2a4b425b1f69bf156a7c0af8`                                                                   |
| Validated           | 2026-08-16                                                                                                                           |

**Result**

| Measure                                         | Value                                                                                                                    |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Top-level codes                                 | 14                                                                                                                       |
| Total codes                                     | 14                                                                                                                       |
| Max code depth                                  | 1                                                                                                                        |
| Text sources                                    | 6                                                                                                                        |
| Sources with inline text                        | 0                                                                                                                        |
| Sources via `plainTextPath`                     | 6                                                                                                                        |
| Selections                                      | 6                                                                                                                        |
| Code references                                 | 7                                                                                                                        |
| Resolvable references                           | 7                                                                                                                        |
| Dangling references                             | 0                                                                                                                        |
| Unsupported constructs                          | 2 notes, 16 sets, 1 graph, 1 link, 1 picture source, 2 PDF sources, 1 audio source, 2 video sources, 1 uncoded quotation |
| Round-trip: codes                               | 14/14                                                                                                                    |
| Round-trip: depth                               | 1/1                                                                                                                      |
| Round-trip: code references                     | 7/7                                                                                                                      |
| Round-trip: pair set identical after GUID remap | yes                                                                                                                      |

---

## What validation changed

Running real vendor files found a defect no synthetic fixture had:

**Neither vendor inlines source text.** Both use
`plainTextPath="internal://<guid>.txt"`, with the text in a separate archive
entry. An importer reading only `project.qde` yields sources with empty content
and codings with empty `codedText` — an import that looks successful and is
empty. `readQdpxArchive` now resolves those entries, and unresolvable
selections are skipped and counted rather than stored blank.

## Known representational differences

- **Code GUIDs are remapped on export.** QualCanvas stores CUIDs; `GUIDType` in
  the schema is a UUID pattern. `toGuid()` derives a stable RFC-4122 v4-shaped
  GUID by SHA-256 of the internal id, so the mapping is deterministic and
  round-trip comparisons hold under it.
- **Selections are grouped by range on export.** Several codes on one span are
  written as one `PlainTextSelection` with several `Coding` children, as the
  vendors do. Selection counts may therefore differ from the source file while
  the (range, code) pair set is preserved exactly.
- **Uncoded quotations are dropped.** QualCanvas has no representation for a
  marked-but-uncoded passage; these are counted and disclosed on import.
