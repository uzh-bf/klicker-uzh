import { createHash, randomUUID } from 'node:crypto'
import { realpathSync } from 'node:fs'
import { open, readFile, rename, unlink } from 'node:fs/promises'
import { createConnection, createServer } from 'node:net'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const MAX_SUBMITTED_TURNS = 120
export const MAX_PROVIDER_MICRO_USD = 5_000_000
export const EXTENDED_BUDGET_LIMITS = Object.freeze({
  maxProviderMicroUsd: 55_000_000,
  maxSubmittedTurns: 48,
})

export function budgetError(code) {
  return Object.assign(new Error(code), { code })
}

export function fingerprint(value) {
  const canonical = (entry) => {
    if (Array.isArray(entry)) return entry.map(canonical)
    if (entry && typeof entry === 'object') {
      return Object.fromEntries(
        Object.keys(entry)
          .sort()
          .map((key) => [key, canonical(entry[key])])
      )
    }
    return entry
  }
  return createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex')
}

function integer(value, minimum, maximum = Number.MAX_SAFE_INTEGER) {
  return Number.isSafeInteger(value) && value >= minimum && value <= maximum
}

const FIELDS = [
  'version',
  'experimentId',
  'policyHash',
  'maxSubmittedTurns',
  'maxProviderMicroUsd',
  'submittedTurns',
  'reservedProviderMicroUsd',
  'creditsUsed',
  'uncertain',
  'activeTurn',
]
const IDENTITY = [
  'version',
  'experimentId',
  'policyHash',
  'maxSubmittedTurns',
  'maxProviderMicroUsd',
]

export function validateBudgetLedger(value) {
  if (!value || value.version !== 2)
    throw budgetError('budget_version_unsupported')
  if (
    Object.keys(value).length !== FIELDS.length ||
    Object.keys(value).some((key) => !FIELDS.includes(key)) ||
    typeof value.experimentId !== 'string' ||
    !value.experimentId ||
    !/^[a-f0-9]{64}$/.test(value.policyHash) ||
    !integer(value.maxSubmittedTurns, 1, MAX_SUBMITTED_TURNS) ||
    (!integer(value.maxProviderMicroUsd, 1, MAX_PROVIDER_MICRO_USD) &&
      !(
        value.maxProviderMicroUsd ===
          EXTENDED_BUDGET_LIMITS.maxProviderMicroUsd &&
        value.maxSubmittedTurns === EXTENDED_BUDGET_LIMITS.maxSubmittedTurns
      )) ||
    !integer(value.submittedTurns, 0, value.maxSubmittedTurns) ||
    !integer(value.reservedProviderMicroUsd, 0, value.maxProviderMicroUsd) ||
    !Number.isFinite(value.creditsUsed) ||
    value.creditsUsed < 0 ||
    typeof value.uncertain !== 'boolean' ||
    (value.activeTurn !== null &&
      (typeof value.activeTurn !== 'string' || !value.activeTurn)) ||
    (value.activeTurn !== null && !value.uncertain)
  )
    throw budgetError('budget_invalid')
  return value
}

export function createBudgetLedger(policyHash, limits = {}) {
  return validateBudgetLedger({
    version: 2,
    experimentId: randomUUID(),
    policyHash,
    maxSubmittedTurns: limits.maxSubmittedTurns ?? MAX_SUBMITTED_TURNS,
    maxProviderMicroUsd: limits.maxProviderMicroUsd ?? MAX_PROVIDER_MICRO_USD,
    submittedTurns: 0,
    reservedProviderMicroUsd: 0,
    creditsUsed: 0,
    uncertain: false,
    activeTurn: null,
  })
}

async function exclusive(path, data) {
  const handle = await open(path, 'wx', 0o600)
  try {
    await handle.writeFile(data)
    await handle.sync()
  } finally {
    await handle.close()
  }
}

