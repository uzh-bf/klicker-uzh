const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const BODY_LIMIT = 60_000
const validSha = (sha) => typeof sha === 'string' && /^[a-f0-9]{40}$/.test(sha)

function codeSpan(value) {
  const text = value.replace(/[\r\n\t]/g, ' ')
  const width = (text.match(/`+/g) || []).reduce(
    (maximum, run) => Math.max(maximum, run.length + 1),
    1
  )
  const delimiter = '`'.repeat(width)
  return `${delimiter} ${text} ${delimiter}`
}

function renderChangelog(evidence, repository, categories) {
  const url = `https://github.com/${repository}`
  const commitLink = (sha) => `[${sha.slice(0, 10)}](${url}/commit/${sha})`
  const { sourceSha, targetSha, headSha, sourceIncluded } = evidence
  const comparison = `${url}/compare/${targetSha}...${headSha}`
  const metadata = [
    '## Revisions',
    '',
    `| Target | Source | Sync head | Source included |`,
    '| --- | --- | --- | --- |',
    `| ${commitLink(targetSha)} | ${commitLink(sourceSha)} | ${commitLink(headSha)} | ${sourceIncluded ? 'yes' : 'pending'} |`,
    '',
    `[Changes](${comparison}) · [Pending source](${url}/compare/${headSha}...${sourceSha})`,
  ].join('\n')
  const sections = [
    { key: 'imported', title: 'Changelog', entries: evidence.imported },
    { key: 'mergeEdits', title: 'Merge edits', entries: evidence.mergeEdits },
    {
      key: 'additional',
      title: 'Additional sync-branch changes',
      entries: evidence.additional,
    },
  ]
  const omitted = {}
  const rendered = {}
  const omission = (commits, paths) =>
    `- Omitted: ${commits} commits, ${paths} paths; [complete comparison](${comparison}).`
  // Reserve every footer at its maximum count before allocating whole entries.
  const marker = '<!-- sync-pr-changelog -->'
  let budget = BODY_LIMIT - Buffer.byteLength(`${marker}\n\n${metadata}\n`)
  for (const section of sections) {
    const paths = section.entries.reduce(
      (count, entry) => count + (entry.paths?.length || 0),
      0
    )
    budget -= Buffer.byteLength(
      `\n\n## ${section.title}\n\n${omission(section.entries.length, paths)}\n`
    )
    if (section.key === 'imported') {
      for (const category of categories) {
        if (section.entries.some((entry) => entry.category === category)) {
          budget -= Buffer.byteLength(`\n\n### ${category}\n\n`)
        }
      }
    }
    omitted[section.key] = { commits: 0, paths: 0 }
    rendered[section.key] = []
  }
  for (const key of ['mergeEdits', 'additional', 'imported']) {
    const section = sections.find((entry) => entry.key === key)
    for (const entry of section.entries) {
      const details = entry.unsupported
        ? ' · analysis: unsupported merge with more than two parents'
        : ''
      const lines = [
        `- ${commitLink(entry.sha)} ${codeSpan(entry.subject)}${details}`,
      ]
      for (const file of entry.paths || []) lines.push(`  - ${codeSpan(file)}`)
      const item = lines.join('\n')
      const bytes = Buffer.byteLength(`${item}\n\n`)
      if (bytes <= budget) {
        rendered[key].push({ item, category: entry.category })
        budget -= bytes
      } else {
        omitted[key].commits++
        omitted[key].paths += entry.paths?.length || 0
      }
    }
  }
  const body =
    [
      marker,
      ...sections.flatMap(({ key, title }) => {
        if (!rendered[key].length && !omitted[key].commits) return []
        const entries =
          key === 'imported'
            ? categories.flatMap((category) => {
                const items = rendered[key]
                  .filter((entry) => entry.category === category)
                  .map(({ item }) => item)
                return items.length
                  ? [`### ${category}\n\n${items.join('\n')}`]
                  : []
              })
            : rendered[key].map(({ item }) => item)
        if (omitted[key].commits) {
          const footer = omission(omitted[key].commits, omitted[key].paths)
          if (key === 'imported') entries.unshift(footer)
          else entries.push(footer)
        }
        return [`## ${title}\n\n${entries.join('\n\n')}`]
      }),
      metadata,
    ].join('\n\n') + '\n'
  if (Buffer.byteLength(body) > BODY_LIMIT)
    throw new Error('Changelog body budget exceeded')
  return { body, omitted }
}

function createChangelog({
  repository = 'uzh-bf/klicker-uzh',
  token,
  remote,
} = {}) {
  if (!/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/.test(repository)) {
    throw new Error('Invalid changelog repository')
  }
  const remoteUrl = remote ?? `https://github.com/${repository}.git`
  if (
    remote != null &&
    (typeof remote !== 'string' || !path.isAbsolute(remote))
  ) {
    throw new Error('Analysis remote override must be a local absolute path')
  }
  const { types } = require(path.join(__dirname, '../../.versionrc.js'))
  if (
    !Array.isArray(types) ||
    !types.length ||
    types.some(
      (entry) =>
        !entry ||
        typeof entry.type !== 'string' ||
        !/^[a-z][a-z0-9-]*$/i.test(entry.type) ||
        typeof entry.section !== 'string' ||
        !entry.section.trim() ||
        /[\r\n]/.test(entry.section)
    )
  ) {
    throw new Error('Invalid changelog categories')
  }
  const sectionsByType = new Map(
    types.map(({ type, section }) => [type.toLowerCase(), section])
  )
  const categories = [
    ...new Set([...types.map(({ section }) => section), 'Other']),
  ]
  const categoryFor = (subject) => {
    const match = /^([a-z][a-z0-9-]*)(?:\([^()\r\n]+\))?!?: +\S/i.exec(subject)
    return sectionsByType.get(match?.[1].toLowerCase()) || 'Other'
  }
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-pr-changelog-'))
  const gitDirectory = path.join(directory, 'history.git')
  const environment = {
    PATH: process.env.PATH,
    HOME: directory,
    TMPDIR: directory,
    LANG: 'C',
    LC_ALL: 'C',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_SYSTEM: os.devNull,
    GIT_CONFIG_GLOBAL: os.devNull,
    GIT_ATTR_NOSYSTEM: '1',
    GIT_NO_REPLACE_OBJECTS: '1',
    GIT_TERMINAL_PROMPT: '0',
    GIT_LFS_SKIP_SMUDGE: '1',
  }
  if (token && remote == null) {
    environment.GIT_CONFIG_COUNT = '1'
    environment.GIT_CONFIG_KEY_0 = 'http.https://github.com/.extraheader'
    environment.GIT_CONFIG_VALUE_0 = `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`).toString('base64')}`
  }
  const fetched = new Set()
  let closed = false
  const run = (args, extraEnvironment = {}, acceptedStatuses = []) => {
    if (closed) throw new Error('Changelog analysis is closed')
    try {
      return execFileSync(
        '/usr/bin/git',
        [
          '-c',
          `core.hooksPath=${os.devNull}`,
          '-c',
          `core.attributesFile=${os.devNull}`,
          '-c',
          'gc.auto=0',
          '-c',
          'maintenance.auto=false',
          ...args,
        ],
        {
          cwd: directory,
          env: { ...environment, ...extraEnvironment },
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: 60_000,
          maxBuffer: 64 * 1024 * 1024,
        }
      )
    } catch (error) {
      if (acceptedStatuses.includes(error.status)) return null
      // Suppress Git stderr and command environment, which can carry credentials.
      throw new Error('Changelog Git analysis failed')
    }
  }
  const git = (args, extraEnvironment, acceptedStatuses) =>
    run(
      ['--git-dir', gitDirectory, ...args],
      extraEnvironment,
      acceptedStatuses
    )
  const close = () => {
    if (closed) return
    closed = true
    fs.rmSync(directory, { recursive: true, force: true })
  }
  try {
    run(['init', '--bare', '--template=', gitDirectory])
    git(['config', 'remote.origin.url', remoteUrl])
    git(['config', 'remote.origin.promisor', 'true'])
    git(['config', 'remote.origin.partialclonefilter', 'blob:none'])
  } catch (error) {
    close()
    throw error
  }
  return {
    close,
    async generate({ sourceSha, targetSha, headSha }) {
      if (![sourceSha, targetSha, headSha].every(validSha)) {
        throw new Error('Invalid changelog revision')
      }
      const missing = [...new Set([sourceSha, targetSha, headSha])].filter(
        (sha) => !fetched.has(sha)
      )
      if (missing.length) {
        git([
          'fetch',
          '--no-tags',
          '--no-write-fetch-head',
          '--no-recurse-submodules',
          '--filter=blob:none',
          'origin',
          ...missing,
        ])
        if (git(['rev-parse', '--is-shallow-repository']).trim() !== 'false') {
          throw new Error('Changelog requires complete commit history')
        }
        for (const sha of missing) {
          git(['cat-file', '-e', `${sha}^{commit}`])
          fetched.add(sha)
        }
      }
      const lines = (text) => text.trim().split('\n').filter(Boolean)
      const source = new Set(
        lines(git(['rev-list', sourceSha, '--not', targetSha]))
      )
      const candidates = lines(
        git(['rev-list', '--topo-order', headSha, '--not', targetSha])
      )
      const imported = []
      const mergeEdits = []
      const additional = []
      for (const sha of candidates) {
        const subject = git(['show', '--no-patch', '--format=%s', sha]).replace(
          /\n$/,
          ''
        )
        if (source.has(sha)) {
          imported.push({ sha, subject, category: categoryFor(subject) })
          continue
        }
        const parents =
          lines(git(['show', '--no-patch', '--format=%P', sha]))[0]?.split(
            ' '
          ) || []
        if (parents.length > 2) {
          mergeEdits.push({ sha, subject, paths: [], unsupported: true })
          continue
        }
        const args =
          parents.length === 2
            ? [
                'show',
                '--remerge-diff',
                '--format=',
                '--name-only',
                '-z',
                '--no-renames',
                '--no-ext-diff',
                '--no-textconv',
                sha,
              ]
            : [
                'diff-tree',
                '--root',
                '--no-commit-id',
                '-r',
                '--name-only',
                '-z',
                '--no-renames',
                '--no-ext-diff',
                '--no-textconv',
                sha,
              ]
        const files = git(
          args,
          parents.length === 2 ? { GIT_ATTR_SOURCE: parents[0] } : {}
        )
          .split('\0')
          .filter(Boolean)
        const entry = { sha, subject, paths: files }
        if (parents.length === 2) {
          if (files.length) mergeEdits.push(entry)
        } else {
          additional.push(entry)
        }
      }
      const evidence = {
        sourceSha,
        targetSha,
        headSha,
        sourceIncluded:
          git(['merge-base', '--is-ancestor', sourceSha, headSha], {}, [1]) !==
          null,
        imported,
        mergeEdits,
        additional,
      }
      return {
        ...evidence,
        ...renderChangelog(evidence, repository, categories),
      }
    },
  }
}

module.exports = { createChangelog }
