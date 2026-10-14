import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { chunkPath, remapEntry, sourcePath } from './collect.mjs'

test('source allowlist rejects vendors, server code, traversal and unknown maps', () => {
  assert.equal(
    sourcePath('turbopack:///[project]/apps/auth/src/pages/index.tsx'),
    'apps/auth/src/pages/index.tsx'
  )
  for (const value of [
    'node_modules/lib/index.js',
    'apps/auth/src/pages/api/session.ts',
    'apps/auth/src/types/foo.ts',
    'apps/auth/src/pages/../secret.ts',
    'apps/auth/src/index.test.ts',
    'apps/auth/src/pages/_document.tsx',
    'apps/chat/src/page.tsx',
  ]) {
    assert.equal(sourcePath(`turbopack:///[project]/${value}`), null)
  }
  assert.equal(sourcePath('webpack:///apps/auth/src/pages/index.tsx'), null)
})
test('chunk lookup admits only same-origin build assets without queries', () => {
  const origin = 'http://127.0.0.1:3010'
  assert.equal(
    chunkPath(`${origin}/_next/static/chunks/a.js`, origin, '/repo'),
    '/repo/apps/auth/.next/static/chunks/a.js'
  )
  for (const url of [
    'https://external.invalid/a.js',
    `${origin}/api/a.js`,
    `${origin}/_next/static/a.js?token=synthetic`,
    'about:blank',
  ]) {
    assert.equal(chunkPath(url, origin, '/repo'), null)
  }
})
test('indexed maps remap verified source and retain uncovered branches', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'coverage-map-test-'))
  try {
    const source =
      'function choose(value) { return value ? 1 : 0 };choose(true)'
    const file = 'apps/auth/src/choice.js'
    await mkdir(path.join(root, 'apps/auth/src'), { recursive: true })
    await writeFile(path.join(root, file), source)
    const rawMap = {
      version: 3,
      sources: [`turbopack:///[project]/${file}`],
      sourcesContent: [source],
      names: [],
      mappings: 'AAAA' + ',CAAC'.repeat(source.length - 1),
    }
    const entry = {
      source,
      functions: [
        {
          functionName: '',
          isBlockCoverage: true,
          ranges: [{ startOffset: 0, endOffset: source.length, count: 1 }],
        },
        {
          functionName: 'choose',
          isBlockCoverage: true,
          ranges: [
            { startOffset: 0, endOffset: source.indexOf('}') + 1, count: 1 },
            {
              startOffset: source.indexOf('0'),
              endOffset: source.indexOf('0') + 1,
              count: 0,
            },
          ],
        },
      ],
    }
    const result = await remapEntry(
      entry,
      {
        version: 3,
        sections: [{ offset: { line: 0, column: 0 }, map: rawMap }],
      },
      root
    )
    assert.equal(result.files[0].path, file)
    assert.equal(Object.keys(result.data).length, 1)
    const branches = Object.values(Object.values(result.data)[0].b).flat()
    assert(
      branches.includes(0),
      'The unvisited false branch must stay uncovered'
    )
    assert(branches.includes(1), 'The visited true branch must be covered')
    await writeFile(path.join(root, file), '// stale source')
    await assert.rejects(remapEntry(entry, rawMap, root), /Source map mismatch/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