async function syncDirectory(path) {
  const handle = await open(dirname(path), 'r')
  try {
    await handle.sync()
  } finally {
    await handle.close()
  }
}

// The immutable identity receipt survives deletion of the mutable ledger.
// An interrupted initialization therefore cannot silently start a new budget.
export async function initializeBudget(filePath, policyHash, limits) {
  const path = resolve(filePath)
  const ledger = createBudgetLedger(policyHash, limits)
  try {
    await exclusive(
      path + '.identity',
      JSON.stringify(IDENTITY.map((key) => ledger[key]))
    )
    await exclusive(path, JSON.stringify(ledger) + '\n')
    await syncDirectory(path)
  } catch (error) {
    throw budgetError(
      error?.code === 'EEXIST'
        ? 'budget_exists'
        : 'budget_initialization_failed'
    )
  }
  return ledger
}

export async function readBudgetLedger(filePath) {
  try {
    const ledger = validateBudgetLedger(
      JSON.parse(await readFile(filePath, 'utf8'))
    )
    const identity = JSON.parse(await readFile(filePath + '.identity', 'utf8'))
    if (
      JSON.stringify(identity) !==
      JSON.stringify(IDENTITY.map((key) => ledger[key]))
    ) {
      throw budgetError('budget_identity_mismatch')
    }
    return ledger
  } catch (error) {
    if (error?.code?.startsWith('budget_')) throw error
    throw budgetError(
      error?.code === 'ENOENT' ? 'budget_missing' : 'budget_unreadable'
    )
  }
}

export async function acquireBudgetLock(filePath, suffix = '.lock') {
  const path = resolve(filePath) + suffix
  const token = randomUUID()
  try {
    await exclusive(path, token)
  } catch (error) {
    throw budgetError(
      error?.code === 'EEXIST' ? 'budget_busy' : 'budget_lock_failed'
    )
  }
  let lease
  if (suffix === '.run') {
    lease = createServer((socket) => {
      socket.on('error', () => socket.destroy())
      socket.end(token)
    })
    try {
      await new Promise((ready, reject) => {
        lease.once('error', reject)
        lease.listen(resolve(filePath) + '.lease', ready)
      })
    } catch {
      await unlink(path)
      throw budgetError('budget_lease_failed')
    }
  }
  let released = false
  return async () => {
    if (released) return
    if (lease) await new Promise((resolve) => lease.close(resolve))
    await unlink(path)
    released = true
  }
}

// A live socket proves ownership without mistaking a stale durable lock for a
// running process. Runner and guard share the same local filesystem/runtime.
export async function assertRunLease(filePath) {
  try {
    const path = resolve(filePath)
    const token = await readFile(path + '.run', 'utf8')
    const actual = await new Promise((resolve, reject) => {
      const socket = createConnection(path + '.lease')
      let data = ''
      socket.setTimeout(1000, () => socket.destroy(new Error('timeout')))
      socket.on('data', (chunk) => {
        data += chunk
        if (data.length > 100) socket.destroy(new Error('invalid'))
      })
      socket.once('error', reject)
      socket.once('end', () => resolve(data))
    })
    if (!token || token !== actual) throw new Error('invalid')
  } catch {
    throw budgetError('budget_run_inactive')
  }
}

export async function mutateBudget(filePath, mutate) {
  const path = resolve(filePath)
  const release = await acquireBudgetLock(path)
  let ledger
  let mutationError
  try {
    ledger = await readBudgetLedger(path)
    const identity = IDENTITY.map((key) => ledger[key])
    const previousTurns = ledger.submittedTurns
    const previousSpend = ledger.reservedProviderMicroUsd
    mutate(ledger)
    validateBudgetLedger(ledger)
    if (
      JSON.stringify(identity) !==
        JSON.stringify(IDENTITY.map((key) => ledger[key])) ||
      ledger.submittedTurns < previousTurns ||
      ledger.reservedProviderMicroUsd < previousSpend
    )
      throw budgetError('budget_identity_mismatch')
    const temporary = path + '.' + randomUUID() + '.tmp'
    await exclusive(temporary, JSON.stringify(ledger) + '\n')
    await rename(temporary, path)
    await syncDirectory(path)
  } catch (error) {
    mutationError = error
  }
  try {
    await release()
  } catch (error) {
    if (!mutationError)
      throw Object.assign(budgetError('budget_lock_failed'), { cause: error })
    mutationError.cause = new AggregateError(
      [mutationError.cause, error].filter(Boolean),
      'Budget mutation failed and its lock could not be released'
    )
  }
  if (mutationError) throw mutationError
  return ledger
}

