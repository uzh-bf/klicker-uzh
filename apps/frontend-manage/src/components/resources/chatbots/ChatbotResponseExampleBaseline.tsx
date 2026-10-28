import { useMutation, useQuery } from '@apollo/client'
import {
  GetResponseExampleBaselineDocument,
  StartResponseExampleBaselineDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { citationTargetIdFor } from '@klicker-uzh/util/citations'
import { Badge, Button, Modal, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

type EvidenceReference = {
  citationIndex: number
  sourceId: string
  chunkId: string
  contentHash: string
  citationAnchor: string
}

type Assessment = { status: 'PASS' | 'NEEDS_ATTENTION'; explanation: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseEvidence(value: unknown): EvidenceReference[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!isRecord(item)) return []
    const { citationIndex, sourceId, chunkId, contentHash, citationAnchor } =
      item
    if (
      typeof citationIndex !== 'number' ||
      !Number.isInteger(citationIndex) ||
      citationIndex < 1 ||
      typeof sourceId !== 'string' ||
      typeof chunkId !== 'string' ||
      typeof contentHash !== 'string' ||
      typeof citationAnchor !== 'string'
    ) {
      return []
    }
    return [{ citationIndex, sourceId, chunkId, contentHash, citationAnchor }]
  })
}

function parseAssessment(value: unknown): Assessment | null {
  if (
    !isRecord(value) ||
    (value.status !== 'PASS' && value.status !== 'NEEDS_ATTENTION') ||
    typeof value.explanation !== 'string' ||
    value.sourceSupport !== 'UNASSESSED'
  ) {
    return null
  }
  return { status: value.status, explanation: value.explanation }
}

function modeLabel(
  mode: string,
  t: ReturnType<typeof useTranslations<'chat.modes'>>,
  otherMode: string
) {
  switch (mode) {
    case 'tutor':
      return t('tutor')
    case 'explainer':
      return t('explainer')
    case 'writing-coach':
      return t('writing-coach')
    case 'quizzer':
      return t('quizzer')
    case 'custom':
      return t('custom')
    default:
      return otherMode
  }
}

