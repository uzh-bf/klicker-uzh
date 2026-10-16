const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { describe, it } = require('node:test')

const {
  collectSources,
  packageRootsFromArtifact,
  resolvePackageRoot,
  rewriteLcov,
  toRepositoryPath,
  workspacePackages,
} = require('./sonar-coverage-transport.cjs')

const OPTIONS = {
  workspace: '/home/runner/work/klicker-uzh/klicker-uzh',
  repository: 'uzh-bf/klicker-uzh',
}

// Builds the smallest checkout that can answer which package produced a report:
// the workspace groups, the package manifests, and the covered sources.
function createWorkspace(t, files) {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'sonar-coverage-'))
  t.after(() => fs.rmSync(workspace, { recursive: true, force: true }))
  for (const file of files) {
    const target = path.join(workspace, file)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, '')
  }
  return workspace
}

function lcov(sources) {
  return sources
    .map((source) => 'SF:' + source + '\nLF:1\nLH:1\nend_of_record\n')
    .join('')
}

describe('toRepositoryPath', () => {
  it('strips the producing workspace prefix', () => {
    assert.equal(
      toRepositoryPath(
        '/home/runner/work/klicker-uzh/klicker-uzh/packages/util/src/index.ts',
        OPTIONS
      ),
      'packages/util/src/index.ts'
    )
  })

  it('strips a differently laid out checkout at the repository root', () => {
    assert.equal(
      toRepositoryPath(
        '/build/klicker-uzh/klicker-uzh/apps/chat/src/chat.ts',
        OPTIONS
      ),
      'apps/chat/src/chat.ts'
    )
  })

  it('keeps an unmappable path unchanged', () => {
    assert.equal(
      toRepositoryPath('/elsewhere/vendor/lib.js', OPTIONS),
      '/elsewhere/vendor/lib.js'
    )
  })

  it('keeps a repository-relative path unchanged', () => {
    assert.equal(
      toRepositoryPath('packages/util/src/index.ts', OPTIONS),
      'packages/util/src/index.ts'
    )
  })
})

