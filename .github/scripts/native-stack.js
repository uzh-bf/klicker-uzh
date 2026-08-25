const crypto = require('node:crypto')
const MAX_COMPARE_FILES = 300

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex')
}

function stackId(value) {
  if (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 200 &&
    !/[\p{Cc}\p{Cf}]/u.test(value)
  ) {
    return value
  }
  if (Number.isSafeInteger(value) && value > 0) return String(value)
  return ''
}

function stackRecordIsValid(record) {
  return (
    record &&
    Number.isSafeInteger(record.number) &&
    record.number > 0 &&
    typeof record.state === 'string' &&
    typeof record.draft === 'boolean' &&
    stackRecordHeadSha(record) !== ''
  )
}

function stackRecordHeadSha(record) {
  const sha = record?.head?.sha ?? record?.head_sha
  return /^[0-9a-f]{40}$/.test(sha ?? '') ? sha : ''
}

function repositoryMatches(pull, repository) {
  return (
    pull.base?.repo?.full_name === repository &&
    pull.head?.repo?.full_name === repository
  )
}

function pullIdentityIsValid(pull, repository, expectedNumber) {
  return (
    pull &&
    typeof pull === 'object' &&
    (expectedNumber == null || pull.number === expectedNumber) &&
    repositoryMatches(pull, repository) &&
    typeof pull.base?.ref === 'string' &&
    typeof pull.head?.ref === 'string' &&
    /^[0-9a-f]{40}$/.test(pull.base?.sha ?? '') &&
    /^[0-9a-f]{40}$/.test(pull.head?.sha ?? '')
  )
}

async function defaultGetPull({ github, context, pullNumber }) {
  const response = await github.rest.pulls.get({
    owner: context.repo.owner,
    repo: context.repo.repo,
    pull_number: pullNumber,
  })
  return response.data
}

async function compareRange({ github, context, baseSha, headSha }) {
  const params = {
    owner: context.repo.owner,
    repo: context.repo.repo,
  }
  if (typeof github.rest.repos.compareCommitsWithBasehead === 'function') {
    return github.rest.repos.compareCommitsWithBasehead({
      ...params,
      basehead: `${baseSha}...${headSha}`,
    })
  }
  if (typeof github.rest.repos.compareCommits === 'function') {
    return github.rest.repos.compareCommits({
      ...params,
      base: baseSha,
      head: headSha,
    })
  }
  return null
}

