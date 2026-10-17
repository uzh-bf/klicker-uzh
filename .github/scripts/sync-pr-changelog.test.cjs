const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const { createChangelog } = require('./sync-pr-changelog.cjs')

function fixture(t) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'sync-changelog-test-')
  )
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const env = {
    PATH: process.env.PATH,
    HOME: directory,
    LANG: 'C',
    LC_ALL: 'C',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: os.devNull,
    GIT_AUTHOR_NAME: 'Synthetic',
    GIT_AUTHOR_EMAIL: 'synthetic@example.invalid',
    GIT_COMMITTER_NAME: 'Synthetic',
    GIT_COMMITTER_EMAIL: 'synthetic@example.invalid',
  }
  const git = (...args) =>
    execFileSync('git', ['-c', `core.hooksPath=${os.devNull}`, ...args], {
      cwd: directory,
      env,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()
  git('init', '--template=', '-b', 'main')
  git('config', 'uploadpack.allowFilter', 'true')
  const commit = (file, text, subject = file) => {
    fs.writeFileSync(path.join(directory, file), text)
    git('add', '--all')
    git('commit', '-m', subject)
    return git('rev-parse', 'HEAD')
  }
  const root = commit('shared.txt', 'root\n')
  const generator = createChangelog({ remote: directory })
  t.after(() => generator.close())
  return { directory, git, commit, root, generator }
}

test('classifies actual imported history, merge edits and separate fixes while source changes remain pending', async (t) => {
  const { directory, git, commit, root, generator } = fixture(t)
  git('checkout', '-b', 'target')
  const targetSha = commit('shared.txt', 'target\n')
  git('checkout', '-b', 'source', root)
  const sourceEdit = commit(
    'shared.txt',
    'source\n',
    'change `code` @someone (#123)'
  )
  git('checkout', '-b', 'feature')
  const feature = commit('feature.txt', 'feature\n')
  git('checkout', 'source')
  const direct = commit('direct.txt', 'direct\n')
  git('merge', '--no-ff', 'feature', '-m', 'include feature')
  const sourceMerge = git('rev-parse', 'HEAD')
  git('checkout', '-b', 'sync')
  assert.throws(() => git('merge', '--no-ff', 'target', '-m', 'merge target'))
  fs.writeFileSync(path.join(directory, 'shared.txt'), 'resolution\n')
  git('add', '--all')
  git('commit', '-m', 'record merge edits')
  const resolution = git('rev-parse', 'HEAD')
  const headSha = commit('separate.txt', 'fix\n')
  git('checkout', 'source')
  const sourceSha = commit('pending.txt', 'pending\n')
  const result = await generator.generate({ sourceSha, targetSha, headSha })
  assert.deepEqual(
    new Set(result.imported.map(({ sha }) => sha)),
    new Set([sourceEdit, feature, direct, sourceMerge])
  )
  assert.equal(result.sourceIncluded, false)
  assert.deepEqual(
    result.mergeEdits.map(({ sha, paths }) => ({ sha, paths })),
    [{ sha: resolution, paths: ['shared.txt'] }]
  )
  assert.deepEqual(
    result.additional.map(({ sha, paths }) => ({ sha, paths })),
    [{ sha: headSha, paths: ['separate.txt'] }]
  )
  assert.equal(
    result.body,
    (await generator.generate({ sourceSha, targetSha, headSha })).body
  )
  assert.ok(result.body.includes(`/commit/${feature}`))
  assert.ok(
    !result.imported.some(({ sha }) =>
      [root, targetSha, sourceSha].includes(sha)
    )
  )
})

test('handles multiple merge bases without dropping either common lineage and ignores a clean merge', async (t) => {
  const { git, commit, root, generator } = fixture(t)
  git('checkout', '-b', 'left', root)
  const left = commit('left.txt', 'left\n')
  git('checkout', '-b', 'right', root)
  const right = commit('right.txt', 'right\n')
  git('merge', '--no-ff', 'left', '-m', 'merge left')
  const rightMerge = git('rev-parse', 'HEAD')
  git('checkout', 'left')
  git('merge', '--no-ff', right, '-m', 'merge right')
  const leftMerge = git('rev-parse', 'HEAD')
  assert.equal(
    git('merge-base', '--all', leftMerge, rightMerge).split('\n').length,
    2
  )
  const sourceSha = commit('source.txt', 'source\n')
  git('checkout', 'right')
  const targetSha = commit('target.txt', 'target\n')
  git('checkout', '-b', 'sync', sourceSha)
  git('merge', '--no-ff', 'right', '-m', 'clean merge')
  const headSha = git('rev-parse', 'HEAD')
  const result = await generator.generate({ sourceSha, targetSha, headSha })
  assert.deepEqual(
    new Set(result.imported.map(({ sha }) => sha)),
    new Set([leftMerge, sourceSha])
  )
  assert.deepEqual(result.mergeEdits, [])
  assert.deepEqual(result.additional, [])
  assert.equal(result.sourceIncluded, true)
  assert.ok(
    !result.imported.some(({ sha }) =>
      [left, right, rightMerge, targetSha].includes(sha)
    )
  )
})

test('reports octopus analysis and omits oversized Unicode entries with exact counts', async (t) => {
  const { git, commit, root, generator } = fixture(t)
  git('checkout', '-b', 'a', root)
  const sourceSha = commit('a.txt', 'a\n', '🙂'.repeat(18_000))
  git('checkout', '-b', 'b', root)
  const b = commit('b.txt', 'b\n')
  git('checkout', '-b', 'c', root)
  const c = commit('c.txt', 'c\n')
  git('checkout', 'a')
  git('merge', '--no-ff', b, c, '-m', 'octopus')
  const headSha = git('rev-parse', 'HEAD')
  const result = await generator.generate({
    sourceSha,
    targetSha: root,
    headSha,
  })
  assert.ok(
    result.mergeEdits.some(
      ({ sha, unsupported }) => sha === headSha && unsupported
    )
  )
  assert.deepEqual(result.omitted.imported, { commits: 1, paths: 0 })
  assert.ok(Buffer.byteLength(result.body) <= 60_000)
  assert.ok(result.body.includes(`/compare/${root}...${headSha}`))
  await assert.rejects(
    generator.generate({ sourceSha: 'f'.repeat(40), targetSha: root, headSha }),
    /Git analysis failed/
  )
  await assert.rejects(
    generator.generate({ sourceSha: '--help', targetSha: root, headSha }),
    /Invalid/
  )
  generator.close()
  await assert.rejects(
    generator.generate({ sourceSha, targetSha: root, headSha }),
    /closed/
  )
})

test('isolates configured executable merge drivers and preserves code-span text boundaries', async (t) => {
  const { directory, git, commit, root } = fixture(t)
  git('checkout', '-b', 'target')
  commit('.gitattributes', 'shared.txt merge=external\n')
  const targetSha = commit('shared.txt', 'target\n')
  git('checkout', '-b', 'source', root)
  commit('.gitattributes', 'shared.txt merge=external\n')
  const sourceSha = commit('shared.txt', 'source\n')
  assert.throws(() => git('merge', '--no-ff', 'target', '-m', 'conflict'))
  const unusualPath = 'path-` @someone #123 GH-123 <tag>.txt'
  fs.writeFileSync(path.join(directory, 'shared.txt'), 'resolution\n')
  fs.writeFileSync(path.join(directory, unusualPath), 'extra\n')
  git('add', '--all')
  git('commit', '-m', '`` @someone #123 GH-123 owner/repo#123 <tag>')
  const headSha = git('rev-parse', 'HEAD')
  const marker = path.join(directory, 'driver-ran')
  const configuration = path.join(directory, 'external.gitconfig')
  fs.writeFileSync(
    configuration,
    `[merge "external"]\n driver = touch ${marker}\n`
  )
  const configurationVariable = 'GIT_CONFIG_GLOBAL'
  const previous = process.env[configurationVariable]
  process.env[configurationVariable] = configuration
  const generator = createChangelog({ remote: directory })
  t.after(() => generator.close())
  try {
    const result = await generator.generate({ sourceSha, targetSha, headSha })
    assert.equal(fs.existsSync(marker), false)
    assert.ok(result.mergeEdits[0].paths.includes(unusualPath))
    assert.ok(
      result.body.includes(
        '``` `` @someone #123 GH-123 owner/repo#123 <tag> ```'
      )
    )
    assert.ok(result.body.includes(`\`\` ${unusualPath} \`\``))
  } finally {
    if (previous === undefined) delete process.env[configurationVariable]
    else process.env[configurationVariable] = previous
  }
})