function EvidenceList({
  references,
  scope,
}: Readonly<{ references: EvidenceReference[]; scope: string }>) {
  const t = useTranslations()
  return (
    <div className="mt-3 border-t pt-3">
      <h5 className="text-xs font-medium text-gray-700">
        {t('manage.resources.responseExampleBaselineSources')}
      </h5>
      {references.length === 0 ? (
        <p className="mt-1 text-xs text-gray-500">
          {t('manage.resources.responseExampleBaselineNoSources')}
        </p>
      ) : (
        <ul className="mt-2 space-y-2 text-sm text-gray-700">
          {references.map((reference) => (
            <li
              key={reference.citationIndex}
              id={citationTargetIdFor(reference.citationIndex, scope)}
              className="flex min-w-0 items-start gap-2 rounded bg-gray-50 p-2"
            >
              <span
                aria-hidden="true"
                className="inline-flex size-5 shrink-0 items-center justify-center rounded bg-blue-50 font-mono text-xs font-semibold text-blue-700"
              >
                {reference.citationIndex}
              </span>
              <span className="min-w-0 break-words">
                {reference.citationAnchor}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function AnswerPanel({
  title,
  answer,
  evidence,
  scope,
  testId,
}: Readonly<{
  title: string
  answer: string | null | undefined
  evidence: unknown
  scope: string
  testId: string
}>) {
  const t = useTranslations()
  const references = parseEvidence(evidence)
  return (
    <section
      className="min-w-0 rounded-md border border-gray-200 p-3"
      data-cy={testId}
    >
      <h4 className="font-medium text-gray-800">{title}</h4>
      {typeof answer === 'string' && answer.length > 0 ? (
        <div className="prose prose-sm mt-2 max-w-none break-words text-gray-700">
          <Markdown
            className={{ root: 'leading-6' }}
            content={answer}
            citationLinkScope={scope}
            withCitationLinks
          />
        </div>
      ) : (
        <p className="mt-2 text-sm text-gray-500">
          {t('manage.resources.responseExampleBaselineAnswerUnavailable')}
        </p>
      )}
      <EvidenceList references={references} scope={scope} />
    </section>
  )
}

function caseStatusKey(status: string) {
  switch (status) {
    case 'TARGET_COMPLETE':
      return 'manage.resources.responseExampleBaselineCaseAnswerReady' as const
    case 'COMPLETED':
      return 'manage.resources.responseExampleBaselineCaseCompleted' as const
    case 'UNASSESSED':
      return 'manage.resources.responseExampleBaselineCaseUnassessed' as const
    default:
      return 'manage.resources.responseExampleBaselineCasePending' as const
  }
}

function ChatbotResponseExampleBaseline({
  chatbotId,
  exampleSetDigest,
}: Readonly<{ chatbotId: string; exampleSetDigest: string }>) {
  const t = useTranslations()
  const modeTranslations = useTranslations('chat.modes')
  const [confirmReplacement, setConfirmReplacement] = useState(false)
  const [actionError, setActionError] = useState(false)
  const previousDigest = useRef(exampleSetDigest)
  const { data, loading, error, refetch } = useQuery(
    GetResponseExampleBaselineDocument,
    {
      variables: { chatbotId },
      fetchPolicy: 'network-only',
      notifyOnNetworkStatusChange: true,
    }
  )
  const [startBaseline, { loading: starting }] = useMutation(
    StartResponseExampleBaselineDocument
  )
  const baseline = data?.getResponseExampleBaseline ?? null
  const report = baseline?.report ?? null
  const active = report?.status === 'QUEUED' || report?.status === 'RUNNING'

  useEffect(() => {
    if (previousDigest.current === exampleSetDigest) return
    previousDigest.current = exampleSetDigest
    void refetch().catch(() => undefined)
  }, [exampleSetDigest, refetch])

  useEffect(() => {
    const refreshOnReturn = () => {
      if (document.visibilityState === 'visible') {
        void refetch().catch(() => undefined)
      }
    }
    window.addEventListener('focus', refreshOnReturn)
    document.addEventListener('visibilitychange', refreshOnReturn)
    return () => {
      window.removeEventListener('focus', refreshOnReturn)
      document.removeEventListener('visibilitychange', refreshOnReturn)
    }
  }, [refetch])

  useEffect(() => {
    if (!active) return
    const interval = window.setInterval(() => {
      void refetch().catch(() => undefined)
    }, 2_500)
    return () => window.clearInterval(interval)
  }, [active, refetch])

  const runBaseline = async (replaceActive: boolean) => {
    setActionError(false)
    try {
      const result = await startBaseline({
        variables: {
          chatbotId,
          ...(replaceActive ? { replaceActive: true } : {}),
        },
      })
      if (!result.data?.startResponseExampleBaseline) {
        setActionError(true)
        return
      }
      setConfirmReplacement(false)
      await refetch()
    } catch {
      setActionError(true)
    }
  }

  const completedCount =
    report?.cases.filter(
      (item) => item.status === 'COMPLETED' || item.status === 'UNASSESSED'
    ).length ?? 0
  const unassessedCount =
    report?.cases.filter(
      (item) =>
        item.status === 'UNASSESSED' ||
        (item.status === 'COMPLETED' && !parseAssessment(item.assessment))
    ).length ?? 0
  const statusKey = report
    ? report.status === 'QUEUED'
      ? 'manage.resources.responseExampleBaselineQueued'
      : report.status === 'RUNNING'
        ? 'manage.resources.responseExampleBaselineRunning'
        : report.status === 'COMPLETED'
          ? 'manage.resources.responseExampleBaselineCompleted'
          : report.status === 'FAILED'
            ? 'manage.resources.responseExampleBaselineFailed'
            : 'manage.resources.responseExampleBaselineIncomplete'
    : null
  const statusClass = active
    ? 'bg-blue-100 text-blue-800'
    : report?.status === 'COMPLETED'
      ? 'bg-green-100 text-green-800'
      : report
        ? 'bg-yellow-100 text-yellow-800'
        : 'bg-gray-100 text-gray-800'

  return (
    <section
      className="my-4 rounded-lg border border-gray-200 bg-gray-50 p-4"
      data-cy="response-example-baseline"
      data-report-status={report?.status ?? 'NONE'}
      data-report-stale={report?.stale ? 'true' : 'false'}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-800">
            {t('manage.resources.responseExampleBaselineTitle')}
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            {t('manage.resources.responseExampleBaselineDescription')}
          </p>
        </div>
        <Button
          primary
          disabled={
            loading ||
            starting ||
            (!active && !baseline?.available) ||
            baseline?.eligibleCount === 0
          }
          onClick={() => {
            if (active) setConfirmReplacement(true)
            else void runBaseline(false)
          }}
          data={{ cy: 'response-example-baseline-start' }}
        >
          <Button.Label>
            {active
              ? t('manage.resources.responseExampleBaselineReplace')
              : report
                ? t('manage.resources.responseExampleBaselineRunAgain')
                : t('manage.resources.responseExampleBaselineRun')}
          </Button.Label>
        </Button>
      </div>
      <p className="mt-3 text-xs text-gray-600">
        {t('manage.resources.responseExampleBaselineAllowance')}
      </p>

      {loading && !baseline && (
        <div className="mt-3" role="status" aria-live="polite">
          <Loader />
          <span className="sr-only">
            {t('manage.resources.responseExampleBaselineLoading')}
          </span>
        </div>
      )}
      {error && !report && !loading && (
        <UserNotification
          className={{ root: 'mt-3' }}
          type="error"
          message={t('manage.resources.responseExampleBaselineLoadError')}
        />
      )}
      {baseline && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700">
          <span>
            {t('manage.resources.responseExampleBaselineEligible', {
              count: baseline.eligibleCount,
            })}
          </span>
          <span>
            {t('manage.resources.responseExampleBaselineExcluded', {
              count: baseline.excludedCount,
            })}
          </span>
          {baseline.excludedCount > 0 && (
            <p className="basis-full text-xs text-gray-500">
              {t('manage.resources.responseExampleBaselineExcludedReason')}
            </p>
          )}
        </div>
      )}
      {baseline && !baseline.available && (
        <UserNotification
          className={{ root: 'mt-3' }}
          type="info"
          message={t('manage.resources.responseExampleBaselineUnavailable')}
        />
      )}
      {actionError && (
        <UserNotification
          className={{ root: 'mt-3' }}
          type="error"
          message={t('manage.resources.responseExampleBaselineActionError')}
        />
      )}
      {error && report && (
        <UserNotification
          className={{ root: 'mt-3' }}
          type="error"
          message={t('manage.resources.responseExampleBaselineRefreshError')}
        />
      )}

      {report && (
        <div className="mt-4 border-t border-gray-200 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={twMerge('whitespace-nowrap', statusClass)}>
              {t(statusKey!)}
            </Badge>
            {report.stale && (
              <Badge className="whitespace-nowrap bg-yellow-100 text-yellow-800">
                {t('manage.resources.responseExampleBaselineStale')}
              </Badge>
            )}
            {active && (
              <span className="text-sm text-gray-600" aria-live="polite">
                {t('manage.resources.responseExampleBaselineProgress', {
                  completed: completedCount,
                  total: report.cases.length,
                })}
              </span>
            )}
          </div>
          {report.stale && (
            <p className="mt-2 text-sm text-yellow-800">
              {t('manage.resources.responseExampleBaselineStaleDescription')}
            </p>
          )}
          {report.status === 'FAILED' && (
            <p className="mt-2 text-sm text-gray-600">
              {t('manage.resources.responseExampleBaselineFailedDescription')}
            </p>
          )}
          {report.status === 'INCOMPLETE' && (
            <p className="mt-2 text-sm text-gray-600">
              {t(
                'manage.resources.responseExampleBaselineIncompleteDescription'
              )}
            </p>
          )}
          {!active && unassessedCount > 0 && (
            <p className="mt-2 text-sm text-yellow-800">
              {t('manage.resources.responseExampleBaselineUnassessedSummary', {
                count: unassessedCount,
              })}
            </p>
          )}
          {report.cases.length === 0 && (
            <p className="mt-3 text-sm text-gray-600">
              {t('manage.resources.responseExampleBaselineNoCases')}
            </p>
          )}
          <div className="mt-3 space-y-2">
            {report.cases.map((item) => {
              const assessment = parseAssessment(item.assessment)
              const scope = `baseline-${item.id}`
              const resultKey =
                item.status === 'COMPLETED' && assessment
                  ? assessment.status === 'PASS'
                    ? 'manage.resources.responseExampleBaselinePass'
                    : 'manage.resources.responseExampleBaselineNeedsAttention'
                  : 'manage.resources.responseExampleBaselineNotAssessed'
              return (
                <details
                  key={item.id}
                  className="rounded-md border border-gray-200 bg-white"
                  data-cy="response-example-baseline-case"
                  data-case-status={item.status}
                  data-assessment-status={assessment?.status ?? 'UNASSESSED'}
                >
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 p-3">
                    <span className="min-w-0 flex-1 text-sm font-medium text-gray-800">
                      {item.question}
                    </span>
                    <span className="text-xs text-gray-500">
                      {modeLabel(
                        item.chatMode,
                        modeTranslations,
                        t('manage.resources.responseExampleBaselineOtherMode')
                      )}
                    </span>
                    <Badge className="whitespace-nowrap bg-gray-100 text-gray-700">
                      {t(caseStatusKey(item.status))}
                    </Badge>
                  </summary>
                  <div className="border-t border-gray-100 p-3">
                    <p className="text-sm font-medium text-gray-800">
                      {t(resultKey)}
                    </p>
                    {item.status === 'COMPLETED' && assessment ? (
                      <p className="mt-1 text-sm text-gray-600">
                        {assessment.explanation}
                      </p>
                    ) : item.status === 'TARGET_COMPLETE' ? (
                      <p className="mt-1 text-sm text-gray-600">
                        {t(
                          'manage.resources.responseExampleBaselineAssessmentPending'
                        )}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-gray-500">
                      {t(
                        'manage.resources.responseExampleBaselineSourceSupportUnassessed'
                      )}
                    </p>
                    <div className="mt-3 grid min-w-0 gap-3 lg:grid-cols-2">
                      <AnswerPanel
                        testId="response-example-baseline-answer-actual"
                        title={t(
                          'manage.resources.responseExampleBaselineActualAnswer'
                        )}
                        answer={item.actualAnswer}
                        evidence={item.actualEvidence}
                        scope={`${scope}-actual`}
                      />
                      <AnswerPanel
                        testId="response-example-baseline-answer-ideal"
                        title={t(
                          'manage.resources.responseExampleBaselineIdealAnswer'
                        )}
                        answer={item.idealAnswer}
                        evidence={item.expectedEvidence}
                        scope={`${scope}-ideal`}
                      />
                    </div>
                  </div>
                </details>
              )
            })}
          </div>
        </div>
      )}
      {confirmReplacement && (
        <Modal
          open
          onClose={() => setConfirmReplacement(false)}
          title={t('manage.resources.responseExampleBaselineReplaceTitle')}
          primaryLabel={t(
            'manage.resources.responseExampleBaselineReplaceConfirm'
          )}
          primaryButtonStyle="primary"
          primaryDisabled={starting}
          primaryLoading={starting}
          onPrimaryAction={() => void runBaseline(true)}
          secondaryLabel={t('shared.generic.cancel')}
          onSecondaryAction={() => setConfirmReplacement(false)}
          escapeDisabled={starting}
          dataContent={{ cy: 'response-example-baseline-replace-modal' }}
          dataPrimaryAction={{
            cy: 'response-example-baseline-replace-confirm',
          }}
          dataSecondaryAction={{
            cy: 'response-example-baseline-replace-cancel',
          }}
          className={{ content: 'max-w-lg pb-2' }}
        >
          <p className="text-sm text-gray-700">
            {t('manage.resources.responseExampleBaselineReplaceDescription')}
          </p>
        </Modal>
      )}
    </section>
  )
}

export default ChatbotResponseExampleBaseline
