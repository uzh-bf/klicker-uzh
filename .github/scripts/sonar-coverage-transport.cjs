// GitHub transport for the SonarCloud coverage collector. Kept separate from the
// decision logic in sonar-coverage-inputs.cjs so the decision table can be
// covered without a token, a network, or an Actions run.

const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const API = 'https://api.github.com'

// LCOV records every source file as an absolute path on the runner that
// produced it. Rewriting those paths to repository-relative form keeps
// SonarCloud's resolution independent of the runner workspace layout, which the
// artifact does not record. A path that cannot be mapped is left untouched and
// surfaces as missing coverage rather than as a satisfied metric.
function toRepositoryPath(filePath, options = {}) {
  const workspace = options.workspace || ''
  if (workspace && filePath.startsWith(workspace + '/')) {
    return filePath.slice(workspace.length + 1)
  }
  const repository = options.repository || ''
  const name = repository.split('/').pop()
  if (name) {
    // Actions checks the repository out at <runner directory>/<name>/<name>, so
    // that pair marks the repository root on a differently laid out runner.
    const marker = '/' + name + '/' + name + '/'
    const index = filePath.indexOf(marker)
    if (index !== -1) {
      return filePath.slice(index + marker.length)
    }
  }
  return filePath
}

function rewriteLcov(content, options) {
  return content.replace(/^SF:(.+)$/gm, (_line, filePath) => {
    const trimmed = filePath.trim()
    if (path.isAbsolute(trimmed)) {
      return 'SF:' + toRepositoryPath(trimmed, options)
    }
    // Vitest writes source records relative to the package it tested, so the
    // package directory resolved for the report supplies the missing prefix.
    return 'SF:' + path.posix.join(options.prefix || '', trimmed)
  })
}

function collectSources(content) {
  return [...content.matchAll(/^SF:(.+)$/gm)].map((match) => match[1].trim())
}

// The upload glob anchors the artifact at some directory above the producing
// package, so the artifact-relative path keeps only the package's last path
// segments: apps/chat/coverage/lcov.info keeps apps/chat, a glob rooted at
// packages keeps grading from packages/grading/coverage/lcov.info. Both ends
// identify the package to within those segments.
function packageRootsFromArtifact(relative) {
  const segments = String(relative).split('/')
  const coverage = segments.lastIndexOf('coverage')
  if (coverage <= 0) return ''
  return segments.slice(0, coverage).join('/')
}

// Workspace package directories produced by the test jobs. Bounded to the two
// workspace groups so a report can never be mapped into node_modules.
function workspacePackages(workspace) {
  const packages = []
  for (const group of ['apps', 'packages']) {
    const groupDirectory = path.join(workspace, group)
    if (!fs.existsSync(groupDirectory)) continue
    for (const entry of fs.readdirSync(groupDirectory, {
      withFileTypes: true,
    })) {
      if (!entry.isDirectory()) continue
      const candidate = group + '/' + entry.name
      if (fs.existsSync(path.join(workspace, candidate, 'package.json'))) {
        packages.push(candidate)
      }
    }
  }
  return packages
}

// Vitest records each source relative to the package it ran in, so a report
// cannot be imported without that package directory. The artifact path supplies
// the package's last segments, and every remaining candidate must also resolve
// every recorded source in this checkout. A report that matches no package or
// more than one stops the import, because importing it would publish a mapping
// that is known to be wrong or ambiguous. This also rejects the pnpm-linked
// copies of a report that an over-broad upload glob would collect from
// node_modules: their recorded paths do not resolve as first-party sources.
function resolvePackageRoot(content, workspace, relative) {
  const sources = collectSources(content)
  if (sources.length === 0) {
    throw new Error(relative + ' records no source files to map')
  }
  const suffix = packageRootsFromArtifact(relative)
  const candidates = workspacePackages(workspace).filter(
    (candidate) =>
      !suffix || candidate === suffix || candidate.endsWith('/' + suffix)
  )
  const resolvable = candidates.filter((candidate) =>
    sources.every((source) =>
      fs.existsSync(path.resolve(workspace, candidate, source))
    )
  )
  if (resolvable.length !== 1) {
    const detail =
      resolvable.length === 0
        ? 'no workspace package contains ' + sources.slice(0, 3).join(', ')
        : 'multiple workspace packages match: ' + resolvable.join(', ')
    throw new Error(relative + ' cannot be mapped to one package: ' + detail)
  }
  return resolvable[0]
}

