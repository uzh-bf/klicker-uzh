import {
  OfflinePracticeAttemptSyncStatus as ServerOfflinePracticeAttemptSyncStatus,
  type OfflinePracticeAttemptSyncInput,
  type OfflinePracticeAttemptSyncResult,
} from '@klicker-uzh/graphql/dist/ops'
import {
  listOfflinePracticeAttempts,
  updateOfflinePracticeAttemptSyncStatus,
  type OfflinePracticeAttempt,
  type OfflinePracticeAttemptSyncStatus,
  type OfflinePracticeStorageAdapter,
} from './offlinePracticeStorage'

const DEFAULT_OFFLINE_PRACTICE_SYNC_BATCH_SIZE = 25

export interface OfflinePracticeSyncResult {
  attemptedCount: number
  resultCount: number
  acceptedCount: number
  rejectedCount: number
  remainingPendingAttemptCount: number
  results: OfflinePracticeAttemptSyncResult[]
}

interface SyncPendingOfflinePracticeAttemptsArgs {
  participantId: string
  syncAttempts: (
    attempts: OfflinePracticeAttemptSyncInput[]
  ) => Promise<OfflinePracticeAttemptSyncResult[]>
  storage?: OfflinePracticeStorageAdapter
  batchSize?: number
}

function toSyncInput(
  attempt: OfflinePracticeAttempt
): OfflinePracticeAttemptSyncInput {
  return {
    clientAttemptId: attempt.clientAttemptId,
    quizId: attempt.quizId,
    quizRevision: attempt.quizRevision,
    stackId: attempt.stackId,
    stackAnswerTime: attempt.answerTime,
    responses: attempt.responses,
  }
}

export function mapOfflinePracticeServerStatus(
  status: ServerOfflinePracticeAttemptSyncStatus
): OfflinePracticeAttemptSyncStatus {
  switch (status) {
    case ServerOfflinePracticeAttemptSyncStatus.Accepted:
      return 'accepted'
    case ServerOfflinePracticeAttemptSyncStatus.AlreadySynced:
      return 'already_synced'
    case ServerOfflinePracticeAttemptSyncStatus.StaleRevision:
      return 'stale_revision'
    case ServerOfflinePracticeAttemptSyncStatus.NoLongerAuthorized:
      return 'no_longer_authorized'
    case ServerOfflinePracticeAttemptSyncStatus.ServerError:
      return 'server_error'
  }

  return 'server_error'
}

function isAcceptedSyncStatus(status: OfflinePracticeAttemptSyncStatus) {
  return status === 'accepted' || status === 'already_synced'
}

export async function syncPendingOfflinePracticeAttempts({
  participantId,
  syncAttempts,
  storage,
  batchSize = DEFAULT_OFFLINE_PRACTICE_SYNC_BATCH_SIZE,
}: SyncPendingOfflinePracticeAttemptsArgs): Promise<OfflinePracticeSyncResult> {
  let acceptedCount = 0
  let attemptedCount = 0
  let rejectedCount = 0
  const effectiveBatchSize = Math.max(1, batchSize)
  const results: OfflinePracticeAttemptSyncResult[] = []

  while (true) {
    const pendingAttempts = await listOfflinePracticeAttempts(
      participantId,
      storage,
      'pending'
    )
    const attempts = pendingAttempts.slice(0, effectiveBatchSize)

    if (attempts.length === 0) {
      return {
        attemptedCount,
        resultCount: results.length,
        acceptedCount,
        rejectedCount,
        remainingPendingAttemptCount: 0,
        results,
      }
    }

    attemptedCount += attempts.length

    const batchResults = await syncAttempts(attempts.map(toSyncInput))
    const attemptedIds = new Set(
      attempts.map((attempt) => attempt.clientAttemptId)
    )
    const handledIds = new Set<string>()
    results.push(...batchResults)

    for (const result of batchResults) {
      if (
        !attemptedIds.has(result.clientAttemptId) ||
        handledIds.has(result.clientAttemptId)
      ) {
        continue
      }

      handledIds.add(result.clientAttemptId)
      const syncStatus = mapOfflinePracticeServerStatus(result.status)

      if (isAcceptedSyncStatus(syncStatus)) {
        acceptedCount += 1
      } else {
        rejectedCount += 1
      }

      await updateOfflinePracticeAttemptSyncStatus(
        participantId,
        result.clientAttemptId,
        {
          syncStatus,
          syncMessage: result.message ?? null,
        },
        storage
      )
    }

    const remainingPendingAttemptCount = (
      await listOfflinePracticeAttempts(participantId, storage, 'pending')
    ).length

    if (
      remainingPendingAttemptCount === 0 ||
      handledIds.size < attempts.length
    ) {
      return {
        attemptedCount,
        resultCount: results.length,
        acceptedCount,
        rejectedCount,
        remainingPendingAttemptCount,
        results,
      }
    }
  }
}
