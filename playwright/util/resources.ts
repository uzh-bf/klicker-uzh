import fs from 'node:fs'
import path from 'node:path'

/**
 * Values-free CI diagnostics: samples cgroup memory/PID usage and kernel
 * pressure metrics during a shard run so a renderer crash can be attributed
 * to resource exhaustion instead of being guessed at from test failures.
 * Samples contain counters only - never request bodies or user content.
 */

const SAMPLE_INTERVAL_MS = 15_000

function readCount(filePath: string): number | null {
  try {
    const value = parseInt(fs.readFileSync(filePath, 'utf8').trim(), 10)
    return Number.isNaN(value) ? null : value
  } catch {
    return null
  }
}

function readFileOrNull(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf8').trim()
  } catch {
    return null
  }
}

function readMemInfoKb(key: string): number | null {
  const contents = readFileOrNull('/proc/meminfo')
  if (!contents) return null
  const match = contents.match(new RegExp('^' + key + ':\\s+(\\d+) kB', 'm'))
  return match ? parseInt(match[1], 10) : null
}

// Root-level memory.events is often unreadable inside the CI job container,
// while scoped cgroups that own the browser processes remain readable. Probe
// a small static list so an OOM kill by a scoped limit cannot stay invisible.
const MEMORY_EVENTS_PATHS = [
  '/sys/fs/cgroup/memory.events',
  '/sys/fs/cgroup/init.scope/memory.events',
  '/sys/fs/cgroup/system.slice/memory.events',
]

interface MemoryEventsSample {
  path: string
  oom: number | null
  oomKill: number | null
}

function readMemoryEvents(): MemoryEventsSample[] {
  const results: MemoryEventsSample[] = []
  for (const filePath of MEMORY_EVENTS_PATHS) {
    const contents = readFileOrNull(filePath)
    if (contents === null) continue
    results.push({
      path: filePath,
      oom: extractCounter(contents, 'oom'),
      oomKill: extractCounter(contents, 'oom_kill'),
    })
  }
  return results
}

function extractCounter(contents: string, key: string): number | null {
  const pattern = new RegExp('^' + key + ' (\\d+)$', 'm')
  const value = contents.match(pattern)?.[1]
  return value === undefined ? null : parseInt(value, 10)
}

function readSelfLimits() {
  const contents = readFileOrNull('/proc/self/limits')
  if (!contents) return { fdSoft: null, fdHard: null }
  const match = contents.match(/^Max open files\s+(\d+)\s+(\d+)/m)
  return match
    ? { fdSoft: parseInt(match[1], 10), fdHard: parseInt(match[2], 10) }
    : { fdSoft: null, fdHard: null }
}

function readDevShm() {
  try {
    const stats = fs.statfsSync('/dev/shm')
    const mb = (blocks: number) =>
      Math.round((blocks * stats.bsize) / 1024 / 1024)
    return { totalMb: mb(stats.blocks), availMb: mb(stats.bavail) }
  } catch {
    return { totalMb: null, availMb: null }
  }
}

function sampleOnce() {
  const memoryCurrentKb = readCount('/sys/fs/cgroup/memory.current')
  const memoryMaxKb = readCount('/sys/fs/cgroup/memory.max')
  const pidsCurrent = readCount('/sys/fs/cgroup/pids.current')
  const pidsMax = readCount('/sys/fs/cgroup/pids.max')
  const psiSummary = ['cpu', 'memory', 'io'].map((resource) => {
    const line = readFileOrNull('/proc/pressure/' + resource)
    const some = line?.match(/^some .*avg10=([\d.]+)/)?.[1]
    const full = line?.match(/^full .*avg10=([\d.]+)/)?.[1]
    return { resource, someAvg10: some ?? null, fullAvg10: full ?? null }
  })
  const fdLimits = readSelfLimits()
  const devShm = readDevShm()
  const fileNr = (() => {
    const line = readFileOrNull('/proc/sys/fs/file-nr')
    if (!line) return null
    const parts = line.split(/\s+/).filter(Boolean)
    return parts.length >= 3
      ? { allocated: parseInt(parts[0], 10), max: parseInt(parts[2], 10) }
      : null
  })()
  return {
    ts: new Date().toISOString(),
    cgroupMemoryCurrentMb:
      memoryCurrentKb === null ? null : Math.round(memoryCurrentKb / 1024),
    cgroupMemoryMaxMb:
      memoryMaxKb === null || memoryMaxKb > 4_000_000
        ? null
        : Math.round(memoryMaxKb / 1024),
    cgroupMemoryEvents: readMemoryEvents(),
    cgroupPidsCurrent: pidsCurrent,
    cgroupPidsMax: pidsMax && pidsMax < 1_000_000 ? pidsMax : null,
    procFdSoftLimit: fdLimits.fdSoft,
    procFdHardLimit: fdLimits.fdHard,
    shmTotalMb: devShm.totalMb,
    shmAvailMb: devShm.availMb,
    hostFdAllocated: fileNr ? fileNr.allocated : null,
    hostFdMax: fileNr ? fileNr.max : null,
    hostMemAvailableMb: (() => {
      const kb = readMemInfoKb('MemAvailable')
      return kb === null ? null : Math.round(kb / 1024)
    })(),
    pressure: psiSummary,
    loadAvg1: (() => {
      const load = readFileOrNull('/proc/loadavg')
      return load ? parseFloat(load.split(' ')[0]) : null
    })(),
  }
}

let samplerTimer: NodeJS.Timeout | null = null

export function startResourceSampler() {
  if (samplerTimer) return
  const outputDir = path.join(process.cwd(), 'test-results')
  const outputFile = path.join(outputDir, 'resource-samples.jsonl')
  try {
    fs.mkdirSync(outputDir, { recursive: true })
    fs.writeFileSync(outputFile, '')
  } catch {
    return
  }
  const writeSample = () => {
    try {
      fs.appendFileSync(outputFile, JSON.stringify(sampleOnce()) + '\n')
    } catch {
      // A failed diagnostic sample must never fail the suite.
    }
  }
  writeSample()
  samplerTimer = setInterval(writeSample, SAMPLE_INTERVAL_MS)
  samplerTimer.unref()
}

export function stopResourceSampler() {
  if (!samplerTimer) return
  clearInterval(samplerTimer)
  samplerTimer = null
}

/**
 * True when the failure indicates the renderer/browser died rather than an
 * application assertion. These failures must surface immediately: navigating
 * again cannot revive a dead renderer and only masks the original error.
 */
export function isRendererCrash(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return [
    'Target crashed',
    'Page crashed',
    'Target page, context or browser has been closed',
    'Session closed',
  ].some((pattern) => message.includes(pattern))
}
