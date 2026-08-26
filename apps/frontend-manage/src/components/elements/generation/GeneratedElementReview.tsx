import { useMutation } from '@apollo/client'
import {
  DuplicateGeneratedElementDraftDocument,
  GeneratableElementType,
  GeneratedElementCardType,
  GeneratedElementDecision,
  SaveGeneratedElementsDocument,
  SetGeneratedElementDecisionDocument,
  UpdateGeneratedElementDraftDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import type {
  ElementGenerationBuildData,
  GeneratedElementDraftData,
} from './elementGenerationTypes'

interface GeneratedElementCardProps {
  draft: GeneratedElementDraftData
  onChanged: () => Promise<void>
}

function GeneratedElementCard({ draft, onChanged }: GeneratedElementCardProps) {
  const t = useTranslations('manage.elementGeneration')
  const [name, setName] = useState(draft.current.name)
  const [prompt, setPrompt] = useState(draft.current.prompt)
  const [context, setContext] = useState(draft.current.context ?? '')
  const [explanation, setExplanation] = useState(
    draft.current.explanation ?? ''
  )
  const [cardType, setCardType] = useState(
    draft.current.cardType ?? GeneratedElementCardType.Definition
  )
  const [tags, setTags] = useState(draft.current.tags.join(', '))
  const [choices, setChoices] = useState(draft.current.choices)
  const [error, setError] = useState<string>()
  const [updateDraft, updateState] = useMutation(
    UpdateGeneratedElementDraftDocument
  )
  const [duplicateDraft, duplicateState] = useMutation(
    DuplicateGeneratedElementDraftDocument
  )
  const [setDecision, decisionState] = useMutation(
    SetGeneratedElementDecisionDocument
  )
  const isFlashcard = draft.elementType === GeneratableElementType.Flashcard

  useEffect(() => {
    setName(draft.current.name)
    setPrompt(draft.current.prompt)
    setContext(draft.current.context ?? '')
    setExplanation(draft.current.explanation ?? '')
    setCardType(draft.current.cardType ?? GeneratedElementCardType.Definition)
    setTags(draft.current.tags.join(', '))
    setChoices(draft.current.choices)
  }, [draft])

  async function run(action: () => Promise<unknown>) {
    setError(undefined)
    try {
      await action()
      await onChanged()
    } catch {
      setError(t('review.actionError'))
    }
  }

  async function saveDraft() {
    await run(async () => {
      await updateDraft({
        variables: {
          input: {
            draftId: draft.id,
            expectedRevision: draft.revision,
            current: isFlashcard
              ? {
                  name: name.trim(),
                  prompt: prompt.trim(),
                  explanation: explanation.trim(),
                  cardType,
                  tags: tags
                    .split(',')
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                }
              : {
                  name: name.trim(),
                  prompt: prompt.trim(),
                  context: context.trim() || null,
                  explanation: explanation.trim() || null,
                  choices: choices.map((choice) => ({
                    id: choice.id,
                    label: choice.label,
                    text: choice.text.trim(),
                    correct: choice.correct,
                    feedback: choice.feedback?.trim() || null,
                  })),
                },
          },
        },
      })
    })
  }

  const busy =
    updateState.loading || duplicateState.loading || decisionState.loading

  return (
    <article
      className={`rounded-xl border bg-white p-5 shadow-sm ${
        draft.decision === GeneratedElementDecision.Accepted
          ? 'border-green-300'
          : draft.decision === GeneratedElementDecision.Rejected
            ? 'border-red-200 opacity-75'
            : 'border-slate-200'
      }`}
      data-cy={`generated-element-${draft.id}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="rounded bg-cyan-700 px-2 py-1 text-xs font-bold text-white">
            {draft.elementType}
          </span>
          <span className="text-xs text-slate-500">
            {t('review.elementNumber', { number: draft.order + 1 })}
          </span>
          {draft.duplicationIndex > 0 ? (
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
              {t('review.copy', { number: draft.duplicationIndex })}
            </span>
          ) : null}
        </div>
        <span className="text-xs font-semibold text-slate-500">
          {t(`decisions.${draft.decision}`)}
        </span>
      </div>

      <div className="mt-4 grid gap-4">
        <label className="text-sm font-semibold text-slate-700">
          {t('review.name')}
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 font-normal"
            data-cy={`generated-element-name-${draft.id}`}
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          {isFlashcard ? t('review.front') : t('review.prompt')}
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={3}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 font-normal"
            data-cy={`generated-element-prompt-${draft.id}`}
          />
        </label>

        {isFlashcard ? (
          <>
            <label className="text-sm font-semibold text-slate-700">
              {t('review.back')}
              <textarea
                value={explanation}
                onChange={(event) => setExplanation(event.target.value)}
                rows={4}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 font-normal"
                data-cy={`generated-element-back-${draft.id}`}
              />
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">
                {t('review.cardType')}
                <select
                  value={cardType}
                  onChange={(event) =>
                    setCardType(event.target.value as GeneratedElementCardType)
                  }
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 font-normal"
                >
                  {Object.values(GeneratedElementCardType).map((value) => (
                    <option key={value} value={value}>
                      {t(`cardTypes.${value}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold text-slate-700">
                {t('review.tags')}
                <input
                  type="text"
                  value={tags}
                  onChange={(event) => setTags(event.target.value)}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 font-normal"
                  placeholder={t('review.tagsPlaceholder')}
                />
              </label>
            </div>
          </>
        ) : (
          <>
            <label className="text-sm font-semibold text-slate-700">
              {t('review.context')}
              <textarea
                value={context}
                onChange={(event) => setContext(event.target.value)}
                rows={2}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 font-normal"
              />
            </label>
            <fieldset>
              <legend className="text-sm font-semibold text-slate-700">
                {t('review.choices')}
              </legend>
              <div className="mt-2 space-y-2">
                {choices.map((choice, index) => (
                  <div
                    key={choice.id}
                    className="grid items-center gap-2 rounded-md border border-slate-200 p-3 sm:grid-cols-[2rem_2.5rem_minmax(0,1fr)]"
                  >
                    <input
                      type="checkbox"
                      checked={choice.correct}
                      onChange={(event) =>
                        setChoices((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, correct: event.target.checked }
                              : item
                          )
                        )
                      }
                      aria-label={t('review.correctChoice', {
                        label: choice.label,
                      })}
                    />
                    <span className="font-semibold text-slate-700">
                      {choice.label}
                    </span>
                    <input
                      type="text"
                      value={choice.text}
                      onChange={(event) =>
                        setChoices((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, text: event.target.value }
                              : item
                          )
                        )
                      }
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      data-cy={`generated-element-choice-${draft.id}-${index}`}
                    />
                  </div>
                ))}
              </div>
            </fieldset>
            <label className="text-sm font-semibold text-slate-700">
              {t('review.explanation')}
              <textarea
                value={explanation}
                onChange={(event) => setExplanation(event.target.value)}
                rows={3}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 font-normal"
              />
            </label>
          </>
        )}
      </div>

      {draft.qualityFlags.length > 0 ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          {t('review.qualityFlags', { count: draft.qualityFlags.length })}:{' '}
          {draft.qualityFlags.join(', ')}
        </div>
      ) : null}
      {draft.citations.length > 0 ? (
        <p className="mt-3 text-xs text-slate-500">
          {t('review.citations', { count: draft.citations.length })}
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={busy}
            onClick={() =>
              run(() =>
                setDecision({
                  variables: {
                    input: {
                      draftId: draft.id,
                      decision: GeneratedElementDecision.Accepted,
                    },
                  },
                })
              )
            }
            data={{ cy: `generated-element-accept-${draft.id}` }}
          >
            <Button.Label>{t('review.accept')}</Button.Label>
          </Button>
          <Button
            type="button"
            disabled={busy}
            onClick={() =>
              run(() =>
                setDecision({
                  variables: {
                    input: {
                      draftId: draft.id,
                      decision: GeneratedElementDecision.Rejected,
                    },
                  },
                })
              )
            }
            data={{ cy: `generated-element-reject-${draft.id}` }}
          >
            <Button.Label>{t('review.reject')}</Button.Label>
          </Button>
          <Button
            type="button"
            disabled={busy}
            onClick={() =>
              run(() =>
                duplicateDraft({ variables: { input: { draftId: draft.id } } })
              )
            }
            data={{ cy: `generated-element-duplicate-${draft.id}` }}
          >
            <Button.Label>{t('review.duplicate')}</Button.Label>
          </Button>
        </div>
        <Button
          primary
          type="button"
          disabled={busy || !name.trim() || !prompt.trim()}
          onClick={saveDraft}
          data={{ cy: `generated-element-save-draft-${draft.id}` }}
        >
          <Button.Label>
            {updateState.loading
              ? t('review.savingDraft')
              : t('review.saveDraft')}
          </Button.Label>
        </Button>
      </div>
    </article>
  )
}

