// Load actual TypeScript with the project's compiler; replace only native storage.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const ts = require('typescript');
function createSourceLoader(overrides = {}) {
  const cache = new Map();
  function load(filename) {
    filename = path.resolve(filename);
    if (Object.hasOwn(overrides, filename)) return overrides[filename];
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      fileName: filename,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    const fallback = createRequire(filename);
    function requireSource(specifier) {
      if (Object.hasOwn(overrides, specifier)) return overrides[specifier];
      if (specifier.startsWith('.')) {
        const base = path.resolve(path.dirname(filename), specifier);
        for (const candidate of [base, `${base}.ts`, path.join(base, 'index.ts')]) {
          if (fs.existsSync(candidate) && fs.statSync(candidate).isFile() && candidate.endsWith('.ts')) return load(candidate);
        }
      }
      return fallback(specifier);
    }
    vm.runInThisContext(`(function(require,module,exports){${compiled}\n})`, { filename })(requireSource, module, module.exports);
    return module.exports;
  }
  return load;
}
function createTestApp(overrides = {}) {
  const source = path.resolve(__dirname, '../../src');
  const values = new Map();
  const storage = {
    async getItem(key) { return values.get(key) ?? null; },
    async setItem(key, value) { values.set(key, value); },
    async removeItem(key) { values.delete(key); },
    async getObject(key) { const raw = values.get(key); return raw ? JSON.parse(raw) : null; },
    async setObject(key, value) { values.set(key, JSON.stringify(value)); },
  };
  const load = createSourceLoader({ ...overrides, [path.join(source, 'utils/storage.ts')]: { storage } });
  return { load: relative => load(path.join(source, relative)), storage, values };
}
module.exports = { createTestApp };
