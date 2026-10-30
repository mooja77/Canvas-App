import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

export function isExpectedAbort(url, type, error) {
  if (error !== "net::ERR_ABORTED") return false;
  const parsed = new URL(url);
  return (
    (type === "media" && parsed.pathname.endsWith(".mp4")) ||
    (type !== "document" && parsed.origin === "https://apps.shopify.com" && parsed.pathname === "/api/collect")
  );
}

export function findingsFor(o) {
  const findings = [];
  if (o.status !== 200) findings.push(`HTTP ${o.status}`);
  if (o.ms >= 3000) findings.push(`Page load ${o.ms}ms (limit <3000ms)`);
  if (!o.text.trim()) findings.push("Blank page");
  if (o.expectedText && !o.text.includes(o.expectedText))
    findings.push(`Expected page content missing: ${o.expectedText}`);
  if (o.finalUrl && new URL(o.finalUrl).pathname !== new URL(o.url).pathname) findings.push("Unexpected redirect");
  if (o.overflow) findings.push("Horizontal overflow");
  for (const error of o.errors) findings.push(`Browser error: ${error}`);
  for (const response of o.badResponses) findings.push(`Failed resource: ${response}`);
  for (const violation of o.accessibility) findings.push(`Accessibility: ${violation}`);
  for (const link of o.brokenLinks) findings.push(`Broken internal link: ${link}`);
  return findings;
}

