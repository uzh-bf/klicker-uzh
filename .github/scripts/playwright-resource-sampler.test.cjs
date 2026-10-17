const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn, spawnSync } = require('node:child_process')
const { once } = require('node:events')
const { test } = require('node:test')
const { snapshot } = require('./playwright-resource-sampler.cjs')

test('records numeric system metrics without double counting guest CPU', () => {
  const files = {
    '/proc/stat': 'cpu  1 2 3 4 5 6 7 8 9 10\n',
    '/proc/meminfo': 'MemAvailable: 1234 kB\n',
    '/proc/pressure/io': 'some avg10=0.00 avg60=0.00 avg300=0.00 total=42\n',
  }
  const result = snapshot((file) => files[file] || '')
  assert.deepEqual(result.cpuTicks, [1, 2, 3, 4, 5, 6, 7, 8])
  assert.equal(result.memoryAvailableKb, 1234)
  assert.deepEqual(result.pressureMicroseconds.io, { some: 42, full: null })
  assert.equal(result.pressureMicroseconds.cpu.some, null)
})

test('unavailable counters are null rather than idle measurements', () => {
  const result = snapshot(() => {
    throw new Error('unavailable')
  })
  assert.equal(result.cpuTicks, null)
  assert.equal(result.memoryAvailableKb, null)
  assert.deepEqual(result.cgroupMemory, {
    scope: 'current-cgroup-and-descendants',
    currentBytes: null,
    peakBytes: null,
    anonymousBytes: null,
    fileBytes: null,
    kernelBytes: null,
    events: { high: null, max: null, oom: null, oomKill: null },
  })
})

test('attributes memory to the current unified cgroup rather than its parent', () => {
  const files = {
    '/proc/self/cgroup': '0::/jobs/job-a\n',
    '/proc/self/mountinfo':
      '31 25 0:28 / /sys/fs/cgroup rw - cgroup2 cgroup rw\n',
    '/sys/fs/cgroup/memory.current': '99999\n',
    '/sys/fs/cgroup/jobs/job-a/memory.current': '512\n',
    '/sys/fs/cgroup/jobs/job-a/memory.peak': '1024\n',
    '/sys/fs/cgroup/jobs/job-a/memory.stat':
      'anon 128\nfile 256\nkernel 64\nfile_mapped 8\n',
    '/sys/fs/cgroup/jobs/job-a/memory.events':
      'low 2\nhigh 3\nmax 4\noom 5\noom_kill 6\n',
  }
  const result = snapshot((file) => files[file] || '')
  assert.deepEqual(result.cgroupMemory, {
    scope: 'current-cgroup-and-descendants',
    currentBytes: 512,
    peakBytes: 1024,
    anonymousBytes: 128,
    fileBytes: 256,
    kernelBytes: 64,
    events: { high: 3, max: 4, oom: 5, oomKill: 6 },
  })
  assert.equal(JSON.stringify(result).includes('/jobs/'), false)
})

test('resolves namespace roots, subtree mounts and escaped mount points', () => {
  for (const [group, root, mount, directory] of [
    ['/', '/containers/job-a', '/sys/fs/cgroup', '/sys/fs/cgroup'],
    ['/jobs/job-a', '/jobs', '/sys/fs/cgroup', '/sys/fs/cgroup/job-a'],
    ['/jobs/job-a', '/jobs/job-a', '/sys/fs/cgroup', '/sys/fs/cgroup'],
    [
      '/jobs/job-a',
      '/',
      '/sys/cgroup\\040mount',
      '/sys/cgroup mount/jobs/job-a',
    ],
  ]) {
    const files = {
      '/proc/self/cgroup': `0::${group}\n`,
      '/proc/self/mountinfo': `31 25 0:28 ${root} ${mount} rw - cgroup2 cgroup rw\n`,
      [`${directory}/memory.current`]: '17\n',
    }
    assert.equal(
      snapshot((file) => files[file] || '').cgroupMemory.currentBytes,
      17
    )
  }
})

test('does not fall back to parent counters for unsupported or unsafe membership', () => {
  for (const [membership, root] of [
    ['2:memory:/jobs/job-a', '/'],
    ['0::/../jobs/job-a', '/'],
    ['0::/elsewhere', '/jobs'],
  ]) {
    const files = {
      '/proc/self/cgroup': `${membership}\n`,
      '/proc/self/mountinfo': `31 25 0:28 ${root} /sys/fs/cgroup rw - cgroup2 cgroup rw\n`,
      '/sys/fs/cgroup/memory.current': '99999\n',
    }
    assert.equal(
      snapshot((file) => files[file] || '').cgroupMemory.currentBytes,
      null
    )
  }
})

test('distinguishes zero counters from missing or malformed memory data', () => {
  const files = {
    '/proc/self/cgroup': '0::/\n',
    '/proc/self/mountinfo':
      '31 25 0:28 / /sys/fs/cgroup rw - cgroup2 cgroup rw\n',
    '/sys/fs/cgroup/memory.current': '0\n',
    '/sys/fs/cgroup/memory.peak': '9007199254740992\n',
    '/sys/fs/cgroup/memory.stat': 'anon -1\nfile max\n',
    '/sys/fs/cgroup/memory.events': 'high 0\nmax NaN\noom 1 extra\n',
  }
  assert.deepEqual(snapshot((file) => files[file] || '').cgroupMemory, {
    scope: 'current-cgroup-and-descendants',
    currentBytes: 0,
    peakBytes: null,
    anonymousBytes: null,
    fileBytes: null,
    kernelBytes: null,
    events: { high: 0, max: null, oom: null, oomKill: null },
  })
})

test('preserves failed command exit and writes bounded numeric output', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'resource-test-'))
  try {
    const output = path.join(directory, 'samples.jsonl')
    const result = spawnSync(process.execPath, [
      path.join(__dirname, 'playwright-resource-sampler.cjs'),
      output,
      process.execPath,
      '-e',
      'process.exit(7)',
    ])
    assert.equal(result.status, 7)
    const rows = fs
      .readFileSync(output, 'utf8')
      .trim()
      .split('\n')
      .map(JSON.parse)
    assert.equal(rows.length, 2)
    const unavailable = spawnSync(process.execPath, [
      path.join(__dirname, 'playwright-resource-sampler.cjs'),
      output,
      process.execPath,
      '-e',
      'process.exit(0)',
    ])
    assert.equal(unavailable.status, 0)
    assert.equal(fs.readFileSync(output, 'utf8').trim().split('\n').length, 2)
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test('forwards cancellation and exits with signal status', {
  timeout: 10000,
}, async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'resource-test-'))
  const child = spawn(process.execPath, [
    path.join(__dirname, 'playwright-resource-sampler.cjs'),
    path.join(directory, 'samples.jsonl'),
    process.execPath,
    '-e',
    'console.log("ready"); setInterval(() => {}, 1000)',
  ])
  try {
    await once(child.stdout, 'data')
    const exited = once(child, 'exit')
    child.kill('SIGTERM')
    const [code] = await exited
    assert.equal(code, 143)
  } finally {
    child.kill('SIGKILL')
    fs.rmSync(directory, { recursive: true, force: true })
  }
})
