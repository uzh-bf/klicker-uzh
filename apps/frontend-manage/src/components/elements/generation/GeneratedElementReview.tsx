import { useMutation, useQuery } from '@apollo/client'
import {
  ElementDisplayMode,
  ElementGenerationBuildStatus,
  ElementStatus,
  ElementType,
  GeneratableElementType,
  GeneratedElementDecision,
  GetUserTagsDocument,
  KeepGeneratedElementDraftDocument,
  RetryElementGenerationDocument,
  SaveGeneratedElementsDocument,
  SetGeneratedElementDecisionDocument,
  type Tag,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, toast, UserNotification } from '@uzh-bf/design-system'
import { useFormatter, useTranslations } from 'next-intl'
import { Fragment, useMemo, useState } from 'react'
import ElementEditForm from '../manipulation/ElementEditForm'
import { ElementEditMode } from '../manipulation/ElementEditModal'
import {
  prepareChoicesArgs,
  prepareFlashcardArgs,
} from '../manipulation/helpers'
import type { ElementFormTypes } from '../manipulation/types'
import {
  type ElementGenerationBuildData,
  type GeneratedElementDraftData,
  isRevisionBuildFinished,
} from './elementGenerationTypes'
import GeneratedTagSelector from './GeneratedTagSelector'
import {
  draftSuggestedTags,
  groupTagSuggestions,
  persistedTagSelection,
  selectedTagNames,
} from './generatedTagSelection'
import useGeneratedTagSelection from './useGeneratedTagSelection'

type ReviewFilter = 'all' | 'open' | 'attention' | 'kept' | 'discarded'

const MAX_REVISION_NOTE_LENGTH = 1000

// Request history of a draft, oldest first; the newest request is the one that
// drives the draft's current state.
function sortedRevisionBuilds(draft: GeneratedElementDraftData) {
  return [...draft.revisionBuilds].sort(
    (left, right) =>
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
  )
}

function draftHasUnfinishedRevision(draft: GeneratedElementDraftData) {
  return draft.revisionBuilds.some(
    (revisionBuild) => !isRevisionBuildFinished(revisionBuild.status)
  )
}

function toGeneratableElementType(type: ElementType) {
  switch (type) {
    case ElementType.Sc:
      return GeneratableElementType.Sc
    case ElementType.Mc:
      return GeneratableElementType.Mc
    case ElementType.Kprim:
      return GeneratableElementType.Kprim
    case ElementType.Flashcard:
      return GeneratableElementType.Flashcard
    default:
      return undefined
  }
}

function draftNeedsAttention(draft: GeneratedElementDraftData) {
  return (
    draft.savedElementId === null &&
    (draft.decision === GeneratedElementDecision.Accepted ||
      (draft.decision === GeneratedElementDecision.Open &&
        draft.qualityFlags.length > 0))
  )
}

type QualityReasonKey =
  | 'review.qualityReasons.difficultyReviewRequired'
  | 'review.qualityReasons.difficultyValidationFailed'
  | 'review.qualityReasons.manualReviewRequired'
  | 'review.qualityReasons.other'
  | 'review.qualityReasons.acceptedUnsaved'

const QUALITY_FLAG_REASON_KEYS = new Map<string, QualityReasonKey>([
  [
    'difficulty_review_required',
    'review.qualityReasons.difficultyReviewRequired',
  ],
  [
    'difficulty_validation_failed',
    'review.qualityReasons.difficultyValidationFailed',
  ],
  ['manual_review_required', 'review.qualityReasons.manualReviewRequired'],
])

// Quality flags are bounded but open-ended strings from the generation worker.
// Known flags receive a dedicated reason; all unknown flags collapse into a
// single generic reason, so raw upstream values never reach the interface.
function draftQualityReasonKeys(draft: GeneratedElementDraftData) {
  const reasonKeys = [
    ...new Set(
      draft.qualityFlags.flatMap((flag) => {
        const reasonKey = QUALITY_FLAG_REASON_KEYS.get(flag)
        return reasonKey ? [reasonKey] : []
      })
    ),
  ]
  if (draft.qualityFlags.some((flag) => !QUALITY_FLAG_REASON_KEYS.has(flag))) {
    reasonKeys.push('review.qualityReasons.other')
  }
  if (
    draft.decision === GeneratedElementDecision.Accepted &&
    draft.savedElementId === null
  ) {
    reasonKeys.push('review.qualityReasons.acceptedUnsaved')
  }
  return reasonKeys
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
        (draft.decision === GeneratedElementDecision.Open ||
          draft.decision === GeneratedElementDecision.RevisionRequested) &&
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
    return 'inline-block rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800'
  }
  if (draft.decision === GeneratedElementDecision.Rejected) {
    return 'inline-block rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700'
  }
  return 'inline-block rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900'
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