// Deliberately signed out and read-only. This is public-entry coverage, NEVER a
// substitute for the isolated authenticated first-value journey.
export async function runEntryCheck(out, fixtureRoutes) {
  if (fixtureRoutes && fixtureRoutes.some(([, url]) => new URL(url).hostname !== "127.0.0.1"))
    throw new Error("Fixture routes must use loopback");
  const require = createRequire(new URL("./package.json", import.meta.url));
  const { chromium } = require("playwright-core");
  const axeSource = await fs.readFile(require.resolve("axe-core/axe.min.js"), "utf8");
  await fs.mkdir(out, { recursive: true });
  const result = {
    startedAt: new Date().toISOString(),
    scope: "public-entry-only",
    authenticatedJourneyVerified: false,
    providerIntegrationVerified: false,
    pages: [],
    findings: [],
  };
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.E2E_CHROMIUM ? { executablePath: process.env.E2E_CHROMIUM } : {}),
  });
  try {
    const routes = fixtureRoutes ?? [["landing","https://qualcanvas.com/","QualCanvas"],["pricing","https://qualcanvas.com/pricing","Pricing"],["signup","https://qualcanvas.com/login?mode=register","Google"],["guide","https://qualcanvas.com/guide","QualCanvas Guide"],["training","https://qualcanvas.com/training/","Learn one research outcome at a time."]];
    const safeDocument = (url) =>
      routes.some(
        ([, safe]) => new URL(safe).origin === new URL(url).origin && new URL(safe).pathname === new URL(url).pathname,
      );
    const checkedLinks = new Map();
    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce", serviceWorkers: "block" });
      const suppressedRequests = [];
      await context.route("**/*", (route) => {
        const request = route.request();
        const target = new URL(request.url());
        if (!['GET', 'HEAD'].includes(request.method()) || /\/(logout|signout|sign-out|uninstall|delete)(\/|$)/i.test(target.pathname)) {
          suppressedRequests.push(`${request.method()} ${target.origin}${target.pathname}`);
          return route.fulfill({ status: 204, body: '', headers: {
            'access-control-allow-origin': request.headers().origin || '*',
            'access-control-allow-credentials': 'true',
            'access-control-allow-methods': 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS',
            'access-control-allow-headers': request.headers()['access-control-request-headers'] || '*',
          } });
        }
        return request.isNavigationRequest() &&
        route.request().frame() === route.request().frame().page().mainFrame() &&
        !safeDocument(route.request().url())
          ? route.abort()
          : route.continue();
      });
      try {
        for (const [name, url, expectedText, readyControl] of routes) {
          suppressedRequests.length = 0;
          const page = await context.newPage();
          const o = {
            name,
            url,
            width,
            expectedText,
            status: null,
            ms: 0,
            text: "",
            overflow: false,
            errors: [],
            badResponses: [],
            accessibility: [],
            brokenLinks: [],
            abortedRequests: [],
          };
          const onError = (e) => o.errors.push(e.message);
          const onConsole = (m) => {
            if (m.type() === "error") o.errors.push(m.text());
          };
          const onFailed = (r) => {
            const failure = r.failure()?.errorText;
            const detail = `${new URL(r.url()).pathname}: ${failure}`;
            const key = `${r.method()} ${new URL(r.url()).origin}${new URL(r.url()).pathname}`;
            if (suppressedRequests.includes(key)) {
              o.abortedRequests.push(`Deliberately suppressed: ${key}`);
              return;
            }
            if (isExpectedAbort(r.url(), r.resourceType(), failure)) o.abortedRequests.push(detail);
            else o.errors.push(`Connection failed: ${detail}`);
          };
          const onResponse = (r) => {
            if (r.status() >= 400)
              o.badResponses.push(`${new URL(r.url()).origin}${new URL(r.url()).pathname}: ${r.status()}`);
          };
          page.on("pageerror", onError);
          page.on("console", onConsole);
          page.on("response", onResponse);
          page.on("requestfailed", onFailed);
          const start = Date.now();
          try {
            o.status = (await page.goto(url, { waitUntil: "load", timeout: 30000 }))?.status() ?? null;
            o.finalUrl = page.url();
            o.loadMs = Date.now() - start;
            if (readyControl) await page.getByRole(readyControl.role, { name: readyControl.name, exact: true }).waitFor({ timeout: 15000 }).catch(e => o.errors.push(e.message));
            if (expectedText && !readyControl) {
              await page.waitForFunction(text => document.body.innerText.includes(text), expectedText, { timeout: 15000 }).catch(e => o.errors.push(e.message));
            }
            o.ms = Date.now() - start;
            await page.locator("body").waitFor();
            o.text = await page.locator("body").innerText();
            o.overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
            // Trigger and settle reveal animations before measuring contrast.
            // Preserve readiness timings above; this traversal is evidence only.
            for (let y = 0; y < (await page.evaluate(() => document.body.scrollHeight)); y += 750) {
              const settled = await page.evaluate(async y => {
                window.scrollTo(0,y);
                await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                let timer;
                const settled = await Promise.race([
                  Promise.all(document.getAnimations().filter(a => a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(()=>{}))).then(() => true),
                  new Promise(resolve => { timer = setTimeout(() => resolve(false), 1500); }),
                ]);
                clearTimeout(timer);
                return settled;
              },y);
              if (!settled) throw new Error('Reveal animation did not settle within 1500ms');
            }
            if (name !== "listing") {
              const links = await page.locator("a[href]").evaluateAll((as) => as.map((a) => a.href));
              for (const href of new Set(links)) {
                const link = new URL(href);
                if (link.origin !== new URL(url).origin) continue;
                // Never crawl action/auth/logout URLs, including future same-origin links.
                if (
                  !routes.some(
                    ([, safe]) => new URL(safe).origin === link.origin && new URL(safe).pathname === link.pathname,
                  )
                )
                  continue;
                if (link.search) continue;
                if (link.pathname === new URL(url).pathname && link.hash) {
                  const exists = await page.evaluate(
                    (id) => !!document.getElementById(id),
                    decodeURIComponent(link.hash.slice(1)),
                  );
                  if (!exists) o.brokenLinks.push(`${link.pathname}${link.hash}`);
                } else {
                  link.hash = "";
                  if (!checkedLinks.has(link.href)) {
                    try {
                      const response = await context.request.get(link.href, { timeout: 15000, maxRedirects: 0 });
                      checkedLinks.set(link.href, response.status() === 200);
                    } catch {
                      checkedLinks.set(link.href, false);
                    }
                  }
                  if (!checkedLinks.get(link.href)) o.brokenLinks.push(`${link.pathname}${link.hash}`);
                }
              }
              // DevTools evaluation leaves the site's CSP enabled and does not create
              // an inline script element (which would manufacture a CSP console error).
              await page.evaluate(axeSource);
              const a = await page.evaluate(
                async () =>
                  await window.axe.run(document, {
                    preload: false,
                    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] },
                  }),
              );
              o.accessibility = a.violations.map(
                (v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join("; ")}`,
              );
            }
            // Walk each viewport so scroll-reveal content is visible in the evidence.
            for (let y = 0; y < (await page.evaluate(() => document.body.scrollHeight)); y += 750)
              await page.evaluate((y) => window.scrollTo(0, y), y);
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.screenshot({
              path: path.join(out, `${name}-${width}.png`),
              fullPage: true,
              animations: "disabled",
            });
          } catch (e) {
            o.ms ||= Date.now() - start;
            o.errors.push(e.message);
            o.finalUrl = page.url();
            o.text = await page.locator('body').innerText({ timeout: 3000 }).catch(() => '');
            o.overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1).catch(() => false);
            await page.screenshot({ path: path.join(out, `${name}-${width}-failure.png`), fullPage: true, animations: 'disabled', timeout: 5000 }).catch(() => {});
          }
          o.findings = findingsFor(o);
          o.suppressedRequests = [...suppressedRequests];
          result.pages.push(o);
          result.findings.push(...o.findings.map((f) => `${name}/${width}: ${f}`));
          await page.close();
        }
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  result.finishedAt = new Date().toISOString();
  result.publicEntryPassed = result.findings.length === 0;
  await fs.writeFile(path.join(out, "result.json"), JSON.stringify(result, null, 2));
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const out = path.resolve(process.argv[2] ?? "tests/live/.runtime");
    const result = await runEntryCheck(out);
    console.log(
      JSON.stringify(
        {
          scope: result.scope,
          publicEntryPassed: result.publicEntryPassed,
          authenticatedJourneyVerified: false,
          findings: result.findings,
          evidence: path.join(out, "result.json"),
        },
        null,
        2,
      ),
    );
    process.exitCode = result.publicEntryPassed ? 0 : 1;
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
