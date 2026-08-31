import { useMutation, useQuery, useSubscription } from '@apollo/client'
import {
  CodeSubmissionDocument,
  CodeSubmissionReceiptDataFragment,
  CodeSubmissionStatus,
  CodeSubmissionUpdatedDocument,
  SubmitCodeResponseDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { useLocalStorage } from '@uidotdev/usehooks'
import { useEffect } from 'react'

export interface PersistedCodeSubmission {
  participantId: string
  receiptId: string
  code: string
  gradingStatus: CodeSubmissionStatus
  feedback?: CodeSubmissionReceiptDataFragment['feedback']
}

interface UseCodeSubmissionProps {
  storageKey: string
  enabled: boolean
  participantId?: string
}

function isActive(status?: CodeSubmissionStatus) {
  return (
    status === CodeSubmissionStatus.Pending ||
    status === CodeSubmissionStatus.Running
  )
}

function useCodeSubmission({
  storageKey,
  enabled,
  participantId,
}: UseCodeSubmissionProps) {
  const [persistedSubmission, setPersistedSubmission] = useLocalStorage<
    PersistedCodeSubmission | undefined
  >(storageKey, undefined)
  const submission =
    enabled &&
    participantId &&
    persistedSubmission?.participantId === participantId
      ? persistedSubmission
      : undefined
  const [submitMutation, { loading: submitting, error: submissionError }] =
    useMutation(SubmitCodeResponseDocument)
  const active = enabled && isActive(submission?.gradingStatus)

  const {
    data: queryData,
    error: queryError,
    loading: queryLoading,
    refetch,
  } = useQuery(CodeSubmissionDocument, {
    variables: { id: submission?.receiptId ?? '' },
    skip: !enabled || !submission?.receiptId,
    fetchPolicy: 'network-only',
    pollInterval: active ? 2_000 : 0,
  })
  const { data: subscriptionData } = useSubscription(
    CodeSubmissionUpdatedDocument,
    {
      variables: { id: submission?.receiptId ?? '' },
      skip: !enabled || !submission?.receiptId || !active,
    }
  )

  const subscriptionReceipt = subscriptionData?.codeSubmissionUpdated
  const queryReceipt = queryData?.codeSubmission
  const receipt =
    subscriptionReceipt && !isActive(subscriptionReceipt.gradingStatus)
      ? subscriptionReceipt
      : queryReceipt && !isActive(queryReceipt.gradingStatus)
        ? queryReceipt
        : (subscriptionReceipt ?? queryReceipt)

  useEffect(() => {
    if (
      enabled &&
      participantId &&
      persistedSubmission &&
      persistedSubmission.participantId !== participantId
    ) {
      setPersistedSubmission(undefined)
    }
  }, [enabled, participantId, persistedSubmission, setPersistedSubmission])

  useEffect(() => {
    if (!receipt || !submission || receipt.id !== submission.receiptId) return
    if (!isActive(submission.gradingStatus)) return

    if (
      receipt.gradingStatus !== submission.gradingStatus ||
      (!submission.feedback && receipt.feedback)
    ) {
      setPersistedSubmission({
        ...submission,
        gradingStatus: receipt.gradingStatus,
        feedback: receipt.feedback,
      })
    }
  }, [receipt, setPersistedSubmission, submission])

  useEffect(() => {
    if (
      !queryLoading &&
      queryData &&
      queryData.codeSubmission === null &&
      submission &&
      isActive(submission.gradingStatus)
    ) {
      setPersistedSubmission({
        ...submission,
        gradingStatus: CodeSubmissionStatus.Failed,
        feedback: null,
      })
    }
  }, [queryData, queryLoading, setPersistedSubmission, submission])

  const submit = async ({
    instanceId,
    courseId,
    code,
    timeSpent,
  }: {
    instanceId: number
    courseId: string
    code: string
    timeSpent: number
  }) => {
    if (!enabled || !participantId) return false

    try {
      const result = await submitMutation({
        variables: {
          instanceId,
          courseId,
          code,
          timeSpent,
        },
      })
      const receipt = result.data?.submitCodeResponse
      if (!receipt) return false

      setPersistedSubmission({
        participantId,
        receiptId: receipt.id,
        code,
        gradingStatus: receipt.gradingStatus,
        feedback: receipt.feedback,
      })
      return true
    } catch {
      return false
    }
  }

  return {
    submission,
    submit,
    submitting,
    submissionError,
    pollingError: queryError,
    retryPolling: refetch,
    active,
  }
}

export default useCodeSubmission
