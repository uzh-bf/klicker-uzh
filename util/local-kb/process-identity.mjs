const CLASSIFICATIONS = Object.freeze({
  OWNED: 'owned',
  STOPPED: 'stopped',
  UNKNOWN: 'unknown',
})

const isRecord = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isPositiveInteger = (value) => Number.isSafeInteger(value) && value > 0

const isTcpPort = (value) => isPositiveInteger(value) && value <= 65535

const isCanonicalSourcePath = (value) => {
  if (typeof value !== 'string' || value.length === 0 || value.includes('\0')) {
    return false
  }

  const isPosixPath = value.startsWith('/') && !value.includes('\\')
  const isWindowsPath = /^[A-Za-z]:[\\/]/.test(value)

  if (!isPosixPath && !isWindowsPath) {
    return false
  }

  if (
    value.split(/[\\/]/).some((segment) => segment === '.' || segment === '..')
  ) {
    return false
  }

  if (isPosixPath && value !== '/' && value.endsWith('/')) {
    return false
  }

  if (
    isWindowsPath &&
    !/^[A-Za-z]:[\\/]$/.test(value) &&
    /[\\/]$/.test(value)
  ) {
    return false
  }

  return true
}

const normaliseStartIdentity = (value) => {
  if (typeof value === 'string' && value.length > 0 && !/[\s\0]/.test(value)) {
    return value
  }

  if (isPositiveInteger(value)) {
    return String(value)
  }

  return null
}

const validateExpectedPorts = (ports) => {
  if (!Array.isArray(ports)) {
    return 'expected-ports-invalid'
  }

  const seen = new Set()
  for (const port of ports) {
    if (!isTcpPort(port) || seen.has(port)) {
      return 'expected-ports-invalid'
    }
    seen.add(port)
  }

  return null
}

const validateIdentityFields = (identity) => {
  if (!isRecord(identity)) {
    return 'identity-not-an-object'
  }

  if (!isCanonicalSourcePath(identity.sourcePath)) {
    return 'source-path-invalid'
  }

  if (!isPositiveInteger(identity.pid)) {
    return 'pid-invalid'
  }

  if (normaliseStartIdentity(identity.startIdentity) === null) {
    return 'start-identity-invalid'
  }

  if (!isPositiveInteger(identity.processGroup)) {
    return 'process-group-invalid'
  }

  return null
}

const sameIdentity = (recorded, observed) =>
  recorded.sourcePath === observed.sourcePath &&
  recorded.pid === observed.pid &&
  normaliseStartIdentity(recorded.startIdentity) ===
    normaliseStartIdentity(observed.startIdentity) &&
  recorded.processGroup === observed.processGroup

const classify = (classification, reason) => ({ classification, reason })

const unknown = (reason) => classify(CLASSIFICATIONS.UNKNOWN, reason)

/**
 * Validate the identity persisted by the local KB launcher.
 *
 * Source paths must already be canonical and absolute. This function only
 * checks their shape; it never touches the filesystem or resolves symlinks.
 */
export function validateProcessIdentity(identity) {
  const fieldError = validateIdentityFields(identity)
  if (fieldError !== null) {
    return { valid: false, reason: fieldError }
  }

  const portsError = validateExpectedPorts(identity.expectedPorts)
  if (portsError !== null) {
    return { valid: false, reason: portsError }
  }

  return { valid: true, reason: 'valid-process-identity' }
}

/**
 * Classify a fresh, side-effect-free observation against a recorded identity.
 *
 * A null observation is the explicit "process is missing" result. A live
 * observation must include one port-owner entry for every expected port; each
 * owner must carry the same complete identity as the recorded process.
 */
export function classifyProcessIdentity(recorded, observation) {
  const recordedValidation = validateProcessIdentity(recorded)
  if (!recordedValidation.valid) {
    return unknown(`malformed-recorded-identity:${recordedValidation.reason}`)
  }

  if (observation === null) {
    return classify(CLASSIFICATIONS.STOPPED, 'process-missing')
  }

  if (observation === undefined) {
    return unknown('observation-missing')
  }

  const observationError = validateIdentityFields(observation)
  if (observationError !== null) {
    return unknown(`malformed-observation:${observationError}`)
  }

  if (!Array.isArray(observation.ports)) {
    return unknown('malformed-observation:port-observations-invalid')
  }

  const expectedPorts = new Set(recorded.expectedPorts)
  const observedPorts = new Map()

  for (const portObservation of observation.ports) {
    if (!isRecord(portObservation) || !isTcpPort(portObservation.port)) {
      return unknown('malformed-observation:port-observation-invalid')
    }

    if (observedPorts.has(portObservation.port)) {
      return unknown('malformed-observation:duplicate-port-observation')
    }

    observedPorts.set(portObservation.port, portObservation.owner)
  }

  for (const port of expectedPorts) {
    if (!observedPorts.has(port)) {
      return unknown('port-observation-missing')
    }
  }

  for (const port of observedPorts.keys()) {
    if (!expectedPorts.has(port)) {
      return unknown('unexpected-port-observation')
    }
  }

  if (!sameIdentity(recorded, observation)) {
    if (recorded.sourcePath !== observation.sourcePath) {
      return unknown('source-mismatch')
    }

    if (recorded.pid !== observation.pid) {
      return unknown('pid-mismatch')
    }

    if (
      normaliseStartIdentity(recorded.startIdentity) !==
      normaliseStartIdentity(observation.startIdentity)
    ) {
      return unknown('start-identity-mismatch')
    }

    return unknown('process-group-mismatch')
  }

  for (const owner of observedPorts.values()) {
    if (owner === null || owner === undefined) {
      return unknown('port-owner-missing')
    }

    if (
      validateIdentityFields(owner) !== null ||
      !sameIdentity(recorded, owner)
    ) {
      return unknown('port-owner-mismatch')
    }
  }

  return classify(CLASSIFICATIONS.OWNED, 'matching-live-evidence')
}
