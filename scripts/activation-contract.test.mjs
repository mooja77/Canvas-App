import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activationSteps, assertLocalOrigins, assertObservedProgress } from './activation-contract.mjs';

function response(steps = activationSteps) {
  return {
    status: 200,
    body: {
      data: {
        observedSteps: [...steps],
        firstValueAt: '2026-10-05T08:00:00Z',
        state: { checklistComplete: [...steps] },
      },
    },
  };
}
test('accepts every actual observed prefix including all five durable steps', () => {
  for (let count = 0; count <= activationSteps.length; count++)
    assertObservedProgress(response(activationSteps.slice(0, count)), activationSteps.slice(0, count));
});
test('does not accept five client ticks without server-observed steps', () => {
  const value = response();
  value.body.data.observedSteps = [];
  assert.throws(() => assertObservedProgress(value, activationSteps));
});
for (const missing of activationSteps)
  test(`rejects missing observed ${missing}`, () => {
    const value = response();
    value.body.data.observedSteps = activationSteps.filter((step) => step !== missing);
    assert.throws(() => assertObservedProgress(value, activationSteps));
  });
test('rejects unavailable, malformed, reordered and undurable progress', () => {
  const unavailable = response();
  unavailable.status = 503;
  const malformed = response();
  malformed.body.data.observedSteps = null;
  const reordered = response([...activationSteps].reverse());
  const undurable = response();
  undurable.body.data.firstValueAt = 'invalid';
  const unchecked = response();
  unchecked.body.data.state.checklistComplete = [];
  for (const value of [unavailable, malformed, reordered, undurable, unchecked])
    assert.throws(() => assertObservedProgress(value, activationSteps));
});
test('local guard accepts only actual loopback hosts', () => {
  assertLocalOrigins('http://localhost:4751', 'http://127.0.0.1:4750/api');
  assertLocalOrigins('http://[::1]:4751', 'http://localhost:4750/api');
  for (const url of [
    'https://qualcanvas.com',
    'https://localhost.example.com',
    'https://127.0.0.1.example.com',
    'file:///tmp',
    'http://user:pass@localhost',
  ]) {
    assert.throws(() => assertLocalOrigins(url, 'http://localhost:4750/api'));
    assert.throws(() => assertLocalOrigins('http://localhost:4751', url));
  }
});
