const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function service(client, baseUrl = 'https://com365.lcit.vn:4002/api') {
  const filename = path.resolve(__dirname, '../../src/api/services/AuthService.ts');
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', source)(name => {
    if (name === '../client') return client;
    if (name === '../config') return { apiConfig: { baseUrl } };
    throw Error(`Unexpected runtime import: ${name}`);
  }, module, module.exports);
  return new module.exports.AuthService(client);
}

test('Unconfigured SSO explains availability and never redirects to eGov as a fake login', async () => {
  let redirected = false;
  const previous = global.window;
  global.window = { location: { origin: 'https://com365.lcit.vn', assign: () => { redirected = true; } } };
  try {
    const api = service({ get: async () => ({ payload: { enabled: false } }) });
    await assert.rejects(api.beginSso(), /đang chờ cấu hình/);
    assert.equal(redirected, false);
  } finally { global.window = previous; }
});

test('Enabled SSO starts at the configured API, for both cross-port and same-origin deployments', async () => {
  const previous = global.window;
  let target;
  global.window = { location: { origin: 'https://com365.lcit.vn', assign: value => { target = value; } } };
  try {
    const client = { get: async endpoint => { assert.equal(endpoint, '/auth/sso/config'); return { payload: { enabled: true } }; } };
    await service(client).beginSso();
    assert.equal(target, 'https://com365.lcit.vn:4002/api/auth/sso/start');
    await service(client, '/api/').beginSso();
    assert.equal(target, 'https://com365.lcit.vn/api/auth/sso/start');
  } finally { global.window = previous; }
});

test('Ticket exchange sends browser credentials and preserves normal authentication handling', async () => {
  let received;
  const expected = { success: true, payload: { user: { id: 7 }, accessToken: 'test-local-token' } };
  const api = service({ post: async (...args) => { received = args; return expected; } });
  assert.equal(await api.exchangeSsoTicket('test-ticket'), expected);
  assert.deepEqual(received, ['/auth/sso/exchange', { ticket: 'test-ticket' }, { credentials: 'include', skipAuthHandling: true }]);
});
