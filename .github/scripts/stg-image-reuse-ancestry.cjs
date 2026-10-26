'use strict'

const { execFileSync } = require('node:child_process')
const { fetchImageRevision } = require('./stg-release-promoter.js')

const SHA_PATTERN = /^[0-9a-f]{40}$/

function compareCommits({ repository, sourceSha, candidateSha }) {
  return execFileSync(
    'gh',
    [
      'api',
      `repos/${repository}/compare/${sourceSha}...${candidateSha}`,
      '--jq',
      '.status',
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  ).trim()
}

// Use the same immutable OCI revision and ancestry rule as the promoter.
// Identical inputs can also occur on unrelated branches after a squash merge.
async function canReuseImage({
  image,
  digest,
  candidateSha,
  repository,
  getImageRevision = fetchImageRevision,
  compare = compareCommits,
}) {
  if (!SHA_PATTERN.test(candidateSha ?? '')) {
    throw new Error('image reuse requires a full candidate SHA')
  }
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository ?? '')) {
    throw new Error('image reuse requires an owner/repository')
  }
  const sourceSha = await getImageRevision({ repository: image, digest })
  if (!SHA_PATTERN.test(sourceSha ?? '')) {
    throw new Error('image reuse requires a full OCI revision SHA')
  }
  if (sourceSha === candidateSha) return true
  const status = await compare({ repository, sourceSha, candidateSha })
  if (status === 'ahead' || status === 'identical') return true
  if (status === 'behind' || status === 'diverged') return false
  throw new Error('image reuse received an unknown commit comparison status')
}

if (require.main === module) {
  canReuseImage({
    image: process.env.IMAGE,
    digest: process.env.DIGEST,
    candidateSha: process.env.SHA,
    repository: process.env.GITHUB_REPOSITORY,
  })
    .then((reuse) => process.stdout.write(`${reuse}\n`))
    .catch((error) => {
      console.error(
        `::error::image reuse ancestry check failed: ${error.message}`
      )
      process.exitCode = 1
    })
}

module.exports = { canReuseImage }
