const fs = require('fs')
const path = require('path')

const shardIndex = parseInt(process.argv[2], 10)
const numShards = Math.max(1, parseInt(process.argv[3], 10) || 5)
if (isNaN(shardIndex) || shardIndex < 1 || shardIndex > numShards) {
  console.error(`Invalid shard index. Must be between 1 and ${numShards}.`)
  process.exit(1)
}

const testsDir = path.join(__dirname, '../../playwright/tests')
const allFiles = fs
  .readdirSync(testsDir)
  .filter((file) => file.endsWith('.spec.ts'))

// Load timings from playwright/timings.json
const timingsPath = path.join(__dirname, '../../playwright/timings.json')
let timings = { durations: [] }
if (fs.existsSync(timingsPath)) {
  try {
    timings = JSON.parse(fs.readFileSync(timingsPath, 'utf8'))
  } catch (err) {
    console.error('Error parsing timings.json:', err)
  }
}

// Map of spec file to duration
const durationMap = new Map()
for (const entry of timings.durations) {
  // Normalize spec path to just the filename
  const baseName = path.basename(entry.spec)
  durationMap.set(baseName, entry.duration)
}

// Map each file to its estimated/historical duration
const filesWithDuration = allFiles.map((file) => {
  return {
    file,
    duration: durationMap.has(file) ? durationMap.get(file) : 30, // default to 30s for new tests
  }
})

// Sort files by duration descending for the greedy bin-packing algorithm
filesWithDuration.sort((a, b) => b.duration - a.duration)

// Initialize shards
const shards = Array.from({ length: numShards }, () => ({
  files: [],
  totalDuration: 0,
}))

// Distribute files using greedy bin-packing
for (const item of filesWithDuration) {
  // Find the shard with the smallest total duration
  let minShard = shards[0]
  for (let i = 1; i < numShards; i++) {
    if (shards[i].totalDuration < minShard.totalDuration) {
      minShard = shards[i]
    }
  }
  minShard.files.push(item.file)
  minShard.totalDuration += item.duration
}

// Select the files for the requested shard
const targetFiles = shards[shardIndex - 1].files

// Map files to their relative path from the playwright package directory
const relativePaths = targetFiles.map((file) => `tests/${file}`)
console.log(relativePaths.join(' '))
