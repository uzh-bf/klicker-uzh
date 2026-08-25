const fs = require('fs')
const path = require('path')

const DEFAULT_DURATION_SECONDS = 30
const SUPPORTED_TIMING_VERSION = 1
function compareNames(a, b) {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

function fail(message) {
  console.error(`Invalid Playwright shard timing input: ${message}`)
  process.exit(1)
}

const shardIndex = Number(process.argv[2])
const numShards = Number(process.argv[3])
if (
  !Number.isInteger(shardIndex) ||
  !Number.isInteger(numShards) ||
  numShards < 1 ||
  shardIndex < 1 ||
  shardIndex > numShards
) {
  fail(`shard index ${process.argv[2]} must be between 1 and ${numShards}`)
}

const testsDir = path.join(__dirname, '../../playwright/tests')
const allFiles = fs
  .readdirSync(testsDir)
  .filter((file) => file.endsWith('.spec.ts'))
  .sort(compareNames)

if (numShards > allFiles.length) {
  fail(`shard count ${numShards} exceeds ${allFiles.length} active spec files`)
}

const timingsPath = path.join(__dirname, '../../playwright/timings.json')
let timings = { durations: [] }
try {
  timings = JSON.parse(fs.readFileSync(timingsPath, 'utf8'))
} catch (error) {
  fail(`could not parse ${timingsPath}: ${error.message}`)
}

if (!timings || !Array.isArray(timings.durations)) {
  fail('durations must be an array')
}

if (
  timings.version !== undefined &&
  timings.version !== SUPPORTED_TIMING_VERSION
) {
  fail(`unsupported schema version ${timings.version}`)
}

const durationMap = new Map()
for (const entry of timings.durations) {
  if (!entry || typeof entry.spec !== 'string') {
    fail('every duration entry needs a spec path')
  }

  const baseName = path.basename(entry.spec)
  if (!baseName.endsWith('.spec.ts')) {
    fail(`spec path ${entry.spec} is not an active spec file`)
  }

  if (durationMap.has(baseName)) {
    fail(`duplicate timing entries for ${baseName}`)
  }

  if (
    typeof entry.duration !== 'number' ||
    !Number.isFinite(entry.duration) ||
    entry.duration <= 0
  ) {
    fail(`duration for ${baseName} must be a positive finite number`)
  }

  durationMap.set(baseName, entry.duration)
}

const staleFiles = [...durationMap.keys()]
  .filter((file) => !allFiles.includes(file))
  .sort(compareNames)
if (staleFiles.length > 0) {
  console.error(`Ignoring stale timing entries: ${staleFiles.join(', ')}`)
}

const unknownFiles = allFiles.filter((file) => !durationMap.has(file))
if (unknownFiles.length > 0) {
  console.error(
    `Using ${DEFAULT_DURATION_SECONDS}s fallback for untimed specs: ${unknownFiles.join(', ')}`
  )
}

const filesWithDuration = allFiles.map((file) => ({
  file,
  duration: durationMap.get(file) ?? DEFAULT_DURATION_SECONDS,
}))

filesWithDuration.sort(
  (a, b) => b.duration - a.duration || compareNames(a.file, b.file)
)

const shards = Array.from({ length: numShards }, () => ({
  files: [],
  totalDuration: 0,
}))

for (const item of filesWithDuration) {
  let minShardIndex = 0
  for (let i = 1; i < numShards; i++) {
    if (shards[i].totalDuration < shards[minShardIndex].totalDuration) {
      minShardIndex = i
    }
  }

  shards[minShardIndex].files.push(item.file)
  shards[minShardIndex].totalDuration += item.duration
}

const targetFiles = shards[shardIndex - 1].files
const relativePaths = targetFiles.map((file) => `tests/${file}`)
console.log(relativePaths.join(' '))
