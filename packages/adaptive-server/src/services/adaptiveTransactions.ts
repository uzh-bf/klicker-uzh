import type { PrismaTransactionClient } from '@klicker-uzh/util'
import * as DB from '@klicker-uzh/prisma/client'
import { GraphQLError } from 'graphql'

const ADAPTIVE_TRANSACTION_RETRIES = 3
const ADAPTIVE_OPERATION_MAX_WAIT_MS = 10_000
const ADAPTIVE_OPERATION_TIMEOUT_MS = 60_000
const ADAPTIVE_RETRY_BASE_DELAY_MS = 25
const ADAPTIVE_RETRY_MAX_DELAY_MS = 400

export async function withAdaptiveOperationalTransaction<T>(
  prisma: DB.PrismaClient,
  operation: (prisma: PrismaTransactionClient) => Promise<T>,
  {
    errorCode,
    errorMessage,
  }: {
    errorCode: string
    errorMessage: string
  }
): Promise<T> {
  for (let attempt = 0; attempt < ADAPTIVE_TRANSACTION_RETRIES; attempt++) {
    try {
      return await prisma.$transaction(operation, {
        maxWait: ADAPTIVE_OPERATION_MAX_WAIT_MS,
        timeout: ADAPTIVE_OPERATION_TIMEOUT_MS,
      })
    } catch (error) {
      if (isAdaptiveTransactionTimeout(error)) {
        throw adaptiveTransactionError(errorMessage, errorCode)
      }
      if (!isRetryableAdaptiveTransactionConflict(error)) {
        throw error
      }
      if (attempt === ADAPTIVE_TRANSACTION_RETRIES - 1) {
        throw adaptiveTransactionError(errorMessage, errorCode)
      }
      await waitForAdaptiveTransactionRetry(attempt)
    }
  }

  throw new Error('Unreachable adaptive operational transaction state.')
}

export function isRetryableAdaptiveTransactionConflict(
  error: unknown
): boolean {
  const prismaError = error as {
    name?: string
    code?: string
    cause?: { kind?: string; code?: string; originalCode?: string }
    meta?: {
      code?: string
      driverAdapterError?: {
        cause?: { kind?: string; code?: string; originalCode?: string }
      }
    }
  }
  // A failure raised at COMMIT reaches the caller as the bare driver adapter
  // error rather than wrapped in a Prisma known-request error.
  const driverCause =
    prismaError.meta?.driverAdapterError?.cause ??
    (prismaError.name === 'DriverAdapterError' ? prismaError.cause : undefined)
  const postgresCode =
    prismaError.meta?.code ??
    driverCause?.originalCode ??
    driverCause?.code ??
    prismaError.code
  return (
    prismaError.code === 'P2034' ||
    postgresCode === '40001' ||
    postgresCode === '40P01' ||
    driverCause?.kind === 'TransactionWriteConflict'
  )
}

export function isAdaptiveUniqueConstraintConflict(error: unknown): boolean {
  return (error as { code?: string }).code === 'P2002'
}

export async function waitForAdaptiveTransactionRetry(
  attempt: number
): Promise<void> {
  const ceilingMs = Math.min(
    ADAPTIVE_RETRY_BASE_DELAY_MS * 2 ** attempt,
    ADAPTIVE_RETRY_MAX_DELAY_MS
  )
  // Equal jitter keeps the exponential floor while de-synchronizing requests
  // that collided on the same lock, so they do not collide again in lockstep.
  const delayMs = ceilingMs / 2 + Math.random() * (ceilingMs / 2)
  await new Promise((resolve) => setTimeout(resolve, delayMs))
}

function isAdaptiveTransactionTimeout(error: unknown): boolean {
  return (error as { code?: string }).code === 'P2028'
}

function adaptiveTransactionError(message: string, code: string) {
  return new GraphQLError(message, { extensions: { code } })
}
