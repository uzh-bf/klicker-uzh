import fs from 'node:fs'
import path from 'node:path'

/**
 * Values-free CI diagnostics: samples cgroup memory/PID usage and kernel
 * pressure metrics during a shard run so a renderer crash can be attributed
 * to resource exhaustion instead of being guessed at from test failures.
 * Samples contain counters only — never request bodies or user content.
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

function sampleOnce() {
  const memoryCurrentKb = readCount('/sys/fs/cgroup/memory.current')
  const memoryMaxKb = readCount('/sys/fs/cgroup/memory.max')
  const pidsCurrent = readCount('/sys/fs/cgroup/pids.current')
  const pidsMax = readCount('/sys/fs/cgroup/pids.max')
  const memoryEvents = readFileOrNull('/sys/fs/cgroup/memory.events')
  const psiSummary = ['cpu', 'memory', 'io'].map((resource) => {
    const line = readFileOrNull('/proc/pressure/' + resource)
    const some = line?.match(/^some .*avg10=([\d.]+)/)?.[1]
    const full = line?.match(/^full .*avg10=([\d.]+)/)?.[1]
    return { resource, someAvg10: some ?? null, fullAvg10: full ?? null }
  })
  return {
    ts: new Date().toISOString(),
    cgroupMemoryCurrentMb:
      memoryCurrentKb === null ? null : Math.round(memoryCurrentKb / 1024),
    cgroupMemoryMaxMb:
      memoryMaxKb === null || memoryMaxKb > 4_000_000
        ? null
        : Math.round(memoryMaxKb / 1024),
    cgroupMemoryEventsOom: memoryEvents?.match(/oom (\\d+)/)?.[1] ?? null,
    cgroupMemoryEventsOomKill:
      memoryEvents?.match(/oom_kill (\\d+)/)?.[1] ?? null,
    cgroupPidsCurrent: pidsCurrent,
    cgroupPidsMax: pidsMax && pidsMax < 1_000_000 ? pidsMax : null,
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
