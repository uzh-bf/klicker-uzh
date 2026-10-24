'use strict'

const { execFileSync } = require('node:child_process')

const CONFIG_PATH = '.github/open-code-review/repository.json'
const DEFAULT_CONTEXT_ROOTS = ['docs', '.agents/skills']

function validContextPath(value) {
  return (
    typeof value === 'string' &&
    value.length <= 300 &&
    /^[\w.@()\[\]/-]+$/.test(value) &&
    !value.startsWith('/') &&
    !value
      .split('/')
      .some((part) => !part || ['.', '..', '.git'].includes(part)) &&
    !/(^|\/)\.env(?:\.|$)|\.(?:pem|key)$/i.test(value)
  )
}

function validateRepositoryConfig(value) {
  const fail = () => {
    throw new Error('invalid_repository_config')
  }
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some(
      (key) =>
        ![
          'schema',
          'profile',
          'contextRoots',
          'rootFiles',
          'guides',
          'publicLibraries',
        ].includes(key)
    ) ||
    value.schema !== 'ocr-repository/v1' ||
    (value.profile !== undefined && value.profile !== 'draft-v1')
  )
    fail()
  const list = (name, fallback, limit, valid) => {
    const values = value[name] === undefined ? fallback : value[name]
    if (
      !Array.isArray(values) ||
      values.length > limit ||
      values.some((item) => !valid(item)) ||
      new Set(values).size !== values.length
    )
      fail()
    return [...values]
  }
  const contextRoots = list(
    'contextRoots',
    DEFAULT_CONTEXT_ROOTS,
    16,
    validContextPath
  )
  const rootFiles = list(
    'rootFiles',
    [],
    16,
    (file) =>
      validContextPath(file) && !file.includes('/') && file.endsWith('.md')
  )
  const guides = list(
    'guides',
    [],
    16,
    (file) =>
      validContextPath(file) &&
      file.endsWith('.md') &&
      (rootFiles.includes(file) ||
        contextRoots.some((root) => file.startsWith(`${root}/`)))
  )
  const publicLibraries = list(
    'publicLibraries',
    [],
    32,
    (id) =>
      typeof id === 'string' &&
      id.length <= 128 &&
      /^\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(id) &&
      !id.split('/').some((part) => ['.', '..'].includes(part))
  )
  return {
    schema: 'ocr-repository/v1',
    profile: 'draft-v1',
    contextRoots,
    rootFiles,
    guides,
    publicLibraries,
  }
}

function policyGit(repo, args, maxBuffer = 524288) {
  return execFileSync('git', args, {
    cwd: repo,
    encoding: 'utf8',
    timeout: 5000,
    maxBuffer,
    env: {
      ...Object.fromEntries(
        ['PATH', 'HOME', 'TMPDIR', 'LANG'].flatMap((name) =>
          typeof process.env[name] === 'string'
            ? [[name, process.env[name]]]
            : []
        )
      ),
      GIT_NO_LAZY_FETCH: '1',
      GIT_TERMINAL_PROMPT: '0',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function readPolicyBlob(repo, policy, file, limit = 262144) {
  if (!/^[a-f0-9]{40}$/.test(policy) || !validContextPath(file))
    throw new Error('invalid_repository_config')
  const entry = policyGit(repo, [
    'ls-tree',
    '-z',
    '-l',
    policy,
    '--',
    file,
  ]).replace(/\0$/, '')
  const match = /^(100644|100755) blob ([a-f0-9]{40})\s+(\d+)\t([^\0]+)$/.exec(
    entry
  )
  if (!match || match[4] !== file || Number(match[3]) > limit)
    throw new Error('invalid_policy_blob')
  const content = policyGit(repo, ['cat-file', 'blob', match[2]], limit + 1)
  if (content.includes('\0')) throw new Error('invalid_policy_blob')
  return content
}

function readRepositoryConfig(repo, policy) {
  try {
    if (!/^[a-f0-9]{40}$/.test(policy)) throw new Error('invalid_revision')
    const exists = policyGit(repo, [
      'ls-tree',
      '--name-only',
      policy,
      '--',
      CONFIG_PATH,
    ]).trim()
    const config = validateRepositoryConfig(
      exists
        ? JSON.parse(readPolicyBlob(repo, policy, CONFIG_PATH, 32768))
        : { schema: 'ocr-repository/v1' }
    )
    for (const file of new Set([...config.rootFiles, ...config.guides]))
      readPolicyBlob(repo, policy, file)
    return config
  } catch {
    throw new Error('invalid_repository_config')
  }
}

module.exports = {
  readRepositoryConfig,
  readPolicyBlob,
  validateRepositoryConfig,
  validContextPath,
}
