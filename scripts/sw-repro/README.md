# Service-worker stale-bundle reproduction

A local harness for the one failure class our test suite structurally cannot
reach: **a returning user whose service worker is still serving a previous
deploy's `index.html`.**

Three real defects shipped through green CI because of that gap (PRs #164,
#165, #166). Every one of them was caught here instead.

## The failure, in one paragraph

The service worker precaches `index.html` but no JavaScript (see
`globPatterns` in `apps/frontend/vite.config.ts`), and `registerType: 'prompt'`
means a newly deployed worker sits in `waiting` until the user clicks Reload or
closes every tab. So the old worker keeps answering navigations with the old
precached HTML, which references the previous build's chunk hashes. Cloudflare
Pages eventually purges those, and — being an SPA host — answers the miss with
`index.html` at **HTTP 200, `Content-Type: text/html`**, not a 404. The browser
will not evaluate HTML as a module, so `import()` rejects.

Two details cost real debugging time, so they are worth stating plainly:

- **The error names the wrong file.** A dynamic import reports the module you
  _requested_, not the transitive dependency that actually failed. A perfectly
  healthy `LoginPage-<hash>.js` will be named in the error when it is really
  its `api-<hash>.js` dependency that was purged.
- **`navigator.onLine` is not the offline signal you want.** It reports whether
  a network interface exists, not whether the origin is reachable, so it stays
  `true` for most real-world outages. Presence of a waiting worker is the
  signal that actually distinguishes "a new version exists" from "this chunk is
  simply unreachable".

## Setup

Two builds are needed, because the whole point is a version transition.

```bash
# build A - the deploy the user is stuck on
npm run build
cp -r apps/frontend/dist /tmp/sw-a

# make any change that alters emitted bytes, then build B.
# NOTE: a comment-only change is not enough - the minifier strips comments and
# the content hash comes out identical. Change a string.
npm run build
cp -r apps/frontend/dist /tmp/sw-b
```

Find a dependency of the route you want to break:

```bash
LP=$(ls /tmp/sw-a/assets | grep '^LoginPage-')
head -c 600 "/tmp/sw-a/assets/$LP" | grep -o 'from"\./api-[^"]*"'
```

## Scenario 1 - stale bundle recovers automatically

```bash
node scripts/sw-repro/serve-like-pages.mjs --root /tmp/sw-a
```

Open `http://localhost:8099/login` **twice** (the first load installs the
worker, the second puts it in control). Then restart against build B, keeping
A as the retained previous deploy but ageing out one dependency:

```bash
node scripts/sw-repro/serve-like-pages.mjs \
  --root /tmp/sw-b --overlay /tmp/sw-a --purge api-<hashFromA>.js
```

In DevTools, delete the `application-assets` cache to simulate LRU eviction,
clear `sessionStorage`, then reload `/login`.

**Expected:** the page recovers by itself onto build B — new entry chunk, no
worker left `waiting`, the route renders, and `qc-chunk-recovery-attempted`
is cleared.

## Scenario 2 - unreachable chunk does NOT burn a reload

Same setup, but stop the server entirely before reloading (an unreachable
origin, with no new version available).

**Expected:** `RouteErrorFallback` renders immediately. No reload happens, the
raw "Failed to fetch dynamically imported module" is never shown, and
`qc-chunk-recovery-attempted` stays `null` so the one-shot guard survives for a
genuine stale bundle later in the session.

## Reading the log

Each line is `file` or `FALLBACK`. `FALLBACK ... -> text/html` on a `.js` path
is the poison. A chunk that produces **no log line at all** was served from the
service worker's cache and never hit the network — which is exactly how you
confirm offline behaviour for already-visited routes.