interface GeneratedElementReviewProps {
  build: ElementGenerationBuildData
  onChanged: () => Promise<void>
}

export default function GeneratedElementReview({
  build,
  onChanged,
}: GeneratedElementReviewProps) {
  const t = useTranslations('manage.elementGeneration')
  const [saveElements, saveState] = useMutation(SaveGeneratedElementsDocument)
  const [saveError, setSaveError] = useState(false)
  const [savedCount, setSavedCount] = useState<number>()
  const acceptedCount = build.drafts.filter(
    (draft) => draft.decision === GeneratedElementDecision.Accepted
  ).length
  const openCount = build.drafts.filter(
    (draft) => draft.decision === GeneratedElementDecision.Open
  ).length

  async function handleSaveElements() {
    setSaveError(false)
    try {
      const result = await saveElements({
        variables: { input: { buildId: build.id } },
      })
      const saveResult = result.data?.saveGeneratedElements
      setSavedCount(
        (saveResult?.createdElementIds.length ?? 0) +
          (saveResult?.alreadySavedElementIds.length ?? 0)
      )
      await onChanged()
    } catch {
      setSaveError(true)
    }
  }

  return (
    <section data-cy="generated-element-review">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-sm md:flex md:items-center md:justify-between md:gap-6">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">
            {t('review.title')}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {t('review.summary', {
              total: build.drafts.length,
              accepted: acceptedCount,
              open: openCount,
            })}
          </p>
        </div>
        <Button
          primary
          type="button"
          disabled={saveState.loading || acceptedCount === 0}
          onClick={handleSaveElements}
          data={{ cy: 'element-generation-save-elements' }}
          className={{ root: 'mt-4 md:mt-0' }}
        >
          <Button.Label>
            {saveState.loading
              ? t('review.savingElements')
              : t('review.saveElements', { count: acceptedCount })}
          </Button.Label>
        </Button>
      </div>

      {typeof savedCount === 'number' ? (
        <div className="mt-4">
          <UserNotification
            type="success"
            message={t('review.savedElements', { count: savedCount })}
            data={{ cy: 'element-generation-save-success' }}
          />
        </div>
      ) : null}
      {saveError ? (
        <div className="mt-4">
          <UserNotification
            type="error"
            message={t('review.saveElementsError')}
            data={{ cy: 'element-generation-save-error' }}
          />
        </div>
      ) : null}

      <div className="mt-5 space-y-5">
        {[...build.drafts]
          .sort((left, right) =>
            left.order === right.order
              ? left.duplicationIndex - right.duplicationIndex
              : left.order - right.order
          )
          .map((draft) => (
            <GeneratedElementCard
              key={draft.id}
              draft={draft}
              onChanged={onChanged}
            />
          ))}
      </div>
    </section>
  )
}
