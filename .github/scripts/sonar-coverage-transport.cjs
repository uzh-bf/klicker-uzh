// GitHub transport for the SonarCloud coverage collector. Kept separate from the
// decision logic in sonar-coverage-inputs.cjs so the decision table can be
// covered without a token, a network, or an Actions run.

const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const API = 'https://api.github.com'

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
    // The SF entries inside LCOV carry the absolute paths of the producing
    // checkout, which is the same runner path as this analysis checkout, so
    // SonarCloud resolves them against this project base. An unmapped entry
    // surfaces as missing coverage rather than a satisfied metric.
    async extractLcov(artifactId, label) {
      const directory = await unpack(artifactId)
      const files = walk(directory, (file) => file === 'lcov.info')
      const workspace = process.env.GITHUB_WORKSPACE || process.cwd()
      const slug = String(label || artifactId).replace(/[^a-zA-Z0-9]+/g, '-')
      const target = path.join(workspace, 'coverage-inputs', slug)
      fs.mkdirSync(target, { recursive: true })
      const reports = []
      files.forEach((file, index) => {
        const name =
          files.length === 1 ? 'lcov.info' : 'lcov-' + index + '.info'
        fs.copyFileSync(file, path.join(target, name))
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