export function assertBudgetCanStart(ledger) {
  validateBudgetLedger(ledger)
  if (ledger.uncertain || ledger.activeTurn !== null)
    throw budgetError('budget_uncertain')
  if (ledger.submittedTurns >= ledger.maxSubmittedTurns)
    throw budgetError('budget_turns_exhausted')
  if (ledger.reservedProviderMicroUsd >= ledger.maxProviderMicroUsd)
    throw budgetError('budget_spend_exhausted')
}

async function beginBudgetTurnState(path) {
  const token = randomUUID()
  const ledger = await mutateBudget(path, (ledger) => {
    assertBudgetCanStart(ledger)
    ledger.submittedTurns += 1
    ledger.uncertain = true
    ledger.activeTurn = token
  })
  return { token, reservedProviderMicroUsd: ledger.reservedProviderMicroUsd }
}

export async function beginBudgetTurn(path) {
  return (await beginBudgetTurnState(path)).token
}

export async function finishBudgetTurn(
  path,
  token,
  credits,
  reservationBaseline
) {
  return mutateBudget(path, (ledger) => {
    if (ledger.activeTurn !== token) throw budgetError('budget_turn_mismatch')
    if (reservationBaseline !== undefined) {
      if (!integer(reservationBaseline, 0))
        throw budgetError('provider_reservation_invalid')
      if (ledger.reservedProviderMicroUsd <= reservationBaseline)
        throw budgetError('budget_turn_unreserved')
    }
    if (
      typeof credits !== 'number' ||
      !Number.isFinite(credits) ||
      credits < 0
    ) {
      throw budgetError('credits_unaccounted')
    }
    ledger.creditsUsed += credits
    ledger.activeTurn = null
    ledger.uncertain = false
  })
}

export async function reserveProviderSpend(path, policyHash, microUsd) {
  await assertRunLease(path)
  if (!integer(microUsd, 1)) throw budgetError('provider_reservation_invalid')
  return mutateBudget(path, (ledger) => {
    if (ledger.policyHash !== policyHash)
      throw budgetError('budget_policy_mismatch')
    if (ledger.activeTurn === null) throw budgetError('budget_turn_missing')
    if (
      microUsd >
      ledger.maxProviderMicroUsd - ledger.reservedProviderMicroUsd
    ) {
      throw budgetError('budget_spend_exhausted')
    }
    ledger.reservedProviderMicroUsd += microUsd
  })
}

const ADMISSION_MAX_FRAME_BYTES = 64
const ADMISSION_MAX_REPLY_BYTES = 128

function sendAdmissionLine(output, line) {
  if (Buffer.byteLength(line, 'ascii') + 1 > ADMISSION_MAX_REPLY_BYTES)
    throw new Error('admission reply exceeds its bound')
  return new Promise((resolveWrite, rejectWrite) => {
    output.write(line + '\n', (error) =>
      error ? rejectWrite(error) : resolveWrite()
    )
  })
}

