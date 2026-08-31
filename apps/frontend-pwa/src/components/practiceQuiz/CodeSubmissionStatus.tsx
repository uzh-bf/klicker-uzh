import { CodeSubmissionStatus as GradingStatus } from '@klicker-uzh/graphql/dist/ops'
import { Button, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import type { PersistedCodeSubmission } from './useCodeSubmission'

interface CodeSubmissionStatusProps {
  submission: PersistedCodeSubmission
  pollingUnavailable?: boolean
  retryPolling?: () => Promise<unknown>
}

function CodeSubmissionStatus({
  submission,
  pollingUnavailable = false,
  retryPolling,
}: CodeSubmissionStatusProps) {
  const t = useTranslations()

  if (
    submission.gradingStatus === GradingStatus.Pending ||
    submission.gradingStatus === GradingStatus.Running
  ) {
    return (
      <div className="mt-4" data-cy="code-submission-pending">
        <div className="space-y-2">
          <UserNotification type="info">
            {pollingUnavailable
              ? t('pwa.practiceQuiz.codePollingUnavailable')
              : t('pwa.practiceQuiz.codeSubmissionPending')}
          </UserNotification>
          {pollingUnavailable && retryPolling ? (
            <Button
              onClick={() => void retryPolling()}
              data={{ cy: 'code-polling-retry' }}
            >
              <Button.Label>{t('shared.generic.tryAgain')}</Button.Label>
            </Button>
          ) : null}
        </div>
      </div>
    )
  }

  if (submission.gradingStatus === GradingStatus.Failed) {
    return (
      <div className="mt-4" data-cy="code-submission-failed">
        <UserNotification type="error">
          {t('pwa.practiceQuiz.codeSubmissionFailed')}
        </UserNotification>
      </div>
    )
  }

  const feedback = submission.feedback
  if (!feedback) return null

  return (
    <div className="mt-4 space-y-3" data-cy="code-submission-completed">
      <UserNotification type="success">
        {t('pwa.practiceQuiz.codeSubmissionCompleted', {
          percentage: Math.round(feedback.pointsPercentage * 100),
        })}
      </UserNotification>
      <div className="space-y-2" data-cy="code-public-test-results">
        {feedback.publicTestResults.map((testResult) => (
          <div
            key={testResult.id}
            className="rounded border border-gray-200 bg-slate-50 p-3 text-sm"
            data-cy={`code-public-test-${testResult.id}`}
          >
            <div className="font-semibold">
              {testResult.name}:{' '}
              {testResult.passed
                ? t('pwa.practiceQuiz.codeTestPassed')
                : t('pwa.practiceQuiz.codeTestFailed')}
            </div>
            {typeof testResult.actualOutput !== 'undefined' &&
              testResult.actualOutput !== null && (
                <div>
                  {t('pwa.practiceQuiz.codeActualOutput')}:{' '}
                  <code>{JSON.stringify(testResult.actualOutput)}</code>
                </div>
              )}
            {testResult.stdout && (
              <div>
                {t('pwa.practiceQuiz.codeStandardOutput')}:{' '}
                <pre className="mt-1 overflow-x-auto whitespace-pre-wrap">
                  {testResult.stdout}
                </pre>
              </div>
            )}
            {testResult.stderr && (
              <div>
                {t('pwa.practiceQuiz.codeStandardError')}:{' '}
                <pre className="mt-1 overflow-x-auto whitespace-pre-wrap">
                  {testResult.stderr}
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default CodeSubmissionStatus
