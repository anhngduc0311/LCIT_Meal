const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const express = require('express');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const SsoService = require('../../src/services/SsoService');
const AuthService = require('../../src/services/AuthService');
const ssoRoutes = require('../../src/routes/SsoRoutes');
const { loadSsoSettings, validSsoSettings } = require('../../src/config/sso');

process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const settings = {
  enabled: true, issuer: 'https://login.yenbai.gov.vn:443/oauth2/token',
  discoveryUrl: 'https://login.yenbai.gov.vn/oauth2/oidcdiscovery/.well-known/openid-configuration',
  clientId: 'com365-test-client', clientSecret: 'test-secret-not-a-real-credential', tokenAuthMethod: 'client_secret_post',
  redirectUri: 'https://com365.lcit.vn:4002/api/auth/sso/callback', frontendOrigin: 'https://com365.lcit.vn',
};
const json = body => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

async function fixture(options = {}) {
  const oidc = await import('openid-client');
  const calls = [], sessions = [];
  let nonce;
  let now = Date.now();
  const metadata = {
    issuer: options.metadataIssuer || settings.issuer,
    authorization_endpoint: 'https://login.yenbai.gov.vn/oauth2/authorize',
    token_endpoint: options.tokenEndpoint || 'https://login.yenbai.gov.vn/oauth2/token',
    jwks_uri: 'https://login.yenbai.gov.vn/oauth2/jwks', userinfo_endpoint: 'https://login.yenbai.gov.vn/oauth2/userinfo',
    code_challenge_methods_supported: ['S256'], response_types_supported: ['code'],
    subject_types_supported: ['pairwise'], id_token_signing_alg_values_supported: ['RS256'],
    token_endpoint_auth_methods_supported: ['client_secret_post'],
  };
  const providerFetch = async (url, init = {}) => {
    const parsed = new URL(url);
    calls.push({ path: parsed.pathname, method: init.method });
    if (parsed.pathname === '/oauth2/token') {
      const form = new URLSearchParams(init.body);
      assert.equal(form.get('client_secret'), settings.clientSecret);
      assert.equal(form.get('client_id'), settings.clientId);
      assert.equal(form.get('redirect_uri'), settings.redirectUri);
      assert.equal(form.get('grant_type'), 'authorization_code');
      assert.ok(form.get('code_verifier'));
      const claims = { iss: settings.issuer, aud: settings.clientId, sub: 'pairwise-identity', nonce,
        iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 300, ...options.claims };
      const signed = jwt.sign(claims, options.badSignature ? crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey : privateKey,
        { algorithm: 'RS256', keyid: 'test-key' });
      return json({ access_token: 'provider-access-token', token_type: 'Bearer', expires_in: 300, scope: 'openid',
        ...(options.missingIdToken ? {} : { id_token: signed }) });
    }
    if (parsed.pathname === '/oauth2/jwks') return json({ keys: [{ ...publicKey.export({ format: 'jwk' }), kid: 'test-key', alg: 'RS256', use: 'sig' }] });
    if (parsed.pathname === '/oauth2/userinfo') {
      assert.equal(init.method, 'POST');
      assert.equal(new Headers(init.headers).get('authorization'), 'Bearer provider-access-token');
      return json({ sub: options.userInfoSub || 'pairwise-identity', name: 'Nguyễn Tiến Đạt', ...options.userInfo });
    }
    throw Error('Unexpected provider request');
  };
  function TestConfiguration(...args) {
    const config = new oidc.Configuration(...args);
    config[oidc.customFetch] = providerFetch;
    return config;
  }
  const users = options.users || [{ id: 7, fullName: 'Nguyễn Tiến Đạt', status: '1', roles: [{ code: 'employee' }] }];
  const auth = new AuthService({ list: async () => users, updateAccessToken: async userId => sessions.push(userId) }, { create: async () => {} });
  const service = new SsoService({ ...settings, ...options.settings }, auth, {
    clock: () => now,
    loadClient: async () => ({ ...oidc, Configuration: TestConfiguration }),
    fetch: async () => json(metadata),
  });
  const begin = async () => {
    const result = await service.begin();
    const authorization = new URL(result.authorization);
    nonce = authorization.searchParams.get('nonce');
    const callback = new URL(settings.redirectUri);
    callback.search = new URLSearchParams({ state: authorization.searchParams.get('state'), code: 'one-time-code' }).toString();
    return { ...result, authorization, callback };
  };
  return { service, begin, calls, sessions, users, advance: milliseconds => { now += milliseconds; } };
}