// One run lease and at most one turn token. A protocol error ends the session,
// and a finish is never repeated after its reply is lost.
export async function runAdmissionSession({
  budgetFile,
  policyHash,
  input = process.stdin,
  output = process.stdout,
} = {}) {
  let release = null
  let token = null
  let baseline = 0
  let buffer = Buffer.alloc(0)
  let result = { status: 'closed' }
  try {
    const initial = await readBudgetLedger(budgetFile)
    if (!/^[a-f0-9]{64}$/.test(policyHash) || initial.policyHash !== policyHash)
      throw budgetError('budget_policy_mismatch')
    assertBudgetCanStart(initial)
    release = await acquireBudgetLock(budgetFile, '.run')
    const current = await readBudgetLedger(budgetFile)
    if (current.policyHash !== policyHash)
      throw budgetError('budget_policy_mismatch')
    assertBudgetCanStart(current)
    await sendAdmissionLine(output, 'ready')
    read: for await (const chunk of input) {
      buffer = Buffer.concat([buffer, Buffer.from(chunk)])
      while (buffer.includes(0x0a)) {
        const index = buffer.indexOf(0x0a)
        const frame = buffer.subarray(0, index)
        buffer = buffer.subarray(index + 1)
        if (
          frame.length > ADMISSION_MAX_FRAME_BYTES ||
          frame.some((byte) => byte > 0x7f)
        )
          throw budgetError('budget_command_invalid')
        const line = frame.toString('ascii')
        if (line === 'begin') {
          if (token !== null) throw budgetError('budget_turn_active')
          const state = await beginBudgetTurnState(budgetFile)
          token = state.token
          baseline = state.reservedProviderMicroUsd
          await sendAdmissionLine(output, 'ok')
        } else if (line === 'finish') {
          if (token === null) throw budgetError('budget_turn_missing')
          await assertRunLease(budgetFile)
          await finishBudgetTurn(budgetFile, token, 0, baseline)
          token = null
          await sendAdmissionLine(output, 'ok')
        } else if (line === 'close') {
          const releaseRun = release
          release = null
          await releaseRun()
          await sendAdmissionLine(output, 'ok')
          break read
        } else {
          throw budgetError('budget_command_invalid')
        }
      }
      if (buffer.length > ADMISSION_MAX_FRAME_BYTES)
        throw budgetError('budget_command_invalid')
    }
    if (buffer.length) throw budgetError('budget_command_invalid')
  } catch (error) {
    if (typeof error?.code === 'string' && error.code.startsWith('budget_')) {
      result = { status: 'rejected', code: error.code }
      try {
        await sendAdmissionLine(output, `error ${error.code}`)
      } catch (writeError) {
        result = { status: 'failed', code: error.code, error: writeError }
      }
    } else {
      result = { status: 'failed', error }
    }
  } finally {
    if (release) {
      try {
        await release()
      } catch (error) {
        result = { ...result, status: 'failed', error: result.error ?? error }
      }
    }
  }
  return result
}

async function runAdmissionCli(argv) {
  const [mode, budgetFile, policyHash, ...extra] = argv
  if (
    mode !== '--admission-session' ||
    !budgetFile ||
    !policyHash ||
    extra.length
  ) {
    process.stderr.write(
      'usage: node evaluation/evaluation-budget.mjs --admission-session <budgetFile> <policyHash>\n'
    )
    process.exitCode = 2
    return
  }
  let terminated = false
  const onSignal = () => {
    terminated = true
    process.stdin.destroy()
  }
  process.once('SIGTERM', onSignal)
  try {
    const result = await runAdmissionSession({ budgetFile, policyHash })
    if (terminated) process.exitCode = 143
    else if (result.status === 'closed') process.exitCode = 0
    else if (result.status === 'rejected') process.exitCode = 1
    else process.exitCode = 2
  } finally {
    process.removeListener('SIGTERM', onSignal)
  }
}

function isDirectInvocation() {
  try {
    return (
      realpathSync(process.argv[1] ?? '') === fileURLToPath(import.meta.url)
    )
  } catch {
    return false
  }
}

if (isDirectInvocation()) await runAdmissionCli(process.argv.slice(2))