function safeSourceUrl(sourceUrl: string | null | undefined) {
  if (!sourceUrl) return undefined
  try {
    const parsed = new URL(sourceUrl)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
      ? parsed.toString()
      : undefined
  } catch {
    return undefined
  }
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
              const href = safeSourceUrl(sourceUrl)
              return (
                <li
                  key={`${resourceId}-${citation.sourceFile}-${citation.pageFrom}-${citation.pageTo}-${citation.chunkIds.join('-')}`}
                >
                  {href ? (
                    <a
                      className="font-medium text-blue-700 underline"
                      data-cy={`generated-element-source-${ix}`}
                      href={href}
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
  const tShared = useTranslations('shared.generic')
  const initialValues = useMemo(() => draftToFormValues(draft), [draft])
  const [keepDraft] = useMutation(KeepGeneratedElementDraftDocument)
  const [setDecision] = useMutation(SetGeneratedElementDecisionDocument)
  const isQuestion = draft.elementType !== GeneratableElementType.Flashcard
  const {
    data: tagData,
    loading: tagsLoading,
    error: tagsError,
    refetch: refreshTags,
  } = useQuery(GetUserTagsDocument, {
    skip: !isQuestion,
    fetchPolicy: 'network-only',
  })
  const ownerTags = useMemo(
    () => (tagData?.userTags ?? []).filter((tag): tag is Tag => tag !== null),
    [tagData]
  )
  const persistedSelection = useMemo(
    () => persistedTagSelection(draft.current),
    [draft.current]
  )
  const selection = useGeneratedTagSelection({
    persistedSelection,
    selectableExisting: ownerTags,
  })
  const [revision, setRevision] = useState(draft.revision)
  const [savingDraft, setSavingDraft] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const groups = useMemo(
    () => groupTagSuggestions(draftSuggestedTags(draft), ownerTags),
    [draft, ownerTags]
  )
  const readyValues = useMemo(
    () => ({
      ...initialValues,
      tags: isQuestion
        ? selectedTagNames(persistedSelection, ownerTags)
        : initialValues.tags,
    }),
    [initialValues, isQuestion, persistedSelection, ownerTags]
  )
  if (isQuestion && !tagData) {
    return (
      <div role="status" className="mt-4">
        <UserNotification type={tagsError ? 'error' : 'info'}>
          {tagsError ? tShared('systemError') : tShared('loading')}
        </UserNotification>
        {!tagsLoading ? (
          <Button onClick={onClose}>{tShared('close')}</Button>
        ) : null}
      </div>
    )
  }

  return (
    <ElementEditForm
      mode={ElementEditMode.EDIT}
      loading={false}
      inputsDisabled={savingDraft}
      hasUnsavedChanges={hasUnsavedChanges}
      initialValues={readyValues}
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
          } catch {
            toast({ type: 'error', message: t('review.actionError') })
            return
          }

          try {
            await onChanged()
          } catch {
            toast({ type: 'error', message: tShared('systemError') })
            return
          }
          onClose()
        },
      }}
      supplementaryContent={
        <GeneratedDraftSources build={build} draft={draft} />
      }
      tagInput={
        isQuestion ? (
          <GeneratedTagSelector
            draftId={draft.id}
            revision={revision}
            selection={selection}
            selectableExisting={ownerTags}
            suggestedExisting={groups.suggestedExisting}
            newProposals={groups.newProposals}
            onDraftSaved={setRevision}
            onSaved={onChanged}
            onSaving={setSavingDraft}
            onDirtyChange={setHasUnsavedChanges}
          />
        ) : null
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
          const type = toGeneratableElementType(values.type)
          if (!variables || !type) return false
          const result = await keepDraft({
            variables: {
              draftId: draft.id,
              expectedRevision: revision,
              status: values.status,
              type,
              name: variables.name,
              content: variables.content,
              explanation: variables.explanation,
              options: 'options' in variables ? variables.options : undefined,
              basePoints: variables.basePoints,
              pointsMultiplier: variables.pointsMultiplier,
              ...(isQuestion
                ? { tagSelection: selection.selection }
                : { tags: variables.tags }),
              choiceIds:
                values.type === ElementType.Sc ||
                values.type === ElementType.Mc ||
                values.type === ElementType.Kprim
                  ? values.options.choices.map((choice) => choice.id)
                  : undefined,
            },
          })
          if (!result.data?.keepGeneratedElementDraft.savedElementId)
            return false
        } catch {
          return false
        }

        try {
          if (isQuestion) await refreshTags()
          await onChanged()
        } catch {
          toast({ type: 'error', message: tShared('systemError') })
        }
        return true
      }}
    />
  )
}

