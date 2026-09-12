const fs = require('node:fs')
const path = require('node:path')

const DEFAULT_DURATION_SECONDS = 30
const SELECTED_FALLBACK_DURATION_SECONDS = 120
const SELECTED_TARGET_SHARD_SECONDS = 600
const SELECTED_MAX_SHARDS = 4
const SUPPORTED_TIMING_VERSION = 1
const SUPPORTED_PROFILE_VERSION = 1

function compareNames(a, b) {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

function fail(message) {
  throw new Error(message)
}

function canonicalProfile(profile) {
  if (typeof profile !== 'string') {
    fail('every profile group needs a profile string')
  }

  const apps = profile.split(',').map((app) => app.trim())
  if (apps.length === 0 || apps.some((app) => app.length === 0)) {
    fail(`profile ${JSON.stringify(profile)} contains an empty app`)
  }

  return [...new Set(apps)].sort(compareNames).join(',')
}

function parseProfileManifest(manifest, allFiles) {
  if (!manifest || manifest.version !== SUPPORTED_PROFILE_VERSION) {
    fail(`unsupported profile schema version ${manifest?.version}`)
  }
  if (!Array.isArray(manifest.groups) || manifest.groups.length === 0) {
    fail('profile groups must be a non-empty array')
  }

  const activeFiles = new Set(allFiles)
  const profiles = new Map()

  for (const group of manifest.groups) {
    const profile = canonicalProfile(group?.profile)
    if (!Array.isArray(group.specs) || group.specs.length === 0) {
      fail(`profile ${profile} needs at least one spec`)
    }

    for (const spec of group.specs) {
      if (typeof spec !== 'string' || !spec.endsWith('.spec.ts')) {
        fail(`profile ${profile} contains an invalid spec ${spec}`)
      }
      if (!activeFiles.has(spec)) {
        fail(`profile ${profile} references inactive spec ${spec}`)
      }
      if (profiles.has(spec)) {
        fail(`spec ${spec} is assigned to more than one profile`)
      }
      profiles.set(spec, profile)
    }
  }

  const missingFiles = allFiles.filter((file) => !profiles.has(file))
  if (missingFiles.length > 0) {
    fail(`active specs without a profile: ${missingFiles.join(', ')}`)
  }

  return profiles
}

function parseTimings(timings, allFiles, warn = console.error) {
  if (!timings || !Array.isArray(timings.durations)) {
    fail('durations must be an array')
  }
  if (
    timings.version !== undefined &&
    timings.version !== SUPPORTED_TIMING_VERSION
  ) {
    fail(`unsupported timing schema version ${timings.version}`)
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
    warn(`Ignoring stale timing entries: ${staleFiles.join(', ')}`)
  }

  const unknownFiles = allFiles.filter((file) => !durationMap.has(file))
  if (unknownFiles.length > 0) {
    warn(
      `Using ${DEFAULT_DURATION_SECONDS}s fallback for untimed specs: ${unknownFiles.join(', ')}`
    )
  }

  return durationMap
}

function profileUnion(files, profiles) {
  return canonicalProfile(files.map((file) => profiles.get(file)).join(','))
}

function buildShardPlans(allFiles, durationMap, profiles, numShards) {
  if (!Number.isInteger(numShards) || numShards < 1) {
    fail(`shard count ${numShards} must be a positive integer`)
  }
  if (numShards > allFiles.length) {
    fail(
      `shard count ${numShards} exceeds ${allFiles.length} active spec files`
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
    let targetIndex = 0
    for (let index = 1; index < numShards; index++) {
      if (shards[index].totalDuration < shards[targetIndex].totalDuration) {
        targetIndex = index
      }
    }

    shards[targetIndex].files.push(item.file)
    shards[targetIndex].totalDuration += item.duration
  }

  return shards.map((shard, index) => ({
    version: 1,
    shardIndex: index + 1,
    shardTotal: numShards,
    files: shard.files.map((file) => `tests/${file}`),
    estimatedDuration: shard.totalDuration,
    profile: profileUnion(shard.files, profiles),
  }))
}

function positiveMedian(values) {
  const positiveValues = values
    .filter((value) => typeof value === 'number' && Number.isFinite(value))
    .filter((value) => value > 0)
    .sort((a, b) => a - b)

  if (positiveValues.length === 0) return null

  const middle = Math.floor(positiveValues.length / 2)
  if (positiveValues.length % 2 === 1) return positiveValues[middle]
  return (positiveValues[middle - 1] + positiveValues[middle]) / 2
}

function selectedDurationMap(selectedFiles, durationMap, profiles) {
  const durationsByProfile = new Map()
  const knownDurations = []
  for (const [file, duration] of durationMap.entries()) {
    if (!profiles.has(file)) continue
    knownDurations.push(duration)
    const profile = profiles.get(file)
    const profileDurations = durationsByProfile.get(profile) ?? []
    profileDurations.push(duration)
    durationsByProfile.set(profile, profileDurations)
  }
  const globalMedian = positiveMedian(knownDurations)
  const selectedDurations = new Map()

  for (const file of selectedFiles) {
    const directDuration = durationMap.get(file)
    if (
      typeof directDuration === 'number' &&
      Number.isFinite(directDuration) &&
      directDuration > 0
    ) {
      selectedDurations.set(file, directDuration)
      continue
    }

    const profile = profiles.get(file)
    const profileMedian = positiveMedian(durationsByProfile.get(profile) ?? [])
    selectedDurations.set(
      file,
      profileMedian ?? globalMedian ?? SELECTED_FALLBACK_DURATION_SECONDS
    )
  }

  return selectedDurations
}

function selectedShardCount(selectedFiles, durationMap) {
  const totalDuration = [...selectedFiles].reduce(
    (total, file) => total + durationMap.get(file),
    0
  )
  return Math.min(
    SELECTED_MAX_SHARDS,
    selectedFiles.length,
    Math.max(1, Math.ceil(totalDuration / SELECTED_TARGET_SHARD_SECONDS))
  )
}

function buildSelectedShardPlans(selectedFiles, durationMap, profiles) {
  if (!Array.isArray(selectedFiles) || selectedFiles.length === 0) {
    fail('selected spec files must be a non-empty array')
  }
  if (new Set(selectedFiles).size !== selectedFiles.length) {
    fail('selected spec files must be unique')
  }
  for (const file of selectedFiles) {
    if (typeof file !== 'string' || !profiles.has(file)) {
      fail(`selected spec ${file} has no validated profile`)
    }
  }

  const estimates = selectedDurationMap(selectedFiles, durationMap, profiles)
  const numShards = selectedShardCount(selectedFiles, estimates)
  return buildShardPlans(selectedFiles, estimates, profiles, numShards)
}

function readJson(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (error) {
    fail(`could not parse ${label} at ${filePath}: ${error.message}`)
  }
}

function planShards({ testsDir, timingsPath, profilesPath, numShards }) {
  const allFiles = fs
    .readdirSync(testsDir)
    .filter((file) => file.endsWith('.spec.ts'))
    .sort(compareNames)
  const timings = readJson(timingsPath, 'timings')
  const manifest = readJson(profilesPath, 'profiles')
  const durationMap = parseTimings(timings, allFiles)
  const profiles = parseProfileManifest(manifest, allFiles)

  return buildShardPlans(allFiles, durationMap, profiles, numShards)
}

function main(argv = process.argv.slice(2)) {
  if (
    argv.length < 2 ||
    argv.length > 3 ||
    (argv.length === 3 && argv[2] !== '--json')
  ) {
    fail('expected <shardIndex> <numShards> [--json]')
  }

  const shardIndex = Number(argv[0])
  const numShards = Number(argv[1])
  const json = argv[2] === '--json'

  if (
    !Number.isInteger(shardIndex) ||
    !Number.isInteger(numShards) ||
    numShards < 1 ||
    shardIndex < 1 ||
    shardIndex > numShards
  ) {
    fail(`shard index ${argv[0]} must be between 1 and ${numShards}`)
  }

  const repositoryRoot = path.join(__dirname, '../..')
  const plans = planShards({
    testsDir: path.join(repositoryRoot, 'playwright/tests'),
    timingsPath: path.join(repositoryRoot, 'playwright/timings.json'),
    profilesPath: path.join(repositoryRoot, 'playwright/profiles.json'),
    numShards,
  })
  const plan = plans[shardIndex - 1]
  // GitHub injects this diagnostic label; it does not affect cached task output.
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: runner diagnostics only
  const runnerName = process.env.RUNNER_NAME ?? 'unknown runner'

  console.error(
    `Playwright shard ${shardIndex}/${numShards} on ${runnerName}: ${plan.files.length} specs, ${plan.estimatedDuration.toFixed(3)}s estimated, profile ${plan.profile}`
  )
  console.log(json ? JSON.stringify(plan) : plan.files.join(' '))
}

if (require.main === module) {
  try {
    main()
  } catch (error) {
    console.error(`Playwright shard planning failed: ${error.message}`)
    process.exitCode = 1
  }
}

module.exports = {
  DEFAULT_DURATION_SECONDS,
  SELECTED_FALLBACK_DURATION_SECONDS,
  SELECTED_MAX_SHARDS,
  SELECTED_TARGET_SHARD_SECONDS,
  buildShardPlans,
  buildSelectedShardPlans,
  canonicalProfile,
  parseProfileManifest,
  parseTimings,
  planShards,
  positiveMedian,
  selectedDurationMap,
  selectedShardCount,
}