async function resolveNativeStackMembership({
  github,
  context,
  pullNumber,
  pull,
  getPull = (number) => defaultGetPull({ github, context, pullNumber: number }),
}) {
  if (typeof github.request !== 'function') {
    return { valid: false, reason: 'native stack API is unavailable' }
  }
  const response = await github.request('GET /repos/{owner}/{repo}/stacks', {
    owner: context.repo.owner,
    repo: context.repo.repo,
    pull_request: pullNumber,
    per_page: 100,
    headers: { accept: 'application/vnd.github+json' },
  })
  if (!Array.isArray(response.data)) {
    return {
      valid: false,
      reason: 'native stack API returned a malformed list',
    }
  }
  const stacks = []
  for (const stack of response.data) {
    if (
      !stackId(stack?.id) ||
      !Array.isArray(stack.pull_requests) ||
      stack.pull_requests.length === 0 ||
      !stack.pull_requests.every(stackRecordIsValid)
    ) {
      return {
        valid: false,
        reason: 'native stack API returned a malformed stack',
      }
    }
    const numbers = stack.pull_requests.map((record) => record.number)
    if (new Set(numbers).size !== numbers.length) {
      return {
        valid: false,
        reason: 'native stack API returned duplicate members',
      }
    }
    stacks.push({
      id: stackId(stack.id),
      pull_requests: stack.pull_requests,
    })
  }
  const matches = stacks.filter((stack) =>
    stack.pull_requests.some((record) => record.number === pullNumber)
  )
  if (matches.length === 0) return null
  if (matches.length !== 1) {
    return { valid: false, reason: 'pull request belongs to multiple stacks' }
  }

  const stack = matches[0]
  const repository = `${context.repo.owner}/${context.repo.repo}`
  const members = []
  const reasons = []
  for (const record of stack.pull_requests) {
    let memberPull
    try {
      memberPull =
        record.number === pullNumber
          ? (pull ?? (await getPull(record.number)))
          : await getPull(record.number)
    } catch {
      reasons.push(`could not fetch stack member ${record.number}`)
      continue
    }
    if (!memberPull || typeof memberPull !== 'object') {
      reasons.push(`stack member ${record.number} returned no PR data`)
      continue
    }
    members.push({ number: record.number, record, pull: memberPull })
    if (
      memberPull.state !== 'open' ||
      memberPull.draft ||
      !pullIdentityIsValid(memberPull, repository, record.number) ||
      stackRecordHeadSha(record) !== memberPull.head?.sha ||
      record.state !== memberPull.state ||
      record.draft !== memberPull.draft
    ) {
      reasons.push(
        `stack member ${record.number} is not open and ready in the repository`
      )
    }
  }

  const topRecord = stack.pull_requests.at(-1)
  const topNumber = topRecord?.number
  const topMember = members.find(({ number }) => number === topNumber)
  const top = pullIdentityIsValid(topMember?.pull, repository, topNumber)
    ? topMember.pull
    : undefined
  if (members.length !== stack.pull_requests.length) {
    reasons.push('stack member data is incomplete')
  }
  if (members[0]) {
    if (
      members[0].pull.base?.ref !== context.payload.repository.default_branch ||
      members[0].pull.base?.repo?.full_name !== repository
    ) {
      reasons.push('stack root does not target the default branch')
    }
  }
  for (let index = 1; index < members.length; index += 1) {
    const parent = members[index - 1].pull
    const child = members[index].pull
    if (
      child.base?.ref !== parent.head?.ref ||
      child.base?.sha !== parent.head?.sha ||
      child.base?.repo?.full_name !== repository
    ) {
      reasons.push(`stack edge ${index} does not match its parent head exactly`)
    }
  }

  const ranges = []
  if (reasons.length === 0) {
    for (let index = 0; index < members.length; index += 1) {
      const baseSha =
        index === 0
          ? members[0].pull.base.sha
          : members[index - 1].pull.head.sha
      const comparison = await compareRange({
        github,
        context,
        baseSha,
        headSha: members[index].pull.head.sha,
      })
      if (comparison?.data?.status !== 'ahead') {
        reasons.push(
          `stack layer ${index + 1} is not a strict descendant range`
        )
      }
      if (
        !Array.isArray(comparison?.data?.files) ||
        comparison.data.files.length >= MAX_COMPARE_FILES
      ) {
        reasons.push(
          `stack layer ${index + 1} did not return a complete bounded file list`
        )
      }
      ranges.push({
        baseSha,
        headSha: members[index].pull.head.sha,
        response: comparison,
      })
    }
  }

  const numbers = stack.pull_requests.map((record) => record.number)
  const identities = members.map(({ number, pull: memberPull }) => ({
    base_ref: memberPull.base?.ref,
    base_sha: memberPull.base?.sha,
    head_ref: memberPull.head?.ref,
    head_sha: memberPull.head?.sha,
    number,
  }))
  const identityDigest =
    members.length === stack.pull_requests.length &&
    members.every(({ number, pull: memberPull }) =>
      pullIdentityIsValid(memberPull, repository, number)
    )
      ? sha256(JSON.stringify(identities))
      : ''
  return {
    valid: reasons.length === 0,
    reason: reasons.join('; '),
    id: stack.id,
    members,
    ranges,
    numbers,
    orderDigest: sha256(JSON.stringify(numbers)),
    identityDigest,
    position: numbers.indexOf(pullNumber),
    topHeadSha: stackRecordHeadSha(topRecord),
    topNumber,
    top,
  }
}

module.exports = {
  compareRange,
  MAX_COMPARE_FILES,
  resolveNativeStackMembership,
}
