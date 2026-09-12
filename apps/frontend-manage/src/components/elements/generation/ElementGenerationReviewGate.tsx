import {
  ElementGenerationReviewDecision,
  ElementGenerationReviewGate as ReviewGate,
} from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import type { ElementGenerationBuildData } from './elementGenerationTypes'

interface ElementGenerationReviewGateProps {
  build: ElementGenerationBuildData
  gate: ReviewGate
  loading: boolean
  onReview: (
    decision: ElementGenerationReviewDecision,
    warningsAcknowledged: boolean
  ) => Promise<void>
}

export default function ElementGenerationReviewGate({
  build,
  gate,
  loading,
  onReview,
}: ElementGenerationReviewGateProps) {
  const t = useTranslations('manage.elementGeneration')
  const [warningsAcknowledged, setWarningsAcknowledged] = useState(false)
  const summary =
    gate === ReviewGate.Design ? build.designSummary : build.planSummary

  if (!summary) return null

  const warnings = summary.warnings
  const canApprove = warnings.length === 0 || warningsAcknowledged

  return (
    <section
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:p-6"
      data-cy={`element-generation-${gate.toLowerCase()}-review`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">
            {t('gate.eyebrow')}
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-900">
            {t(
              gate === ReviewGate.Design ? 'gate.designTitle' : 'gate.planTitle'
            )}
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            {t(
              gate === ReviewGate.Design
                ? 'gate.designDescription'
                : 'gate.planDescription'
            )}
          </p>
        </div>
        <span className="rounded-full bg-cyan-50 px-3 py-1 text-sm font-semibold text-cyan-900">
          {t('gate.elementCount', { count: summary.elementCount })}
        </span>
      </div>

      {gate === ReviewGate.Design && build.designSummary ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-900">
              {build.designSummary.title}
            </h3>
            <dl className="mt-3 space-y-2 text-sm">
              {build.designSummary.modules.map((module) => (
                <div
                  key={module.moduleId}
                  className="flex justify-between gap-4"
                >
                  <dt className="text-slate-600">{module.moduleName}</dt>
                  <dd className="font-medium text-slate-900">
                    {module.elementCount}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="rounded-lg border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-900">
              {t('gate.objectives')}
            </h3>
            {build.designSummary.objectives.length > 0 ? (
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
                {build.designSummary.objectives.map((objective) => (
                  <li key={objective.id}>
                    {objective.text}
                    {objective.bloomLevel ? (
                      <span className="ml-2 text-xs text-slate-500">
                        {t(`bloom.${objective.bloomLevel}`)}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                {t('gate.noObjectives')}
              </p>
            )}
          </div>
        </div>
      ) : null}

      {gate === ReviewGate.Plan && build.planSummary ? (
        <div className="mt-6 space-y-3">
          {build.planSummary.elements.map((element, index) => (
            <article
              key={element.sourceElementId}
              className="rounded-lg border border-slate-200 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-500">
                    {t('gate.elementNumber', { number: index + 1 })}
                  </p>
                  <p className="mt-1 text-sm text-slate-900">
                    {element.preview}
                  </p>
                </div>
                <div className="flex gap-2 text-xs">
                  {element.bloomLevel ? (
                    <span className="rounded-full bg-orange-50 px-2 py-1 text-orange-900">
                      {t(`bloom.${element.bloomLevel}`)}
                    </span>
                  ) : null}
                  {element.targetDifficulty ? (
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                      {t('gate.difficulty', {
                        difficulty: element.targetDifficulty,
                      })}
                    </span>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h3 className="font-semibold text-amber-950">
            {t('gate.warnings', { count: warnings.length })}
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
            {warnings.map((warning) => (
              <li key={`${warning.code}-${warning.message}`}>
                {warning.message}
              </li>
            ))}
          </ul>
          <label className="mt-4 flex items-start gap-2 text-sm text-amber-950">
            <input
              type="checkbox"
              checked={warningsAcknowledged}
              onChange={(event) =>
                setWarningsAcknowledged(event.target.checked)
              }
              className="mt-1 h-4 w-4"
              data-cy="element-generation-warnings-acknowledged"
            />
            <span>{t('gate.acknowledgeWarnings')}</span>
          </label>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-5">
        <Button
          type="button"
          disabled={loading}
          onClick={() =>
            onReview(ElementGenerationReviewDecision.Reject, false)
          }
          data={{ cy: 'element-generation-reject-gate' }}
        >
          <Button.Label>{t('gate.reject')}</Button.Label>
        </Button>
        <Button
          primary
          type="button"
          disabled={loading || !canApprove}
          onClick={() =>
            onReview(
              ElementGenerationReviewDecision.Approve,
              warningsAcknowledged
            )
          }
          data={{ cy: 'element-generation-approve-gate' }}
        >
          <Button.Label>
            {loading ? t('gate.submitting') : t('gate.approve')}
          </Button.Label>
        </Button>
      </div>
    </section>
  )
}