function RevisionState({
  build,
  draft,
  onChanged,
}: {
  build: ElementGenerationBuildData
  draft: GeneratedElementDraftData
  onChanged: () => Promise<void>
}) {
  const t = useTranslations('manage.elementGeneration')
  const format = useFormatter()
  const [retryGeneration, retryState] = useMutation(
    RetryElementGenerationDocument
  )
  const [retryFailed, setRetryFailed] = useState(false)
  const requests = sortedRevisionBuilds(draft)
  const latest = requests.at(-1)
  const original = draft.revisionOfDraftId
    ? build.drafts.find((candidate) => candidate.id === draft.revisionOfDraftId)
    : undefined

  return (
    <>
      {draft.revisionOfDraftId ? (
        <div
          className="mt-2 rounded border border-cyan-200 bg-cyan-50 p-2 text-xs text-cyan-950"
          data-cy={`generated-element-revision-of-${draft.id}`}
        >
          <div className="font-semibold">
            {t('review.revision.revisionOf', {
              name: original?.current.name ?? t('review.revision.earlierDraft'),
            })}
          </div>
          {draft.revisionNote ? (
            <div className="mt-1">
              {t('review.revision.noteShown', { note: draft.revisionNote })}
            </div>
          ) : null}
        </div>
      ) : null}
      {latest ? (
        <div
          className="mt-2 text-xs text-slate-700"
          data-cy={`generated-element-revision-status-${draft.id}`}
          data-state={
            !isRevisionBuildFinished(latest.status)
              ? 'running'
              : latest.status === ElementGenerationBuildStatus.Failed
                ? 'failed'
                : 'completed'
          }
          role="status"
        >
          {!isRevisionBuildFinished(latest.status) ? (
            <div className="font-medium text-amber-900">
              {t('review.revision.running')}
            </div>
          ) : latest.status === ElementGenerationBuildStatus.Failed ? (
            <div className="font-medium text-red-800">
              {t('review.revision.failed')}
              {latest.errorMessage ? ` ${latest.errorMessage}` : ''}
              {latest.errorRetryable ? (
                <Button
                  type="button"
                  className={{ root: 'ml-2' }}
                  disabled={retryState.loading}
                  onClick={async () => {
                    setRetryFailed(false)
                    try {
                      await retryGeneration({
                        variables: { input: { buildId: latest.id } },
                      })
                      await onChanged()
                    } catch {
                      setRetryFailed(true)
                    }
                  }}
                  data={{ cy: `generated-element-revision-retry-${draft.id}` }}
                >
                  <Button.Label>{t('review.revision.retry')}</Button.Label>
                </Button>
              ) : null}
            </div>
          ) : (
            <div>{t('review.revision.completed')}</div>
          )}
          {latest.note ? (
            <div className="mt-1">
              {t('review.revision.noteShown', { note: latest.note })}
            </div>
          ) : null}
          {retryFailed ? (
            <div className="mt-1 text-red-800">{t('review.actionError')}</div>
          ) : null}
        </div>
      ) : null}
      {requests.length > 1 ? (
        <details
          className="mt-1 text-xs text-slate-600"
          data-cy={`generated-element-revision-history-${draft.id}`}
          data-count={requests.length - 1}
        >
          <summary>
            {t('review.revision.history', { count: requests.length - 1 })}
          </summary>
          <ul className="mt-1 space-y-1">
            {requests.slice(0, -1).map((request) => (
              <li key={request.id}>
                {format.dateTime(new Date(request.createdAt), {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
                {' · '}
                {t(`statuses.${request.status}`)}
                {request.note ? ` · ${request.note}` : ''}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </>
  )
}

function RevisionRequestPanel({
  draft,
  onCancel,
  onRequested,
}: {
  draft: GeneratedElementDraftData
  onCancel: () => void
  onRequested: () => Promise<void>
}) {
  const t = useTranslations('manage.elementGeneration')
  const [setDecision, { loading }] = useMutation(
    SetGeneratedElementDecisionDocument
  )
  const [note, setNote] = useState('')
  const [failed, setFailed] = useState(false)

  return (
    <div
      className="sticky left-0 max-w-[calc(100vw-3rem)] space-y-2 p-2"
      data-cy={`generated-element-revision-panel-${draft.id}`}
    >
      <label className="block font-medium text-slate-900">
        {t('review.revision.noteLabel')}
        <textarea
          className="mt-1 block w-full rounded-md border border-slate-300 p-2 text-sm font-normal"
          data-cy={`generated-element-revision-note-${draft.id}`}
          maxLength={MAX_REVISION_NOTE_LENGTH}
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      <p className="text-xs text-slate-600">
        {t('review.revision.noteHint', {
          count: note.length,
          max: MAX_REVISION_NOTE_LENGTH,
        })}
      </p>
      {draft.evidencePurged ? (
        <p
          className="text-xs font-medium text-amber-900"
          data-cy={`generated-element-evidence-purged-${draft.id}`}
        >
          {t('review.revision.evidencePurged')}
        </p>
      ) : null}
      {failed ? (
        <p className="text-xs text-red-800" role="alert">
          {t('review.actionError')}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button
          primary
          type="button"
          disabled={loading}
          onClick={async () => {
            setFailed(false)
            try {
              const result = await setDecision({
                variables: {
                  input: {
                    draftId: draft.id,
                    decision: GeneratedElementDecision.RevisionRequested,
                    ...(note.trim() ? { note: note.trim() } : {}),
                  },
                },
              })
              if (
                result.data?.setGeneratedElementDecision.decision !==
                GeneratedElementDecision.RevisionRequested
              ) {
                throw new Error('Revision was not requested')
              }
              await onRequested()
            } catch {
              setFailed(true)
            }
          }}
          data={{ cy: `generated-element-revision-submit-${draft.id}` }}
        >
          <Button.Label>{t('review.revision.submit')}</Button.Label>
        </Button>
        <Button type="button" onClick={onCancel}>
          <Button.Label>{t('review.revision.cancel')}</Button.Label>
        </Button>
      </div>
    </div>
  )
}

export default function GeneratedElementReview({
  build,
  canRequestRevision,
  onChanged,
}: {
  build: ElementGenerationBuildData
  canRequestRevision: boolean
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
  const [revisionDraftId, setRevisionDraftId] = useState<string>()
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
              const reasonKeys = draftQualityReasonKeys(draft)
              const difficultyKey = difficultyLabelKey(draft.targetDifficulty)
              const revisionInProgress = draftHasUnfinishedRevision(draft)
              const editable =
                !revisionInProgress &&
                (draft.decision === GeneratedElementDecision.Open ||
                  draft.decision ===
                    GeneratedElementDecision.RevisionRequested ||
                  needsAttention)
              const canRequest =
                canRequestRevision &&
                draft.elementType !== GeneratableElementType.Flashcard &&
                !revisionInProgress &&
                draft.savedElementId === null &&
                draft.decision !== GeneratedElementDecision.Rejected &&
                draft.decision !== GeneratedElementDecision.Accepted
              const sourceTypes = [
                ...new Set(
                  draft.citations.flatMap((citation) => {
                    const source = sourceForCitation(build, citation.resourceId)
                    return source ? [source.type] : []
                  })
                ),
              ]
              return (
                <Fragment key={draft.id}>
                  <tr data-cy={`generated-element-row-${draft.id}`}>
                    <td className="max-w-sm px-4 py-3">
                      <div className="font-medium text-slate-900">
                        {draft.current.name}
                      </div>
                      <div className="mt-1 line-clamp-2 text-xs text-slate-600">
                        {draft.current.prompt}
                      </div>
                      <RevisionState
                        build={build}
                        draft={draft}
                        onChanged={onChanged}
                      />
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
                      {reasonKeys.length > 0 ? (
                        <ul
                          className="mt-1 space-y-1 text-xs font-medium text-amber-800"
                          aria-label={
                            draft.qualityFlags.length > 0
                              ? t('review.qualityAttention')
                              : undefined
                          }
                        >
                          {reasonKeys.map((reasonKey) => (
                            <li key={reasonKey}>{t(reasonKey)}</li>
                          ))}
                        </ul>
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
                        {canRequest ? (
                          <Button
                            type="button"
                            onClick={() => setRevisionDraftId(draft.id)}
                            data={{
                              cy: `element-generation-revise-${draft.id}`,
                            }}
                          >
                            <Button.Label>
                              {t('review.revision.request')}
                            </Button.Label>
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
                        {draft.decision ===
                        GeneratedElementDecision.Rejected ? (
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
                  {revisionDraftId === draft.id ? (
                    <tr>
                      <td colSpan={7}>
                        <RevisionRequestPanel
                          draft={draft}
                          onCancel={() => setRevisionDraftId(undefined)}
                          onRequested={async () => {
                            setRevisionDraftId(undefined)
                            await onChanged()
                          }}
                        />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
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
          // Remount per draft so a local tag override, the revision fence and
          // the form values never leak from the previously opened draft.
          key={selectedDraft.id}
          build={build}
          draft={selectedDraft}
          onClose={() => setSelectedDraft(undefined)}
          onChanged={onChanged}
        />
      ) : null}
    </section>
  )
}
