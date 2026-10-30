import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {runEntryCheck} from './entry-check.mjs';

test('public scripts cannot submit an account or invoke a logout GET', async () => {
  let mutations=0;
  const server=http.createServer((req,res)=>{
    if(req.method==='POST' || req.url==='/logout') mutations++;
    res.setHeader('Content-Type','text/html');
    res.end('<!doctype html><html lang="en"><title>Fixture</title><main><h1>Fixture</h1></main><script>fetch("/api/auth/signup",{method:"POST",body:"fictional"}).catch(()=>{});fetch("/logout").catch(()=>{});</script></html>');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const out=await fs.mkdtemp(path.join(os.tmpdir(),'customer-readonly-'));
  try {
    const result=await runEntryCheck(out,[['landing',`http://127.0.0.1:${server.address().port}/`,'Fixture']]);
    assert.equal(mutations,0);
    assert.ok(result.pages.every(p=>p.suppressedRequests.length===2));
    assert.equal(result.providerIntegrationVerified,false);
  } finally {
    await new Promise(resolve=>server.close(resolve));
    await fs.rm(out,{recursive:true,force:true});
  }
});

test('semantic readiness waits for a visible signup control and a paused animation fails within a bound', async () => {
  const server=http.createServer((req,res)=>{
    res.setHeader('Content-Type','text/html');
    res.end('<!doctype html><html lang="en"><title>Fixture</title><main><h1>Create help</h1><div id="form"></div></main><style>@keyframes reveal { from {opacity:0.5} to {opacity:1} } main {animation:reveal 1s paused}</style><script>setTimeout(()=>{document.getElementById("form").innerHTML="<button>Create Account</button>"},200)</script></html>');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const out=await fs.mkdtemp(path.join(os.tmpdir(),'customer-readiness-'));
  try {
    const result=await runEntryCheck(out,[['signup',`http://127.0.0.1:${server.address().port}/`,'Create Account',{role:'button',name:'Create Account'}]]);
    assert.ok(result.pages.every(p=>p.ms >= 200));
    assert.ok(result.findings.some(f=>f.includes('did not settle')));
    assert.equal(result.publicEntryPassed,false);
  } finally {
    await new Promise(resolve=>server.close(resolve));
    await fs.rm(out,{recursive:true,force:true});
  }
});
