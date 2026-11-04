export type AssessmentSubmissionOutcome = 'accepted' | 'unconfirmed'

type AssessmentSubmissionDependencies = {
  enqueue: () => Promise<unknown>
  auditFailure: (error: unknown) => Promise<unknown>
}

export async function dispatchAssessmentSubmission({
  enqueue,
  auditFailure,
}: AssessmentSubmissionDependencies): Promise<AssessmentSubmissionOutcome> {
  try {
    await enqueue()
    return 'accepted'
  } catch (error) {
    // The audit is best effort: it must neither delay the unconfirmed response
    // nor surface its own failure as an unhandled rejection.
    void Promise.resolve()
      .then(() => auditFailure(error))
      .catch(() => undefined)

    return 'unconfirmed'
  }
}
