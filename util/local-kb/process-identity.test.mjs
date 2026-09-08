import assert from 'node:assert/strict'
import test from 'node:test'

import {
  classifyProcessIdentity,
  validateProcessIdentity,
} from './process-identity.mjs'

const recorded = {
  sourcePath: '/synthetic/local-kb/server.mjs',
  pid: 4123,
  startIdentity: 'start-4123',
  processGroup: 4123,
  expectedPorts: [1417, 1418],
}

const matchingObservation = () => ({
  sourcePath: recorded.sourcePath,
  pid: recorded.pid,
  startIdentity: recorded.startIdentity,
  processGroup: recorded.processGroup,
  ports: recorded.expectedPorts.map((port) => ({
    port,
    owner: {
      sourcePath: recorded.sourcePath,
      pid: recorded.pid,
      startIdentity: recorded.startIdentity,
      processGroup: recorded.processGroup,
    },
  })),
})

test('classifies matching repeated observations as owned', () => {
  const first = classifyProcessIdentity(recorded, matchingObservation())
  const second = classifyProcessIdentity(recorded, matchingObservation())

  assert.deepEqual(first, {
    classification: 'owned',
    reason: 'matching-live-evidence',
  })
  assert.deepEqual(second, first)
})

test('refuses a stale or reused PID and start identity', () => {
  const differentPid = classifyProcessIdentity(recorded, {
    ...matchingObservation(),
    pid: recorded.pid + 1,
  })
  const reusedPid = classifyProcessIdentity(recorded, {
    ...matchingObservation(),
    startIdentity: 'start-reused',
  })

  assert.deepEqual(differentPid, {
    classification: 'unknown',
    reason: 'pid-mismatch',
  })
  assert.deepEqual(reusedPid, {
    classification: 'unknown',
    reason: 'start-identity-mismatch',
  })
})

test('refuses a different source path', () => {
  const result = classifyProcessIdentity(recorded, {
    ...matchingObservation(),
    sourcePath: '/synthetic/other-server.mjs',
  })

  assert.deepEqual(result, {
    classification: 'unknown',
    reason: 'source-mismatch',
  })
})

test('refuses a different process group', () => {
  const result = classifyProcessIdentity(recorded, {
    ...matchingObservation(),
    processGroup: recorded.processGroup + 1,
  })

  assert.deepEqual(result, {
    classification: 'unknown',
    reason: 'process-group-mismatch',
  })
})

test('refuses a port occupied by another process', () => {
  const observation = matchingObservation()
  observation.ports[0].owner = {
    ...observation.ports[0].owner,
    pid: recorded.pid + 1,
  }

  const result = classifyProcessIdentity(recorded, observation)

  assert.deepEqual(result, {
    classification: 'unknown',
    reason: 'port-owner-mismatch',
  })
})

test('classifies an explicitly missing process as stopped', () => {
  assert.deepEqual(classifyProcessIdentity(recorded, null), {
    classification: 'stopped',
    reason: 'process-missing',
  })
})

test('refuses a missing observation instead of treating it as stopped', () => {
  assert.deepEqual(classifyProcessIdentity(recorded, undefined), {
    classification: 'unknown',
    reason: 'observation-missing',
  })
})

test('refuses malformed recorded and live values', () => {
  assert.deepEqual(validateProcessIdentity({ ...recorded, pid: 0 }), {
    valid: false,
    reason: 'pid-invalid',
  })

  const malformedObservation = {
    ...matchingObservation(),
    ports: [{ port: '1417', owner: null }],
  }

  const result = classifyProcessIdentity(recorded, malformedObservation)

  assert.deepEqual(result, {
    classification: 'unknown',
    reason: 'malformed-observation:port-observation-invalid',
  })
})

test('refuses TCP ports above 65535 in recorded and live evidence', () => {
  assert.deepEqual(
    validateProcessIdentity({ ...recorded, expectedPorts: [65536] }),
    {
      valid: false,
      reason: 'expected-ports-invalid',
    }
  )

  const observation = matchingObservation()
  observation.ports[0].port = 65536

  assert.deepEqual(classifyProcessIdentity(recorded, observation), {
    classification: 'unknown',
    reason: 'malformed-observation:port-observation-invalid',
  })
})