test('SSO defaults to disabled and requires HTTPS callback and dedicated client credentials', () => {
  assert.equal(validSsoSettings(loadSsoSettings({})), false);
  assert.equal(validSsoSettings(settings), true);
  for (const changes of [{ enabled: false }, { clientSecret: '' }, { clientId: '' }, { frontendOrigin: 'https://evil.test/path' },
    { redirectUri: 'http://com365.lcit.vn/api/auth/sso/callback' }, { redirectUri: 'https://com365.lcit.vn/other' }, { tokenAuthMethod: 'none' }]) {
    assert.equal(validSsoSettings({ ...settings, ...changes }), false);
  }
});

test('Real OIDC validation and POST UserInfo produce a cookie-bound, single-use app ticket', async () => {
  const f = await fixture();
  const start = await f.begin();
  assert.equal(start.authorization.searchParams.get('code_challenge_method'), 'S256');
  assert.ok(start.authorization.searchParams.get('state'));
  assert.ok(start.authorization.searchParams.get('nonce'));
  const target = await f.service.finish(start.callback, start.cookie);
  assert.equal(new URL(target).origin, settings.frontendOrigin);
  assert.equal(new URL(target).pathname, '/auth/sso/callback');
  assert.equal(target.includes('provider-access-token'), false);
  assert.equal(target.includes('local-session-token'), false);
  const ticket = new URLSearchParams(new URL(target).hash.slice(1)).get('ticket');
  await assert.rejects(f.service.exchange(ticket, 'wrong-browser', settings.frontendOrigin), { statusCode: 400 });
  await assert.rejects(f.service.exchange(ticket, start.cookie, 'https://evil.test'), { statusCode: 400 });
  const result = await f.service.exchange(ticket, start.cookie, settings.frontendOrigin);
  assert.equal(result.user.id, 7);
  assert.deepEqual(f.sessions, [7]);
  await assert.rejects(f.service.exchange(ticket, start.cookie, settings.frontendOrigin), { statusCode: 400 });
  await assert.rejects(f.service.finish(start.callback, start.cookie), { statusCode: 400 });
});

test('State replay, expired flows, wrong browsers, duplicate state and foreign callbacks fail closed', async () => {
  const f = await fixture();
  const start = await f.begin();
  await assert.rejects(f.service.finish(start.callback, 'other-browser'), { statusCode: 400 });
  const duplicated = new URL(start.callback); duplicated.searchParams.append('state', 'extra');
  await assert.rejects(f.service.finish(duplicated, start.cookie), { statusCode: 400 });
  const foreign = new URL(start.callback); foreign.hostname = 'evil.test';
  await assert.rejects(f.service.finish(foreign, start.cookie), { statusCode: 400 });
  f.advance(10 * 60 * 1000);
  await assert.rejects(f.service.finish(start.callback, start.cookie), { statusCode: 400 });
  assert.equal(f.calls.length, 0);
});

test('ID token signature, issuer, audience, nonce, expiry and UserInfo subject are checked', async () => {
  for (const options of [{ badSignature: true }, { missingIdToken: true }, { claims: { iss: 'https://evil.test' } },
    { claims: { aud: 'other-client' } }, { claims: { nonce: 'wrong-nonce' } }, { claims: { exp: 1 } }, { userInfoSub: 'another-person' }]) {
    const f = await fixture(options);
    const start = await f.begin();
    await assert.rejects(f.service.finish(start.callback, start.cookie));
    assert.equal(f.service.tickets.size, 0);
    assert.equal(f.sessions.length, 0);
  }
});

test('Provider metadata cannot change issuer or send credentials to another host', async () => {
  for (const options of [{ metadataIssuer: 'https://evil.test' }, { tokenEndpoint: 'https://evil.test/token' }]) {
    const f = await fixture(options);
    await assert.rejects(f.begin());
    assert.equal(f.calls.length, 0);
  }
});

test('Only a unique active full name matches; missing, different, ambiguous or locked names fail closed', async () => {
  for (const options of [
    { users: [] }, { userInfo: { name: undefined } }, { userInfo: { name: 'Nguyen Tien Dat' } },
    { userInfo: { name: 'Nguyễn Tiến' } }, { userInfo: { name: 123 } },
    { users: [{ id: 7, fullName: 'Nguyễn Tiến Đạt', status: '0' }] },
    { users: [{ id: 7, fullName: 'Nguyễn Tiến Đạt', status: '1' }, { id: 8, fullName: ' NGUYỄN  TIẾN ĐẠT ', status: '1' }] },
  ]) {
    const f = await fixture(options);
    const start = await f.begin();
    await assert.rejects(f.service.finish(start.callback, start.cookie), { statusCode: 403 });
    assert.equal(f.service.tickets.size, 0);
    assert.equal(f.sessions.length, 0);
  }
});

