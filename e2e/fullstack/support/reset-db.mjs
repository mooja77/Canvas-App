#!/usr/bin/env node
// Recreate the throwaway test database named in DATABASE_URL, then apply the
// migration history with `prisma migrate deploy`.
//
// Guard rails: refuses unless the host is loopback AND the database name is one
// of the estate test databases. It can never touch a shared or remote database.
import { spawnSync } from 'node:child_process';
import pg from 'pg';

const url = new URL(process.env.DATABASE_URL ?? '');
const db = url.pathname.replace(/^\//, '');
const loopback = ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(url.hostname);
if (!loopback || !/^qualcanvas_(fullstack|sim)[a-z0-9_]*$/.test(db)) {
  console.error(`[reset-db] refusing to reset ${url.hostname}/${db}: only loopback qualcanvas_fullstack*/qualcanvas_sim* databases`);
  process.exit(2);
}
const admin = new URL(url);
admin.pathname = '/postgres';
admin.search = '';
const client = new pg.Client({ connectionString: admin.toString() });
await client.connect();
await client.query(`DROP DATABASE IF EXISTS "${db}" WITH (FORCE)`);
await client.query(`CREATE DATABASE "${db}"`);
await client.end();
console.log(`[reset-db] recreated ${db}`);

const r = spawnSync('npx', ['prisma', 'migrate', 'deploy', '--schema=apps/backend/prisma/schema.prisma'], {
  stdio: 'inherit',
  shell: true,
  env: process.env,
});
process.exit(r.status ?? 1);
