const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function load(relative, mocks = {}) {
  const filename = path.resolve(__dirname, '../../src', relative);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const exports = { exports: {} };
  const requireFromFile = createRequire(filename);
  new Function('require', 'module', 'exports', source)(name => name in mocks ? mocks[name] : requireFromFile(name), exports, exports.exports);
  return exports.exports;
}

const roles = load('constants/roles.ts');
const user = (username, role) => ({ username, roles: [{ code: role }] });

test('Shared quanly account has an operations home and no personal meal tools', () => {
  assert.equal(roles.homeView('quanly', ['manager']), 'dashboard');
  assert.equal(roles.canUsePersonalMeals(' QUANLY ', ['manager']), false);
  assert.equal(roles.homeView('employee', ['employee']), 'personal');
  assert.equal(roles.canUsePersonalMeals('named_manager', ['manager']), true);
  assert.equal(roles.homeView('admin', ['admin', 'manager']), 'dashboard');
  assert.equal(roles.homeView('kitchen', ['kitchen']), 'dashboard');
});

test('HomeRouter renders the dashboard for quanly instead of personal registration', () => {
  const HomeRouter = load('pages/HomeRouter.tsx', {
    '@/context/AuthContext': { useAuth: () => ({ user: user('quanly', 'manager') }) },
    '@/constants/roles': roles,
    './Dashboard/Home': { __esModule: true, default: () => React.createElement('div', null, 'operations-dashboard') },
  }).default;
  assert.equal(renderToStaticMarkup(React.createElement(HomeRouter)), '<div>operations-dashboard</div>');
});

test('Direct personal URLs redirect shared managers, while staff and named managers keep personal access', () => {
  let currentUser = user('quanly', 'manager');
  let pathname = '/';
  const { ProtectedRoute } = load('components/ProtectedRoute.tsx', {
    '@/context/AuthContext': { useAuth: () => ({ user: currentUser, isAuthenticated: true, isLoading: false }) },
    '@/constants/roles': roles,
    'react-router': {
      Navigate: ({ to }) => React.createElement('span', null, `redirect:${to}`),
      useLocation: () => ({ pathname }),
    },
  });
  const render = () => renderToStaticMarkup(React.createElement(ProtectedRoute, {
    element: React.createElement('div', null, 'allowed-page'), allowedRoles: roles.SELF_MEAL_ROLES,
  }));
  for (const personalPath of roles.PERSONAL_MEAL_PATHS) {
    pathname = personalPath;
    assert.match(render(), /redirect:\//);
    pathname = `${personalPath}/`;
    assert.match(render(), /redirect:\//);
  }
  pathname = '/meal-registration';
  for (const account of [user('employee', 'employee'), user('named_manager', 'manager')]) {
    currentUser = account;
    assert.match(render(), /allowed-page/);
  }
  currentUser = user('quanly', 'manager');
  pathname = '/meal-schedule';
  assert.match(render(), /allowed-page/);
});
