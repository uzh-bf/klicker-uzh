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
  receiptId: string
  code: string
  gradingStatus: CodeSubmissionStatus
  feedback?: CodeSubmissionReceiptDataFragment['feedback']
}

interface UseCodeSubmissionProps {
  storageKey: string
}

function isActive(status?: CodeSubmissionStatus) {
  return (
    status === CodeSubmissionStatus.Pending ||
    status === CodeSubmissionStatus.Running
  )
}

function useCodeSubmission({ storageKey }: UseCodeSubmissionProps) {
  const [submission, setSubmission] =
    useLocalStorage<PersistedCodeSubmission | null>(storageKey, null)
  const [submitMutation, { loading: submitting, error: submissionError }] =
    useMutation(SubmitCodeResponseDocument)
  const active = isActive(submission?.gradingStatus)

  const {
    data: queryData,
    error: queryError,
    loading: queryLoading,
  } = useQuery(CodeSubmissionDocument, {
    variables: { id: submission?.receiptId ?? '' },
    skip: !submission?.receiptId,
    fetchPolicy: 'network-only',
    pollInterval: active ? 2_000 : 0,
  })
  const { data: subscriptionData } = useSubscription(
    CodeSubmissionUpdatedDocument,
    {
      variables: { id: submission?.receiptId ?? '' },
      skip: !submission?.receiptId || !active,
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
    if (!receipt || !submission || receipt.id !== submission.receiptId) return

    if (
      receipt.gradingStatus !== submission.gradingStatus ||
      receipt.feedback !== submission.feedback
    ) {
      setSubmission({
        ...submission,
        gradingStatus: receipt.gradingStatus,
        feedback: receipt.feedback,
      })
    }
  }, [receipt, setSubmission, submission])

  useEffect(() => {
    if (
      !queryLoading &&
      queryData &&
      queryData.codeSubmission === null &&
      submission &&
      isActive(submission.gradingStatus)
    ) {
      setSubmission({
        ...submission,
        gradingStatus: CodeSubmissionStatus.Failed,
        feedback: null,
      })
    }
  }, [queryData, queryLoading, setSubmission, submission])

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

      setSubmission({
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
    active,
  }
}

export default useCodeSubmission