test('Case, whitespace and Unicode normalization match users from any facility without changing roles', async () => {
  const f = await fixture({ userInfo: { name: '  NGUYỄN   TIẾN ĐẠT '.normalize('NFD'), groups: ['admin'] },
    users: [{ id: 7, fullName: 'Nguyễn Tiến Đạt', facilityId: 2, status: '1', roles: [{ code: 'employee' }] }] });
  const start = await f.begin();
  assert.equal(start.authorization.searchParams.get('scope'), 'openid profile');
  const target = await f.service.finish(start.callback, start.cookie);
  const ticket = new URLSearchParams(new URL(target).hash.slice(1)).get('ticket');
  const result = await f.service.exchange(ticket, start.cookie, settings.frontendOrigin);
  assert.deepEqual(result.user.roles, [{ code: 'employee' }]);
  assert.equal(result.user.facilityId, 2);
});

test('Handoff tickets expire after one minute', async () => {
  const f = await fixture();
  const start = await f.begin();
  const target = await f.service.finish(start.callback, start.cookie);
  const ticket = new URLSearchParams(new URL(target).hash.slice(1)).get('ticket');
  f.advance(60000);
  await assert.rejects(f.service.exchange(ticket, start.cookie, settings.frontendOrigin), { statusCode: 400 });
  assert.equal(f.sessions.length, 0);
});

test('A ticket is rejected if the matched account is renamed, locked, duplicated or replaced before exchange', async () => {
  for (const change of [
    users => { users[0].fullName = 'Một người khác'; },
    users => { users[0].status = '0'; },
    users => { users.push({ ...users[0], id: 8 }); },
    users => { users[0].id = 8; },
  ]) {
    const f = await fixture();
    const start = await f.begin();
    const target = await f.service.finish(start.callback, start.cookie);
    const ticket = new URLSearchParams(new URL(target).hash.slice(1)).get('ticket');
    change(f.users);
    await assert.rejects(f.service.exchange(ticket, start.cookie, settings.frontendOrigin), { statusCode: 403 });
    assert.equal(f.sessions.length, 0);
  }
});

test('Temporary flow storage has a fixed capacity and removes expired entries', async () => {
  const f = await fixture();
  for (let i = 0; i < 1000; i++) f.service.pending.set(String(i), { expires: Date.now() + 100000 });
  await assert.rejects(f.begin(), { statusCode: 503 });
  f.advance(200000);
  await f.begin();
  assert.equal(f.service.pending.size, 1);
});

test('Name-matched users must still be active and keep their existing local roles', async () => {
  let saved = 0;
  const user = { id: 7, fullName: 'Nguyễn Tiến Đạt', username: 'employee', status: '0', roles: [{ code: 'employee' }] };
  const auth = new AuthService({ list: async () => [user], updateAccessToken: async () => saved++ }, { create: async () => {} });
  await assert.rejects(auth.loginSsoUser(7, 'Nguyễn Tiến Đạt'), { statusCode: 403 });
  assert.equal(saved, 0);
  user.status = '1';
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  try {
    const result = await auth.loginSsoUser(7, 'Nguyễn Tiến Đạt');
    assert.deepEqual(result.user.roles, [{ code: 'employee' }]);
    assert.equal(jwt.verify(result.accessToken, process.env.JWT_SECRET).id, 7);
    assert.equal(saved, 1);
  } finally {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  }
});

test('Disabled SSO routes report availability without exposing secrets or affecting local login', async () => {
  const app = express(); app.use(express.json());
  app.use('/api/auth/sso', ssoRoutes(new SsoService({ ...settings, enabled: false }, {})));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}/api/auth/sso`;
    const config = await fetch(base + '/config');
    assert.equal(config.headers.get('cache-control'), 'no-store');
    assert.deepEqual((await config.json()).payload, { enabled: false, label: 'SSO Lào Cai' });
    assert.equal((await fetch(base + '/start')).status, 503);
    assert.equal((await fetch(base + '/callback?code=fake&state=fake')).status, 503);
    assert.equal((await fetch(base + '/exchange', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 503);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
