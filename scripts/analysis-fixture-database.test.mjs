import test from 'node:test';
import assert from 'node:assert/strict';
import { ownedAnalysisDatabase } from './analysis-fixture-database.mjs';

const local = 'postgresql://qc_team_20261007:local-only@127.0.0.1:4759/qc_team_20261007';
const activation = 'postgresql://qc_activation:local-only@127.0.0.1:4759/qc_activation_20261005';
const ciUrl = 'postgresql://qualcanvas:qualcanvas@localhost:55432/qualcanvas_e2e?schema=public';
const ci = {
  DATABASE_URL: ciUrl,
  GITHUB_ACTIONS: 'true',
  GITHUB_REPOSITORY: 'mooja77/Canvas-App',
  CI: 'true',
  E2E_TEST: 'true',
};

test('accepts the owned team fixture', () => assert.equal(ownedAnalysisDatabase({ DATABASE_URL: local }), local));
test('accepts the owned activation fixture', () =>
  assert.equal(ownedAnalysisDatabase({ DATABASE_URL: activation }), activation));
test('accepts only this repository workflow ephemeral CI fixture', () =>
  assert.equal(ownedAnalysisDatabase(ci), ciUrl));

for (const [name, env] of [
  ['missing database', {}],
  ['malformed URL', { DATABASE_URL: 'not-a-url' }],
  ['remote production host even in CI', { ...ci, DATABASE_URL: ciUrl.replace('localhost', 'db.production.example') }],
  ['production database on CI port', { ...ci, DATABASE_URL: ciUrl.replace('/qualcanvas_e2e?', '/production?') }],
  ['wrong CI port', { ...ci, DATABASE_URL: ciUrl.replace(':55432', ':5432') }],
  ['wrong CI database role', { ...ci, DATABASE_URL: ciUrl.replace('qualcanvas:qualcanvas@', 'postgres:qualcanvas@') }],
  [
    'wrong CI fixture credential',
    { ...ci, DATABASE_URL: ciUrl.replace('qualcanvas:qualcanvas@', 'qualcanvas:other@') },
  ],
  ['wrong CI schema', { ...ci, DATABASE_URL: ciUrl.replace('schema=public', 'schema=private') }],
  ['extra CI connection options', { ...ci, DATABASE_URL: ciUrl + '&host=db.production.example' }],
  ['non-GitHub local process', { ...ci, GITHUB_ACTIONS: undefined }],
  ['different repository', { ...ci, GITHUB_REPOSITORY: 'other/repository' }],
  ['no CI flag', { ...ci, CI: undefined }],
  ['not E2E mode', { ...ci, E2E_TEST: undefined }],
  ['unapproved local database', { DATABASE_URL: local.replace('/qc_team_20261007', '/qc_team_another_owner') }],
  ['wrong local database role', { DATABASE_URL: local.replace('qc_team_20261007:', 'postgres:') }],
  ['wrong local port', { DATABASE_URL: local.replace(':4759', ':4758') }],
  ['non-Postgres scheme', { DATABASE_URL: local.replace('postgresql:', 'https:') }],
  ['local connection host override', { DATABASE_URL: local + '?host=db.production.example' }],
]) {
  test(`rejects ${name}`, () => assert.throws(() => ownedAnalysisDatabase(env)));
}