describe('rewriteLcov', () => {
  it('rewrites SF entries and leaves other records intact', () => {
    const content = [
      'TN:',
      'SF:/home/runner/work/klicker-uzh/klicker-uzh/packages/util/src/index.ts',
      'LF:2',
      'LH:1',
      'end_of_record',
      'SF:/home/runner/work/klicker-uzh/klicker-uzh/packages/grading/src/x.ts',
      'LF:4',
      'LH:4',
      'end_of_record',
      '',
    ].join('\n')
    const rewritten = rewriteLcov(content, OPTIONS)
    assert.match(rewritten, /^SF:packages\/util\/src\/index\.ts$/m)
    assert.match(rewritten, /^SF:packages\/grading\/src\/x\.ts$/m)
    assert.match(rewritten, /^LF:2$/m)
    assert.match(rewritten, /^end_of_record$/m)
    assert.doesNotMatch(rewritten, /SF:\//)
  })

  it('does not rewrite an SF-like fragment inside a line', () => {
    const content =
      'TN:SF:/not/a/record\nSF:/home/runner/work/klicker-uzh/klicker-uzh/a.ts\n'
    const rewritten = rewriteLcov(content, OPTIONS)
    assert.equal(rewritten, 'TN:SF:/not/a/record\nSF:a.ts\n')
  })

  it('prefixes a package-relative SF entry with the producing package', () => {
    assert.equal(
      rewriteLcov(lcov(['src/index.ts']), {
        ...OPTIONS,
        prefix: 'packages/grading',
      }),
      'SF:packages/grading/src/index.ts\nLF:1\nLH:1\nend_of_record\n'
    )
  })

  it('maps an absolute SF entry from its own path, not from the prefix', () => {
    assert.equal(
      rewriteLcov(
        lcov([
          '/home/runner/work/klicker-uzh/klicker-uzh/packages/util/src/a.ts',
        ]),
        { ...OPTIONS, prefix: 'packages/grading' }
      ),
      'SF:packages/util/src/a.ts\nLF:1\nLH:1\nend_of_record\n'
    )
  })
})

describe('collectSources', () => {
  it('lists the recorded sources and trims surrounding space', () => {
    assert.deepEqual(collectSources('TN:\nSF:src/a.ts \nSF:src/b.ts\n'), [
      'src/a.ts',
      'src/b.ts',
    ])
  })
})

describe('packageRootsFromArtifact', () => {
  it('keeps a repository-relative package path', () => {
    assert.equal(
      packageRootsFromArtifact('apps/chat/coverage/lcov.info'),
      'apps/chat'
    )
  })

  it('keeps the package name when the artifact dropped a prefix', () => {
    assert.equal(
      packageRootsFromArtifact('grading/coverage/lcov.info'),
      'grading'
    )
  })

  it('reports no package when the artifact root is the coverage directory', () => {
    assert.equal(packageRootsFromArtifact('lcov.info'), '')
  })
})

describe('workspacePackages', () => {
  it('lists the package directories of both workspace groups only', (t) => {
    const workspace = createWorkspace(t, [
      'apps/chat/package.json',
      'apps/chat/next.config.ts',
      'packages/util/package.json',
      'packages/util/node_modules/@klicker-uzh/grading/package.json',
      'deploy/not-a-package/package.json',
    ])
    assert.deepEqual(workspacePackages(workspace), [
      'apps/chat',
      'packages/util',
    ])
  })
})

describe('resolvePackageRoot', () => {
  it('resolves the package from a repository-relative artifact path', (t) => {
    const workspace = createWorkspace(t, [
      'apps/chat/package.json',
      'apps/chat/next.config.ts',
      'packages/util/package.json',
      'packages/util/src/auth.ts',
    ])
    assert.equal(
      resolvePackageRoot(
        lcov(['next.config.ts']),
        workspace,
        'apps/chat/coverage/lcov.info'
      ),
      'apps/chat'
    )
  })

  it('disambiguates equal file names through the artifact path', (t) => {
    const workspace = createWorkspace(t, [
      'packages/grading/package.json',
      'packages/grading/src/index.ts',
      'packages/markdown/package.json',
      'packages/markdown/src/index.ts',
    ])
    assert.equal(
      resolvePackageRoot(
        lcov(['src/index.ts']),
        workspace,
        'grading/coverage/lcov.info'
      ),
      'packages/grading'
    )
  })

  it('rejects a source that no workspace package contains', (t) => {
    const workspace = createWorkspace(t, [
      'packages/grading/package.json',
      'packages/grading/src/index.ts',
    ])
    assert.throws(
      () =>
        resolvePackageRoot(
          lcov(['src/missing.ts']),
          workspace,
          'grading/coverage/lcov.info'
        ),
      /cannot be mapped to one package: no recorded source resolves under packages\/grading/
    )
  })

  it('maps a report whose generated source is absent from the checkout', (t) => {
    const workspace = createWorkspace(t, [
      'packages/graphql/package.json',
      'packages/graphql/codegen.ts',
      'packages/graphql/src/builder.ts',
      'packages/graphql/src/index.ts',
    ])
    assert.equal(
      resolvePackageRoot(
        lcov(['codegen.ts', 'src/builder.ts', 'src/index.ts', 'src/ops.ts']),
        workspace,
        'graphql/coverage/lcov.info'
      ),
      'packages/graphql'
    )
  })

  it('rejects an ambiguous report when the artifact path carries no package', (t) => {
    const workspace = createWorkspace(t, [
      'packages/grading/package.json',
      'packages/grading/src/index.ts',
      'packages/markdown/package.json',
      'packages/markdown/src/index.ts',
    ])
    assert.throws(
      () => resolvePackageRoot(lcov(['src/index.ts']), workspace, 'lcov.info'),
      /cannot be mapped to one package: multiple workspace packages match/
    )
  })

  it('rejects a pnpm-linked copy collected from node_modules', (t) => {
    const workspace = createWorkspace(t, [
      'packages/grading/package.json',
      'packages/grading/src/index.ts',
    ])
    assert.throws(
      () =>
        resolvePackageRoot(
          lcov(['src/index.ts']),
          workspace,
          'packages/graphql/node_modules/@klicker-uzh/grading/coverage/lcov.info'
        ),
      /cannot be mapped to one package/
    )
  })

  it('rejects a report that records no source', (t) => {
    const workspace = createWorkspace(t, ['packages/grading/package.json'])
    assert.throws(
      () =>
        resolvePackageRoot('TN:\n', workspace, 'grading/coverage/lcov.info'),
      /records no source files to map/
    )
  })
})
