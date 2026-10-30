import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runEntryCheck } from "./entry-check.mjs";

test("real browser collects wrong content, missing anchors, HTTP failures and failed resources without visiting action links", async () => {
  let actions = 0;
  const server = http.createServer((req, res) => {
    if (req.url === "/logout") {
      actions++;
      res.end("Logged out");
      return;
    }
    if (req.url === "/training") {
      res.writeHead(503, { "content-type": "text/html" });
      res.end('<!doctype html><html lang="en"><title>Error</title><main><h1>Unavailable</h1></main></html>');
      return;
    }
    if (req.url === "/disconnect") {
      req.socket.destroy();
      return;
    }
    res.setHeader("content-type", "text/html");
    res.end(
      '<!doctype html><html lang="en"><title>Fixture</title><main><h1>Wrong entry page</h1><a href="/#missing">Missing section</a><a href="/training">Training</a><a href="/logout">Logout</a><img src="/disconnect" alt="Broken fixture"></main></html>',
    );
  });
  await new Promise((r) => server.listen(4843, "127.0.0.1", r));
  const out = await fs.mkdtemp(path.join(os.tmpdir(), "themesweep-entry-test-"));
  try {
    const base = "http://127.0.0.1:4843";
    const result = await runEntryCheck(out, [
      ["landing", base + "/", "Correct welcome"],
      ["training", base + "/training", "Training centre"],
    ]);
    assert.equal(result.publicEntryPassed, false);
    assert.ok(result.findings.some((f) => f.includes("Expected page content missing")));
    assert.ok(result.findings.some((f) => f.includes("Broken internal link: /#missing")));
    assert.ok(result.findings.some((f) => f.includes("HTTP 503")));
    assert.ok(result.findings.some((f) => f.includes("Connection failed")));
    assert.equal(actions, 0);
    assert.equal(result.authenticatedJourneyVerified, false);
  } finally {
    await new Promise((r) => server.close(r));
    assert.equal(path.dirname(path.resolve(out)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(out).startsWith("themesweep-entry-test-"));
    await fs.rm(out, { recursive: true, force: true });
  }
});
