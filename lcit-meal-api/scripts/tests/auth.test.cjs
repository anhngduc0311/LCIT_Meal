const assert = require('node:assert/strict');
const { test } = require('node:test');
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');

process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');

// Exercise the real middleware without a database connection.
let currentUser;
let repositoryError;
const sessions = new Map();
const sessionRepositoryPath = require.resolve('../../src/repos/AuthSessionRepository');
require.cache[sessionRepositoryPath] = {
  id: sessionRepositoryPath, filename: sessionRepositoryPath, loaded: true,
  exports: class {
    async create(id, token) { sessions.set(token, id); }
    async exists(id, token) { return sessions.has(token) && sessions.get(token) === id; }
    async revoke(id, token) { if (sessions.get(token) === id) sessions.delete(token); }
  },
};
const repositoryPath = require.resolve('../../src/repos/UserRepository');
require.cache[repositoryPath] = {
  id: repositoryPath,
  filename: repositoryPath,
  loaded: true,
  exports: class {
    async get() {
      if (repositoryError) throw repositoryError;
      return currentUser;
    }
  },
};
const AuthService = require('../../src/services/AuthService');
const authMiddleware = require('../../src/middlewares/authMiddleware');
const USER_STATUS = require('../../src/constants/UserStatus');

async function authenticate(token) {
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = {
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  let accepted = false;
  let serverError;
  await authMiddleware(req, res, (error) => {
    if (error) serverError = error;
    else accepted = true;
  });
  return { accepted, req, res, serverError };
}

test('New login tokens remain valid decades later', () => {
  const service = new AuthService();
  const token = service.generateAccessToken({ id: 1, username: 'employee' });
  const decoded = jwt.verify(token, process.env.JWT_SECRET, {
    clockTimestamp: Math.floor(Date.now() / 1000) + 100 * 365 * 86400,
  });
  assert.equal(decoded.exp, undefined);
  assert.equal(decoded.id, 1);
});

test('Stored legacy tokens remain usable after their old expiry', async () => {
  const token = jwt.sign({ id: 1, exp: 1 }, process.env.JWT_SECRET);
  currentUser = { id: 1, status: USER_STATUS.STATUS_ACTIVE, accessToken: token };
  const result = await authenticate(token);
  assert.equal(result.accepted, true);
  assert.equal(result.req.user, currentUser);
});

test('Logout still revokes a persistent session', async () => {
  const token = new AuthService().generateAccessToken({ id: 1, username: 'employee' });
  currentUser = { id: 1, status: USER_STATUS.STATUS_ACTIVE, accessToken: token };
  const service = new AuthService({
    async get() { return currentUser; },
    async revokeAccessToken(id, value) { if (currentUser.accessToken === value) currentUser.accessToken = null; },
  });
  assert.equal((await authenticate(token)).accepted, true);
  await service.logout(1, token);
  const result = await authenticate(token);
  assert.equal(result.accepted, false);
  assert.equal(result.res.statusCode, 401);
});

test('Independent logins preserve legacy and other device sessions; logout revokes only its token', async () => {
  const bcrypt = require('bcrypt');
  const legacy = jwt.sign({ id: 1, exp: 1 }, process.env.JWT_SECRET);
  currentUser = { id: 1, username: 'employee', status: USER_STATUS.STATUS_ACTIVE,
    accessToken: legacy, passwordHash: await bcrypt.hash('test-password', 4) };
  const service = new AuthService({
    async get() { return currentUser; },
    async getByUsername() { return currentUser; },
    async revokeAccessToken(id, value) { if (currentUser.accessToken === value) currentUser.accessToken = null; },
  }, { async create() {} });
  const first = (await service.login('employee', 'test-password')).accessToken;
  const second = (await service.login('employee', 'test-password')).accessToken;
  assert.notEqual(first, second);
  for (const token of [legacy, first, second]) assert.equal((await authenticate(token)).accepted, true);
  await service.logout(1, second);
  assert.equal((await authenticate(second)).res.statusCode, 401);
  assert.equal((await authenticate(first)).accepted, true);
  assert.equal((await authenticate(legacy)).accepted, true);
  await service.logout(1, legacy);
  assert.equal((await authenticate(legacy)).res.statusCode, 401);
  assert.equal((await authenticate(first)).accepted, true);
});

test('Invalid signatures, locked accounts and replaced tokens are rejected', async () => {
  const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET);
  const forged = jwt.sign({ id: 1 }, 'incorrect-secret');
  for (const [presentedToken, user] of [
    [forged, { status: USER_STATUS.STATUS_ACTIVE, accessToken: forged }],
    [token, { status: 'locked', accessToken: token }],
    [token, { status: USER_STATUS.STATUS_ACTIVE, accessToken: 'replacement' }],
    [token, null],
  ]) {
    currentUser = user;
    const result = await authenticate(presentedToken);
    assert.equal(result.accepted, false);
    assert.equal(result.res.statusCode, 401);
  }
});

test('Temporary database failure returns a server error and preserves the session', async () => {
  const token = new AuthService().generateAccessToken({ id: 1, username: 'employee' });
  currentUser = { id: 1, status: USER_STATUS.STATUS_ACTIVE, accessToken: token };
  const failure = new Error('Database connection lost');
  repositoryError = failure;
  try {
    const result = await authenticate(token);
    assert.equal(result.accepted, false);
    assert.equal(result.serverError, failure);
    assert.equal(result.res.statusCode, undefined);
    const errorMiddleware = require('../../src/middlewares/errorMiddleware');
    const originalConsoleError = console.error;
    console.error = () => {};
    try { errorMiddleware(result.serverError, result.req, result.res, () => {}); }
    finally { console.error = originalConsoleError; }
    assert.equal(result.res.statusCode, 500);
    assert.equal(currentUser.accessToken, token);
  } finally {
    repositoryError = null;
  }
  assert.equal((await authenticate(token)).accepted, true);
});
