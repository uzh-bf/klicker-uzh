const fs = require('node:fs')
const { spawn } = require('node:child_process')

function counters(text, prefix) {
  const line = text.split('\n').find((entry) => entry.startsWith(prefix))
  if (!line) return null
  const values = line.trim().split(/\s+/).slice(1).map(Number)
  return values.every(Number.isFinite) ? values : null
}

function pressure(text) {
  const result = {}
  for (const kind of ['some', 'full']) {
    const match = text.match(new RegExp(`^${kind} .*total=(\\d+)$`, 'm'))
    result[kind] = match ? Number(match[1]) : null
  }
  return result
}

function snapshot(read = (path) => fs.readFileSync(path, 'utf8')) {
  const safe = (path) => {
    try {
      return read(path)
    } catch {
      return ''
    }
  }
  const cpu = counters(safe('/proc/stat'), 'cpu ')
  const memory = safe('/proc/meminfo').match(/^MemAvailable:\s+(\d+) kB$/m)
  return {
    timestamp: new Date().toISOString(),
    scope: 'procfs-visible-system',
    // Exclude guest/guest_nice: Linux already includes them in user/nice.
    cpuTicks: cpu && cpu.length >= 8 ? cpu.slice(0, 8) : null,
    memoryAvailableKb: memory ? Number(memory[1]) : null,
    pressureMicroseconds: Object.fromEntries(
      ['cpu', 'memory', 'io'].map((kind) => [
        kind,
        pressure(safe(`/proc/pressure/${kind}`)),
      ])
    ),
  }
}

function run(output, command, args) {
  let fd
  try {
    fd = fs.openSync(output, 'wx', 0o600)
  } catch {
    console.error('Resource sampling unavailable; continuing command')
  }
  let count = 0
  const sample = () => {
    if (count >= 361 || fd === undefined) return
    count++
    try {
      fs.writeSync(fd, `${JSON.stringify(snapshot())}\n`)
    } catch {
      // Diagnostics never determine the command result.
    }
  }
  sample()
  const timer = setInterval(() => {
    sample()
    if (count >= 361 || fd === undefined) clearInterval(timer)
  }, 10000)
  const child = spawn(command, args, { stdio: 'inherit', detached: true })
  let killTimer
  const forward = (signal) => {
    try {
      process.kill(-child.pid, signal)
    } catch {}
    if (!killTimer) {
      killTimer = setTimeout(() => {
        try {
          process.kill(-child.pid, 'SIGKILL')
        } catch {}
      }, 5000)
    }
  }
  const interrupt = () => forward('SIGINT')
  const terminate = () => forward('SIGTERM')
  process.on('SIGINT', interrupt)
  process.on('SIGTERM', terminate)
  child.on('error', () => console.error('Wrapped command could not start'))
  child.on('close', (code, signal) => {
    clearInterval(timer)
    clearTimeout(killTimer)
    sample()
    if (fd !== undefined) {
      try {
        fs.closeSync(fd)
      } catch {}
    }
    process.removeListener('SIGINT', interrupt)
    process.removeListener('SIGTERM', terminate)
    process.exitCode = code ?? (signal === 'SIGINT' ? 130 : 143)
  })
}

if (require.main === module) {
  const [output, command, ...args] = process.argv.slice(2)
  if (!output || !command) process.exit(2)
  run(output, command, args)
}

module.exports = { counters, pressure, snapshot }
