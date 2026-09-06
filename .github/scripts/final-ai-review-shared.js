const crypto = require('node:crypto')

async function getPermission(github, context, username) {
  try {
    const response = await github.rest.repos.getCollaboratorPermissionLevel({
      owner: context.repo.owner,
      repo: context.repo.repo,
      username,
    })
    return response.data.user?.permission ?? response.data.permission ?? ''
  } catch (error) {
    if (error.status === 404) return ''
    throw error
  }
}

async function listCheckRunsForRef({ github, context, ref }) {
  if (
    typeof github.paginate !== 'function' ||
    typeof github.rest.checks?.listForRef !== 'function'
  ) {
    return []
  }
  const checkRuns = await github.paginate(github.rest.checks.listForRef, {
    owner: context.repo.owner,
    repo: context.repo.repo,
    ref,
    filter: 'all',
    per_page: 100,
  })
  return Array.isArray(checkRuns) ? checkRuns : []
}

function repositoryName(context) {
  return `${context.repo.owner}/${context.repo.repo}`
}

function safeFence(value) {
  const runs = String(value).match(/`+/g) ?? []
  const longest = runs.reduce((max, run) => Math.max(max, run.length), 0)
  return '`'.repeat(Math.max(3, longest + 1))
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex')
}

function validDigest(value) {
  return /^[0-9a-f]{64}$/.test(value ?? '')
}

function validSha(value) {
  return /^[0-9a-f]{40}$/.test(value ?? '')
}

function workflowRunIdFromUrl(context, targetUrl) {
  const prefix = `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/`
  if (typeof targetUrl !== 'string' || !targetUrl.startsWith(prefix)) {
    return null
  }
  const value = targetUrl.slice(prefix.length)
  return /^[1-9][0-9]*$/.test(value) ? Number(value) : null
}

function workflowRunUrl(context, runId = context.runId) {
  return `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${runId}`
}

module.exports = {
  getPermission,
  listCheckRunsForRef,
  repositoryName,
  safeFence,
  sha256,
  validDigest,
  validSha,
  workflowRunIdFromUrl,
  workflowRunUrl,
}
