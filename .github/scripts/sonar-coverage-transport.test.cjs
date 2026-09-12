const assert = require('node:assert/strict')
const { describe, it } = require('node:test')

const {
  rewriteLcov,
  toRepositoryPath,
} = require('./sonar-coverage-transport.cjs')

const OPTIONS = {
  workspace: '/home/runner/work/klicker-uzh/klicker-uzh',
  repository: 'uzh-bf/klicker-uzh',
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
})
