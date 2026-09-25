import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.mjs';

const env = { ASSETS: { fetch: (request) => Promise.resolve(new Response('asset', { status: 200 })) } };

test('apex serves assets', async () => {
  const res = await worker.fetch(new Request('https://daddyrad.com/'), env);
  assert.equal(res.status, 200);
});

test('www redirects to apex preserving path', async () => {
  const res = await worker.fetch(new Request('https://www.daddyrad.com/foo?x=1'), env);
  assert.equal(res.status, 301);
  assert.equal(res.headers.get('location'), 'https://daddyrad.com/foo?x=1');
});

test('unknown hosts 404', async () => {
  const res = await worker.fetch(new Request('https://daddyrad.workers.dev/'), env);
  assert.equal(res.status, 404);
});

test('non-GET methods rejected', async () => {
  const res = await worker.fetch(new Request('https://daddyrad.com/', { method: 'POST' }), env);
  assert.equal(res.status, 405);
});