function createTransport(options) {
  const token = options.token
  const repository = options.repository
  if (!token || !repository) {
    throw new Error('GITHUB_TOKEN and GITHUB_REPOSITORY are required')
  }

  async function requestJson(url) {
    const response = await fetch(url, {
      headers: {
        accept: 'application/vnd.github+json',
        authorization: 'Bearer ' + token,
        'x-github-api-version': '2022-11-28',
      },
    })
    if (!response.ok) {
      throw new Error('GitHub API ' + url + ' returned ' + response.status)
    }
    return response.json()
  }

  function unpack(artifactId) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sonar-coverage-'))
    return (async () => {
      const response = await fetch(
        API +
          '/repos/' +
          repository +
          '/actions/artifacts/' +
          artifactId +
          '/zip',
        {
          headers: {
            accept: 'application/vnd.github+json',
            authorization: 'Bearer ' + token,
            'x-github-api-version': '2022-11-28',
          },
        }
      )
      if (!response.ok) {
        throw new Error('artifact download returned ' + response.status)
      }
      const archive = path.join(directory, 'artifact.zip')
      fs.writeFileSync(archive, Buffer.from(await response.arrayBuffer()))
      execFileSync('unzip', ['-o', '-q', archive, '-d', directory])
      return directory
    })()
  }

  function walk(directory, matches) {
    const found = []
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const candidate = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        found.push(...walk(candidate, matches))
      } else if (matches(entry.name)) {
        found.push(candidate)
      }
    }
    return found
  }

  return {
    async listRuns(workflowFile, headSha) {
      const result = await requestJson(
        API +
          '/repos/' +
          repository +
          '/actions/workflows/' +
          workflowFile +
          '/runs?head_sha=' +
          headSha +
          '&per_page=20'
      )
      return result.workflow_runs || []
    },

    async listArtifacts(runId) {
      const result = await requestJson(
        API + '/repos/' + repository + '/actions/runs/' + runId + '/artifacts'
      )
      return result.artifacts || []
    },

    async readJsonArtifact(artifacts, name) {
      const artifact = (artifacts || []).find((entry) => entry.name === name)
      if (!artifact) return null
      const directory = await unpack(artifact.id)
      const files = walk(directory, (file) => file.endsWith('.json'))
      if (files.length !== 1) {
        throw new Error(
          'expected exactly one JSON file in ' +
            name +
            ', found ' +
            files.length
        )
      }
      return JSON.parse(fs.readFileSync(files[0], 'utf8'))
    },

    // The artifact layout depends on which packages produced reports, so the
    // files are re-homed into one predictable workspace directory per producer.
    // The SF entries inside LCOV are rewritten to repository-relative paths so
    // the import does not depend on both runners sharing a checkout directory.
    async extractLcov(artifactId, label) {
      const directory = await unpack(artifactId)
      const files = walk(directory, (file) => file === 'lcov.info')
      const workspace = process.env.GITHUB_WORKSPACE || process.cwd()
      const rewriteOptions = {
        workspace: workspace,
        repository: repository,
      }
      const slug = String(label || artifactId).replace(/[^a-zA-Z0-9]+/g, '-')
      const target = path.join(workspace, 'coverage-inputs', slug)
      fs.mkdirSync(target, { recursive: true })
      const reports = []
      files.forEach((file, index) => {
        const name =
          files.length === 1 ? 'lcov.info' : 'lcov-' + index + '.info'
        const relative = path
          .relative(directory, file)
          .split(path.sep)
          .join('/')
        const content = fs.readFileSync(file, 'utf8')
        const packageRoot = resolvePackageRoot(content, workspace, relative)
        fs.writeFileSync(
          path.join(target, name),
          rewriteLcov(content, { ...rewriteOptions, prefix: packageRoot })
        )
        reports.push(path.join('coverage-inputs', slug, name))
      })
      return reports
    },

    treeSha() {
      return execFileSync(
        'git',
        ['-c', 'safe.directory=' + process.cwd(), 'rev-parse', 'HEAD^{tree}'],
        { encoding: 'utf8' }
      ).trim()
    },

    now() {
      return Date.now()
    },

    sleep(milliseconds) {
      return new Promise((resolve) => setTimeout(resolve, milliseconds))
    },
  }
}

module.exports = createTransport
module.exports.collectSources = collectSources
module.exports.packageRootsFromArtifact = packageRootsFromArtifact
module.exports.resolvePackageRoot = resolvePackageRoot
module.exports.rewriteLcov = rewriteLcov
module.exports.toRepositoryPath = toRepositoryPath
module.exports.workspacePackages = workspacePackages
