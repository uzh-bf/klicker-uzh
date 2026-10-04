import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'

const require = createRequire(import.meta.url)
const ts = require('typescript')

// Compile the real entry points while preventing their presentation imports
// from booting React or an application provider during the server guard tests.
async function loadEntry(path, environment) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
    },
  })
  const exports = {}
  const calls = []
  runInNewContext(outputText, {
    exports,
    process: { env: { NODE_ENV: environment }, cwd: () => '/draft/apps/pwa' },
    require: (name) => {
      if (name === 'node:fs/promises')
        return {
          readFile: async () => {
            calls.push('read')
            throw new Error('Missing fixture')
          },
        }
      if (name === 'node:path') return require(name)
      if (name.includes('/messages/'))
        throw new Error('Messages must not load outside development')
      return {}
    },
  })
  return { exports, calls }
}

function response() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(key, value) {
      this.headers[key] = value
    },
    status(code) {
      this.statusCode = code
      return this
    },
    end() {
      return this
    },
  }
}

for (const app of ['frontend-pwa', 'frontend-manage']) {
  for (const environment of ['production', 'test', undefined]) {
    test(`${app} denies draft pages in ${environment ?? 'an unset environment'}`, async () => {
      const { exports } = await loadEntry(
        `../../../apps/${app}/src/pages/dpo-draft.tsx`,
        environment
      )
      const result = await exports.getServerSideProps({ locale: 'de' })
      assert.equal(result.notFound, true)
      assert.equal(result.props, undefined)
    })
  }
}

test('draft assets fail closed outside development before file access', async () => {
  for (const environment of ['production', 'test', undefined]) {
    const { exports, calls } = await loadEntry(
      '../src/dpoDraftAssets.ts',
      environment
    )
    const res = response()
    await exports.default({ query: { asset: 'guide' }, method: 'GET' }, res)
    assert.equal(res.statusCode, 404)
    assert.equal(res.headers['Cache-Control'], 'no-store')
    assert.equal(calls.length, 0)
  }
})

test('asset allowlist rejects arbitrary names, arrays and unsupported methods', async () => {
  const { exports, calls } = await loadEntry(
    '../src/dpoDraftAssets.ts',
    'development'
  )
  for (const asset of [
    '../README.md',
    '__proto__',
    'constructor',
    ['guide'],
    undefined,
  ]) {
    const res = response()
    await exports.default({ query: { asset }, method: 'GET' }, res)
    assert.equal(res.statusCode, 404)
  }
  const res = response()
  await exports.default({ query: { asset: 'guide' }, method: 'POST' }, res)
  assert.equal(res.statusCode, 405)
  assert.equal(calls.length, 0)
})

test('missing allowlisted assets fail closed', async () => {
  const { exports, calls } = await loadEntry(
    '../src/dpoDraftAssets.ts',
    'development'
  )
  const res = response()
  await exports.default({ query: { asset: 'guide' }, method: 'GET' }, res)
  assert.equal(res.statusCode, 404)
  assert.equal(calls.length, 1)
})
