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
    void Promise.resolve()
      .then(() => auditFailure(error))
      .catch(() => undefined)

    return 'unconfirmed'
  }
}
