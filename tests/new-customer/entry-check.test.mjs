import { test } from "node:test";
import assert from "node:assert/strict";
import { findingsFor, isExpectedAbort } from "./entry-check.mjs";

const good = {
  status: 200,
  ms: 2999,
  text: "Welcome to ThemeSweep",
  overflow: false,
  errors: [],
  badResponses: [],
  accessibility: [],
  brokenLinks: [],
};
test("healthy public entry has no findings", () => assert.deepEqual(findingsFor(good), []));
test("exact three second limit fails", () =>
  assert.ok(findingsFor({ ...good, ms: 3000 }).some((f) => f.includes("3000"))));
test("error pages, browser errors and failed resources cannot pass", () => {
  const findings = findingsFor({ ...good, status: 503, errors: ["script failed"], badResponses: ["asset:404"] });
  assert.equal(findings.length, 3);
});
test("blank mobile screen, overflow and serious accessibility violations fail", () => {
  const findings = findingsFor({ ...good, text: " ", overflow: true, accessibility: ["button-name"] });
  assert.equal(findings.length, 3);
});
test("broken internal links fail the entry check", () =>
  assert.equal(findingsFor({ ...good, brokenLinks: ["/missing"] }).length, 1));
test("HTTP-200 wrong page and failed connections cannot pass", () => {
  assert.equal(
    findingsFor({
      ...good,
      expectedText: "Run a first audit",
      text: "Welcome to a missing page",
      errors: ["net::ERR_FAILED"],
    }).length,
    2,
  );
});
test("only browser-cancelled media and Shopify telemetry are observations, not failed connections", () => {
  assert.equal(isExpectedAbort("https://www.themesweep.com/training/demo.mp4", "media", "net::ERR_ABORTED"), true);
  assert.equal(isExpectedAbort("https://apps.shopify.com/api/collect", "fetch", "net::ERR_ABORTED"), true);
  assert.equal(isExpectedAbort("https://www.themesweep.com/script.js", "script", "net::ERR_ABORTED"), false);
  assert.equal(isExpectedAbort("https://www.themesweep.com/demo.mp4", "media", "net::ERR_CONNECTION_RESET"), false);
});
