import { useMutation, useQuery } from '@apollo/client'
import {
  ElementGenerationBuildDocument,
  ElementGenerationBuildStatus,
  ElementGenerationCapabilitiesDocument,
  type ElementGenerationReviewDecision,
  PublishIncompleteElementGenerationDocument,
  RetryElementGenerationDocument,
  ReviewElementGenerationDocument,
  ElementGenerationReviewGate as ReviewGate,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import ElementGenerationReviewGatePanel from './ElementGenerationReviewGate'
import {
  elementGenerationErrorCode,
  isElementGenerationSettled,
} from './elementGenerationTypes'
import GeneratedElementReview from './GeneratedElementReview'

interface ElementGenerationBuildProps {
  buildId: string
  onNew: () => Promise<void>
}

export default function ElementGenerationBuild({
  buildId,
  onNew,
}: ElementGenerationBuildProps) {
  const t = useTranslations('manage.elementGeneration')
  const query = useQuery(ElementGenerationBuildDocument, {
    variables: { id: buildId },
    fetchPolicy: 'network-only',
    notifyOnNetworkStatusChange: true,
  })
  const capabilitiesQuery = useQuery(ElementGenerationCapabilitiesDocument)
  const [reviewGeneration, reviewState] = useMutation(
    ReviewElementGenerationDocument
  )
  const [retryGeneration, retryState] = useMutation(
    RetryElementGenerationDocument
  )
  const [publishIncomplete, publishState] = useMutation(
    PublishIncompleteElementGenerationDocument
  )
  const [actionError, setActionError] = useState<string>()
  const [warningsAcknowledged, setWarningsAcknowledged] = useState(false)
  const build = query.data?.elementGenerationBuild
  const { startPolling, stopPolling } = query

  useEffect(() => {
    if (!build || !isElementGenerationSettled(build.status)) {
      startPolling(2500)
      return () => stopPolling()
    }
    stopPolling()
  }, [build, startPolling, stopPolling])

  if (query.loading && !build) {
    return (
      <div className="flex min-h-72 items-center justify-center" role="status">
        <Loader />
      </div>
    )
  }

  if (query.error || !build) {
    return (
      <div className="space-y-4">
        <UserNotification
          type="error"
          message={t('errors.buildLoad')}
          data={{ cy: 'element-generation-build-error' }}
        />
        <Button type="button" onClick={onNew}>
          <Button.Label>{t('actions.newGeneration')}</Button.Label>
        </Button>
      </div>
    )
  }

  const typeCapability =
    capabilitiesQuery.data?.elementGenerationCapabilities.typeCapabilities.find(
      (capability) => capability.elementType === build.elementType
    )
  const progress = Math.min(
    100,
    Math.max(
      4,
      build.requestedElementCount === 0
        ? 4
        : Math.round(
            (build.generatedElementCount / build.requestedElementCount) * 100
          )
    )
  )
  const isProcessing = !isElementGenerationSettled(build.status)
  const mutationLoading =
    reviewState.loading || retryState.loading || publishState.loading
  const currentBuildId = build.id

  async function refresh() {
    await query.refetch()
  }

  async function runAction(action: () => Promise<unknown>) {
    setActionError(undefined)
    try {
      await action()
      await refresh()
    } catch (error) {
      const code = elementGenerationErrorCode(error)
      setActionError(code ? t('errors.withCode', { code }) : t('errors.action'))
    }
  }

  async function review(
    gate: ReviewGate,
    decision: ElementGenerationReviewDecision,
    acknowledged: boolean
  ) {
    await runAction(() =>
      reviewGeneration({
        variables: {
          input: {
            buildId: currentBuildId,
            gate,
            decision,
            warningsAcknowledged: acknowledged,
          },
        },
      })
    )
  }

  return (
    <div className="space-y-6" data-cy="element-generation-build">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-cyan-700 px-2 py-1 text-xs font-bold text-white">
                {build.elementType}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                {t(`statuses.${build.status}`)}
              </span>
            </div>
            <h2 className="mt-3 text-2xl font-semibold text-slate-900">
              {t('build.title', {
                type: t(`elementTypes.${build.elementType}.label`),
              })}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {t('build.stage', { stage: build.stage })}
            </p>
          </div>
          <Button
            type="button"
            onClick={onNew}
            data={{ cy: 'element-generation-new' }}
          >
            <Button.Label>{t('actions.newGeneration')}</Button.Label>
          </Button>
        </div>

        <div className="mt-6">
          <div className="flex justify-between gap-3 text-sm text-slate-600">
            <span>
              {t('build.generatedCount', {
                generated: build.generatedElementCount,
                requested: build.requestedElementCount,
              })}
            </span>
            <span>{progress}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-cyan-700 transition-[width]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg bg-slate-50 p-3">
            <dt className="text-slate-500">{t('build.generated')}</dt>
            <dd className="mt-1 text-lg font-semibold text-slate-900">
              {build.generatedElementCount}
            </dd>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <dt className="text-slate-500">{t('build.unresolved')}</dt>
            <dd className="mt-1 text-lg font-semibold text-slate-900">
              {build.unresolvedElementCount}
            </dd>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <dt className="text-slate-500">{t('build.warnings')}</dt>
            <dd className="mt-1 text-lg font-semibold text-slate-900">
              {build.warningCount}
            </dd>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <dt className="text-slate-500">{t('build.retries')}</dt>
            <dd className="mt-1 text-lg font-semibold text-slate-900">
              {build.retryCount}
            </dd>
          </div>
        </dl>
      </section>

      {isProcessing ? (
        <section className="rounded-xl border border-cyan-200 bg-cyan-50 p-6 text-center">
          <div className="flex justify-center" role="status">
            <Loader />
          </div>
          <h2 className="mt-4 font-semibold text-cyan-950">
            {t('build.processing')}
          </h2>
          <p className="mt-1 text-sm text-cyan-900">
            {t('build.processingHelp')}
          </p>
        </section>
      ) : null}

      {build.status === ElementGenerationBuildStatus.WaitingForDesignReview ? (
        <ElementGenerationReviewGatePanel
          build={build}
          gate={ReviewGate.Design}
          loading={mutationLoading}
          onReview={(decision, acknowledged) =>
            review(ReviewGate.Design, decision, acknowledged)
          }
        />
      ) : null}

      {build.status === ElementGenerationBuildStatus.WaitingForPlanReview ? (
        <ElementGenerationReviewGatePanel
          build={build}
          gate={ReviewGate.Plan}
          loading={mutationLoading}
          onReview={(decision, acknowledged) =>
            review(ReviewGate.Plan, decision, acknowledged)
          }
        />
      ) : null}

      {build.status === ElementGenerationBuildStatus.Failed ? (
        <section className="rounded-xl border border-red-200 bg-red-50 p-5">
          <h2 className="font-semibold text-red-950">{t('build.failed')}</h2>
          <p className="mt-2 text-sm text-red-900">
            {build.errorMessage ?? t('build.failedHelp')}
          </p>
          {build.errorCode ? (
            <p className="mt-2 text-xs text-red-800">{build.errorCode}</p>
          ) : null}
          {typeCapability?.supportsRetry && build.errorRetryable ? (
            <Button
              type="button"
              disabled={mutationLoading}
              onClick={() =>
                runAction(() =>
                  retryGeneration({
                    variables: { input: { buildId: build.id } },
                  })
                )
              }
              className={{ root: 'mt-4' }}
              data={{ cy: 'element-generation-retry' }}
            >
              <Button.Label>{t('actions.retry')}</Button.Label>
            </Button>
          ) : null}
        </section>
      ) : null}

      {build.status ===
      ElementGenerationBuildStatus.AwaitingIncompletePublication ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="font-semibold text-amber-950">
            {t('build.incompleteTitle')}
          </h2>
          <p className="mt-2 text-sm text-amber-900">
            {t('build.incompleteHelp', {
              generated: build.generatedElementCount,
              requested: build.requestedElementCount,
            })}
          </p>
          <label className="mt-4 flex items-start gap-2 text-sm text-amber-950">
            <input
              type="checkbox"
              checked={warningsAcknowledged}
              onChange={(event) =>
                setWarningsAcknowledged(event.target.checked)
              }
              className="mt-1 h-4 w-4"
              data-cy="element-generation-incomplete-acknowledged"
            />
            <span>{t('build.incompleteAcknowledge')}</span>
          </label>
          <div className="mt-4 flex flex-wrap gap-3">
            {typeCapability?.supportsRetry ? (
              <Button
                type="button"
                disabled={mutationLoading}
                onClick={() =>
                  runAction(() =>
                    retryGeneration({
                      variables: { input: { buildId: build.id } },
                    })
                  )
                }
                data={{ cy: 'element-generation-retry-incomplete' }}
              >
                <Button.Label>{t('actions.retry')}</Button.Label>
              </Button>
            ) : null}
            {typeCapability?.supportsIncompletePublication ? (
              <Button
                primary
                type="button"
                disabled={mutationLoading || !warningsAcknowledged}
                onClick={() =>
                  runAction(() =>
                    publishIncomplete({
                      variables: {
                        input: {
                          buildId: build.id,
                          warningsAcknowledged,
                        },
                      },
                    })
                  )
                }
                data={{ cy: 'element-generation-publish-incomplete' }}
              >
                <Button.Label>{t('actions.publishIncomplete')}</Button.Label>
              </Button>
            ) : null}
          </div>
        </section>
      ) : null}

      {build.status === ElementGenerationBuildStatus.Rejected ? (
        <UserNotification
          type="warning"
          message={t('build.rejected')}
          data={{ cy: 'element-generation-rejected' }}
        />
      ) : null}

      {(build.status === ElementGenerationBuildStatus.Completed ||
        build.status === ElementGenerationBuildStatus.Incomplete) &&
      build.drafts.length > 0 ? (
        <GeneratedElementReview build={build} onChanged={refresh} />
      ) : null}

      {(build.status === ElementGenerationBuildStatus.Completed ||
        build.status === ElementGenerationBuildStatus.Incomplete) &&
      build.drafts.length === 0 ? (
        <UserNotification
          type="warning"
          message={t('build.noDrafts')}
          data={{ cy: 'element-generation-no-drafts' }}
        />
      ) : null}

      {actionError ? (
        <UserNotification
          type="error"
          message={actionError}
          data={{ cy: 'element-generation-action-error' }}
        />
      ) : null}
    </div>
  )
}
