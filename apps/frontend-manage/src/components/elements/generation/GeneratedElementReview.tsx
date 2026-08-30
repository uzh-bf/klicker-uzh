import { useMutation } from '@apollo/client'
import {
  ElementDisplayMode,
  ElementStatus,
  ElementType,
  GeneratedElementDecision,
  KeepGeneratedElementDraftDocument,
  SaveGeneratedElementsDocument,
  SetGeneratedElementDecisionDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, toast, UserNotification } from '@uzh-bf/design-system'
import { useFormatter, useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import ElementEditForm from '../manipulation/ElementEditForm'
import { ElementEditMode } from '../manipulation/ElementEditModal'
import {
  prepareChoicesArgs,
  prepareFlashcardArgs,
} from '../manipulation/helpers'
import type { ElementFormTypes } from '../manipulation/types'
import type {
  ElementGenerationBuildData,
  GeneratedElementDraftData,
} from './elementGenerationTypes'

type ReviewFilter = 'all' | 'open' | 'attention' | 'kept' | 'discarded'

function draftNeedsAttention(draft: GeneratedElementDraftData) {
  return (
    draft.savedElementId === null &&
    (draft.decision === GeneratedElementDecision.Accepted ||
      (draft.decision === GeneratedElementDecision.Open &&
        draft.qualityFlags.length > 0))
  )
}

function draftMatchesFilter(
  draft: GeneratedElementDraftData,
  filter: ReviewFilter
) {
  switch (filter) {
    case 'all':
      return true
    case 'open':
      return (
        draft.decision === GeneratedElementDecision.Open &&
        !draftNeedsAttention(draft)
      )
    case 'attention':
      return draftNeedsAttention(draft)
    case 'kept':
      return (
        draft.decision === GeneratedElementDecision.Accepted &&
        draft.savedElementId !== null
      )
    case 'discarded':
      return draft.decision === GeneratedElementDecision.Rejected
  }
}

function draftStatusClass(
  draft: GeneratedElementDraftData,
  needsAttention: boolean
) {
  if (draft.decision === GeneratedElementDecision.Accepted && !needsAttention) {
    return 'rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800'
  }
  if (draft.decision === GeneratedElementDecision.Rejected) {
    return 'rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700'
  }
  return 'rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900'
}

function difficultyLabelKey(level: number | null | undefined) {
  switch (level) {
    case 1:
      return 'difficulty.D1.label' as const
    case 2:
      return 'difficulty.D2.label' as const
    case 3:
      return 'difficulty.D3.label' as const
    case 4:
      return 'difficulty.D4.label' as const
    case 5:
      return 'difficulty.D5.label' as const
    default:
      return undefined
  }
}

function formElementType(type: GeneratedElementDraftData['elementType']) {
  switch (type) {
    case 'SC':
      return ElementType.Sc
    case 'MC':
      return ElementType.Mc
    case 'KPRIM':
      return ElementType.Kprim
    case 'FLASHCARD':
      return ElementType.Flashcard
    default:
      throw new Error('Unsupported generated element type')
  }
}

function draftToFormValues(draft: GeneratedElementDraftData): ElementFormTypes {
  const current = draft.current
  const type = formElementType(draft.elementType)
  const shared = {
    name: current.name,
    status: ElementStatus.Review,
    content: [current.context, current.prompt].filter(Boolean).join('\n\n'),
    explanation: current.explanation ?? '',
    tags: current.tags,
    basePoints: draft.elementType !== 'FLASHCARD',
    pointsMultiplier: '1',
  }

  if (type === ElementType.Flashcard) {
    return { ...shared, type }
  }

  return {
    ...shared,
    type,
    options: {
      hasSampleSolution: true,
      hasAnswerFeedbacks: current.choices.some((choice) =>
        Boolean(choice.feedback)
      ),
      displayMode: ElementDisplayMode.List,
      choices: current.choices.map((choice, ix) => ({
        id: choice.id,
        ix,
        value: choice.text,
        correct: choice.correct,
        feedback: choice.feedback ?? '',
      })),
    },
  }
}

function sourceLabel(
  build: ElementGenerationBuildData,
  draft: GeneratedElementDraftData,
  formatPage: (page: number) => string,
  formatPages: (pageFrom: number, pageTo: number) => string
) {
  const labels = draft.citations.flatMap((citation) => {
    const source = sourceForCitation(build, citation.resourceId)
    const label = source?.title
    if (!label) return []
    const pages = citationPages(citation, formatPage, formatPages)
    return [`${label}${pages ? `, ${pages}` : ''}`]
  })
  return [...new Set(labels)].join('; ') || undefined
}

function sourceForCitation(
  build: ElementGenerationBuildData,
  resourceId: string
) {
  return build.sources.find((item) => item.resourceId === resourceId)
}

function citationPages(
  citation: GeneratedElementDraftData['citations'][number],
  formatPage: (page: number) => string,
  formatPages: (pageFrom: number, pageTo: number) => string
) {
  const pageFrom = citation.pageFrom
  if (pageFrom === null || pageFrom === undefined) return undefined
  const pageTo = citation.pageTo
  return pageTo !== null && pageTo !== undefined && pageTo !== pageFrom
    ? formatPages(pageFrom, pageTo)
    : formatPage(pageFrom)
}

function GeneratedDraftSources({
  build,
  draft,
}: {
  build: ElementGenerationBuildData
  draft: GeneratedElementDraftData
}) {
  const t = useTranslations('manage.elementGeneration')
  const sources = draft.citations.flatMap((citation) => {
    const source = sourceForCitation(build, citation.resourceId)
    if (!source) return []
    return [{ ...source, citation }]
  })

  return (
    <section
      className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4"
      data-cy="generated-element-sources"
    >
      <h3 className="font-semibold text-slate-900">
        {t('review.sourcesTitle')}
      </h3>
      {sources.length === 0 ? (
        <p className="mt-1 text-sm text-slate-600">
          {t('review.sourceUnavailable')}
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {sources.map(
            ({ citation, resourceId, sourceUrl, title, type }, ix) => {
              const pages = citationPages(
                citation,
                (page) => t('review.sourcePage', { page }),
                (from, to) => t('review.sourcePages', { from, to })
              )
              return (
                <li
                  key={`${resourceId}-${citation.pageFrom}-${citation.pageTo}`}
                >
                  {sourceUrl ? (
                    <a
                      className="font-medium text-blue-700 underline"
                      data-cy={`generated-element-source-${ix}`}
                      href={sourceUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {title}
                    </a>
                  ) : (
                    <span className="font-medium text-slate-900">{title}</span>
                  )}
                  <span className="ml-2 text-sm text-slate-600">
                    {t(`review.sourceTypes.${type}`)}
                    {pages ? ` · ${pages}` : ''}
                  </span>
                </li>
              )
            }
          )}
        </ul>
      )}
    </section>
  )
}

function GeneratedDraftEditor({
  draft,
  build,
  onClose,
  onChanged,
}: {
  draft: GeneratedElementDraftData
  build: ElementGenerationBuildData
  onClose: () => void
  onChanged: () => Promise<void>
}) {
  const t = useTranslations('manage.elementGeneration')
  const initialValues = useMemo(() => draftToFormValues(draft), [draft])
  const [keepDraft] = useMutation(KeepGeneratedElementDraftDocument)
  const [setDecision] = useMutation(SetGeneratedElementDecisionDocument)

  return (
    <ElementEditForm
      mode={ElementEditMode.EDIT}
      loading={false}
      initialValues={initialValues}
      titleOverride={t('review.editTitle')}
      submitLabel={t('review.keep')}
      submitErrorMessage={t('review.actionError')}
      submitDataCy={`generated-element-keep-${draft.id}`}
      secondaryAction={{
        label: t('review.discard'),
        dataCy: `generated-element-discard-${draft.id}`,
        onClick: async () => {
          try {
            const result = await setDecision({
              variables: {
                input: {
                  draftId: draft.id,
                  decision: GeneratedElementDecision.Rejected,
                },
              },
            })
            if (
              result.data?.setGeneratedElementDecision.decision !==
              GeneratedElementDecision.Rejected
            ) {
              throw new Error('Generated element was not discarded')
            }
            await onChanged()
            onClose()
          } catch {
            toast({ type: 'error', message: t('review.actionError') })
          }
        },
      }}
      supplementaryContent={
        <GeneratedDraftSources build={build} draft={draft} />
      }
      discardChangesPrompt={{
        title: t('review.discardChangesTitle'),
        message: t('review.discardChangesMessage'),
        confirmLabel: t('review.discardChangesConfirm'),
      }}
      onClose={onClose}
      onSuccess={onClose}
      setAutoSavedElement={(_value) => undefined}
      updateInstances={false}
      setUpdateInstances={(_value) => undefined}
      includeTemplateUpdates={false}
      setIncludeTemplateUpdates={(_value) => undefined}
      onSubmitElement={async (values) => {
        try {
          const variables = (() => {
            if (values.type === ElementType.Flashcard) {
              return prepareFlashcardArgs({
                elementId: undefined,
                isDuplication: true,
                values,
              })
            }
            if (
              values.type === ElementType.Sc ||
              values.type === ElementType.Mc ||
              values.type === ElementType.Kprim
            ) {
              return prepareChoicesArgs({
                elementId: undefined,
                isDuplication: true,
                values,
              })
            }
            return undefined
          })()
          if (!variables) return false
          const result = await keepDraft({
            variables: {
              draftId: draft.id,
              expectedRevision: draft.revision,
              status: values.status,
              type: values.type,
              name: variables.name,
              content: variables.content,
              explanation: variables.explanation,
              options: 'options' in variables ? variables.options : undefined,
              basePoints: variables.basePoints,
              pointsMultiplier: variables.pointsMultiplier,
              tags: variables.tags,
            },
          })
          if (!result.data?.keepGeneratedElementDraft.savedElementId)
            return false
          await onChanged()
          return true
        } catch {
          return false
        }
      }}
    />
  )
}

export default function GeneratedElementReview({
  build,
  onChanged,
}: {
  build: ElementGenerationBuildData
  onChanged: () => Promise<void>
}) {
  const t = useTranslations('manage.elementGeneration')
  const format = useFormatter()
  const [filter, setFilter] = useState<ReviewFilter>('all')
  const [selectedDraft, setSelectedDraft] =
    useState<GeneratedElementDraftData>()
  const [saveElements, saveState] = useMutation(SaveGeneratedElementsDocument)
  const [setDecision] = useMutation(SetGeneratedElementDecisionDocument)
  const [savedCount, setSavedCount] = useState<number>()
  const [saveError, setSaveError] = useState(false)

  const counts = {
    all: build.drafts.length,
    open: build.drafts.filter((draft) => draftMatchesFilter(draft, 'open'))
      .length,
    attention: build.drafts.filter((draft) =>
      draftMatchesFilter(draft, 'attention')
    ).length,
    kept: build.drafts.filter((draft) => draftMatchesFilter(draft, 'kept'))
      .length,
    discarded: build.drafts.filter((draft) =>
      draftMatchesFilter(draft, 'discarded')
    ).length,
  }
  const drafts = build.drafts.filter((draft) =>
    draftMatchesFilter(draft, filter)
  )
  const legacyAccepted = build.drafts.filter(
    (draft) =>
      draft.decision === GeneratedElementDecision.Accepted &&
      draft.savedElementId === null
  )

  async function recoverLegacy() {
    setSaveError(false)
    try {
      const result = await saveElements({
        variables: { input: { buildId: build.id } },
      })
      const saved = result.data?.saveGeneratedElements
      setSavedCount(
        (saved?.createdElementIds.length ?? 0) +
          (saved?.alreadySavedElementIds.length ?? 0)
      )
      await onChanged()
    } catch {
      setSaveError(true)
    }
  }

  return (
    <section data-cy="generated-element-review">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">
              {t('review.title')}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {t('review.countSummary', counts)}
            </p>
          </div>
          {legacyAccepted.length > 0 ? (
            <Button
              primary
              type="button"
              disabled={saveState.loading}
              onClick={recoverLegacy}
              data={{ cy: 'element-generation-recover-legacy' }}
            >
              <Button.Label>{t('review.recoverLegacy')}</Button.Label>
            </Button>
          ) : null}
        </div>
        <fieldset className="mt-4 flex flex-wrap gap-2">
          <legend className="sr-only">{t('review.filterLabel')}</legend>
          {(
            ['all', 'open', 'attention', 'kept', 'discarded'] as ReviewFilter[]
          ).map((value) => (
            <Button
              key={value}
              type="button"
              primary={filter === value}
              onClick={() => setFilter(value)}
              data={{ cy: `element-generation-filter-${value}` }}
            >
              <Button.Label>
                {t(`review.filters.${value}`, { count: counts[value] })}
              </Button.Label>
            </Button>
          ))}
        </fieldset>
      </div>
      {typeof savedCount === 'number' ? (
        <UserNotification
          type="success"
          message={t('review.savedElements', { count: savedCount })}
        />
      ) : null}
      {saveError ? (
        <UserNotification
          type="error"
          message={t('review.saveElementsError')}
        />
      ) : null}
      <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3" scope="col">
                {t('review.columns.element')}
              </th>
              <th className="px-4 py-3" scope="col">
                {t('review.columns.type')}
              </th>
              <th className="px-4 py-3" scope="col">
                {t('review.columns.source')}
              </th>
              <th className="px-4 py-3" scope="col">
                {t('review.columns.learningDesign')}
              </th>
              <th className="px-4 py-3" scope="col">
                {t('review.columns.status')}
              </th>
              <th className="px-4 py-3" scope="col">
                {t('review.columns.updated')}
              </th>
              <th className="px-4 py-3" scope="col">
                {t('review.columns.actions')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {drafts.map((draft) => {
              const needsAttention = draftNeedsAttention(draft)
              const difficultyKey = difficultyLabelKey(draft.targetDifficulty)
              const editable =
                draft.decision === GeneratedElementDecision.Open ||
                needsAttention
              const sourceTypes = [
                ...new Set(
                  draft.citations.flatMap((citation) => {
                    const source = sourceForCitation(build, citation.resourceId)
                    return source ? [source.type] : []
                  })
                ),
              ]
              return (
                <tr
                  key={draft.id}
                  data-cy={`generated-element-row-${draft.id}`}
                >
                  <td className="max-w-sm px-4 py-3">
                    <div className="font-medium text-slate-900">
                      {draft.current.name}
                    </div>
                    <div className="mt-1 line-clamp-2 text-xs text-slate-600">
                      {draft.current.prompt}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {t(`elementTypes.${draft.elementType}.label`)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {sourceLabel(
                      build,
                      draft,
                      (page) => t('review.sourcePage', { page }),
                      (from, to) => t('review.sourcePages', { from, to })
                    ) ?? t('review.sourceUnavailable')}
                    {sourceTypes.length > 0 ? (
                      <div className="mt-1 text-xs text-slate-500">
                        {sourceTypes
                          .map((type) => t(`review.sourceTypes.${type}`))
                          .join(', ')}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <div>
                      {draft.bloomLevel
                        ? t('review.bloomLevel', {
                            level: t(`bloom.${draft.bloomLevel}`),
                          })
                        : t('review.notApplicable')}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {difficultyKey
                        ? t('review.difficultyLevel', {
                            level: t(difficultyKey),
                          })
                        : t('review.notApplicable')}
                    </div>
                    {draft.qualityFlags.length > 0 ? (
                      <div className="mt-1 text-xs font-medium text-amber-800">
                        {t('review.qualityAttention')}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <span className={draftStatusClass(draft, needsAttention)}>
                      {needsAttention
                        ? t('review.states.ATTENTION')
                        : t(`review.states.${draft.decision}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {format.dateTime(new Date(draft.updatedAt), {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {editable ? (
                        <Button
                          type="button"
                          onClick={() => setSelectedDraft(draft)}
                          data={{ cy: `element-generation-open-${draft.id}` }}
                        >
                          <Button.Label>{t('review.open')}</Button.Label>
                        </Button>
                      ) : null}
                      {draft.savedElementId ? (
                        <a
                          data-cy={`element-generation-open-saved-${draft.id}`}
                          className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2"
                          href={`/?editElementId=${draft.savedElementId}`}
                        >
                          {t('review.openSaved')}
                        </a>
                      ) : null}
                      {draft.decision === GeneratedElementDecision.Rejected ? (
                        <Button
                          type="button"
                          onClick={async () => {
                            try {
                              const result = await setDecision({
                                variables: {
                                  input: {
                                    draftId: draft.id,
                                    decision: GeneratedElementDecision.Open,
                                  },
                                },
                              })
                              if (
                                result.data?.setGeneratedElementDecision
                                  .decision !== GeneratedElementDecision.Open
                              ) {
                                throw new Error(
                                  'Generated element was not restored'
                                )
                              }
                              await onChanged()
                            } catch {
                              toast({
                                type: 'error',
                                message: t('review.actionError'),
                              })
                            }
                          }}
                          data={{
                            cy: `element-generation-restore-${draft.id}`,
                          }}
                        >
                          <Button.Label>{t('review.restore')}</Button.Label>
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              )
            })}
            {drafts.length === 0 ? (
              <tr>
                <td
                  className="px-4 py-8 text-center text-slate-600"
                  colSpan={7}
                >
                  {t('review.emptyFilter')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {selectedDraft ? (
        <GeneratedDraftEditor
          build={build}
          draft={selectedDraft}
          onClose={() => setSelectedDraft(undefined)}
          onChanged={onChanged}
        />
      ) : null}
    </section>
  )
}
