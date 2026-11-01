import type { KbMaterialsReadiness } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import React from 'react'

/**
 * How far a knowledge base's materials can already be used by a connected
 * chatbot. It describes retrieval only; whether questions can be generated
 * from the materials is a separate readiness.
 */
function KnowledgeBaseMaterialsReadiness({
  metrics,
}: {
  metrics: Omit<KbMaterialsReadiness, '__typename'>
}) {
  const t = useTranslations()
  const parts =
    metrics.visibleResourceCount === 0
      ? [t('kb.materialsReadinessNone')]
      : [
          t('kb.materialsReadinessAvailable', {
            available: metrics.servingResourceCount,
            total: metrics.visibleResourceCount,
          }),
          ...(metrics.processingResourceCount > 0
            ? [
                t('kb.materialsReadinessProcessing', {
                  count: metrics.processingResourceCount,
                }),
              ]
            : []),
          ...(metrics.failedResourceCount > 0
            ? [
                t('kb.materialsReadinessFailed', {
                  count: metrics.failedResourceCount,
                }),
              ]
            : []),
        ]

  return (
    <span
      className={`block text-xs ${
        metrics.failedResourceCount > 0 ? 'text-red-700' : 'text-slate-500'
      }`}
      data-cy="kb-materials-readiness"
    >
      {parts.join(' · ')}
    </span>
  )
}

export default KnowledgeBaseMaterialsReadiness
