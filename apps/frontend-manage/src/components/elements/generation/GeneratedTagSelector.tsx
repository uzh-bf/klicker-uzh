import { useMutation } from '@apollo/client'
import {
  ElementType,
  type Tag,
  UpdateGeneratedElementDraftDocument,
  type UpdateGeneratedElementDraftInput,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, FormLabel, UserNotification } from '@uzh-bf/design-system'
import { useFormikContext } from 'formik'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import Creatable from 'react-select/creatable'
import type { ElementFormTypes } from '../manipulation/types'
import { elementGenerationErrorCode } from './elementGenerationTypes'
import type { GeneratedTagSelection } from './generatedTagSelection'

function TagChip({
  label,
  selected,
  dataCy,
  onToggle,
  disabled,
}: {
  label: string
  selected: boolean
  dataCy: string
  onToggle: () => void
  disabled: boolean
}) {
  return (
    <Button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      disabled={disabled}
      data={{ cy: dataCy }}
      className={{
        root: `rounded-full border px-3 py-1 text-xs ${
          selected
            ? 'border-primary-100 bg-slate-100 font-medium text-primary-100'
            : 'border-slate-300 text-slate-700'
        }`,
      }}
    >
      {label}
    </Button>
  )
}

// Tag workspace for a generated question draft. Owner tags are toggled by id so
// renames keep their identity, new proposals stay names until the draft is kept,
// and manual search or free entry stays available. Save draft persists the
// visible title and selection with the revision the editor was loaded from.
export default function GeneratedTagSelector({
  draftId,
  revision,
  selection,
  selectableExisting,
  suggestedExisting,
  newProposals,
  onDraftSaved,
  onSaved,
  onSaving,
}: {
  draftId: string
  revision: number
  selection: {
    selection: GeneratedTagSelection
    names: string[]
    toggleExistingTag: (tagId: number) => void
    toggleNewTagName: (name: string) => void
    setManualNames: (names: string[]) => void
  }
  selectableExisting: Tag[]
  suggestedExisting: Tag[]
  newProposals: string[]
  onDraftSaved: (revision: number) => void
  onSaving: (saving: boolean) => void
  onSaved: () => Promise<void>
}) {
  const t = useTranslations('manage.elementGeneration')
  const formik = useFormikContext<ElementFormTypes>()
  const [updateDraft, updateState] = useMutation(
    UpdateGeneratedElementDraftDocument
  )
  const [saveState, setSaveState] = useState<
    'idle' | 'saving' | 'saved' | 'error' | 'conflict'
  >('idle')

  const {
    selection: tagSelection,
    names,
    toggleExistingTag,
    toggleNewTagName,
    setManualNames,
  } = selection

  const setFieldValue = formik.setFieldValue
  useEffect(() => {
    void setFieldValue('tags', names, false)
  }, [setFieldValue, names])

  const options = useMemo(
    () =>
      selectableExisting.map((tag) => ({ label: tag.name, value: tag.name })),
    [selectableExisting]
  )

  const isDirty = formik.dirty
  const savingDraft = saveState === 'saving' || updateState.loading

  useEffect(() => {
    if (!isDirty) return
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [isDirty])

  async function handleSaveDraft() {
    if (savingDraft) return

    // Keep sends the merged content block as the prompt and reconstructs the
    // stem on the server; mirror that mapping here.
    const values = formik.values
    if (
      values.type !== ElementType.Sc &&
      values.type !== ElementType.Mc &&
      values.type !== ElementType.Kprim
    )
      return
    const input: UpdateGeneratedElementDraftInput = {
      draftId,
      expectedRevision: revision,
      current: {
        name: values.name,
        prompt: values.content,
        context: null,
        explanation: values.explanation || null,
        tagSelection,
        choices: values.options.choices.map((choice, ix) => ({
          id: choice.id,
          label: String.fromCharCode(65 + ix),
          text: choice.value ?? '',
          correct: choice.correct ?? false,
          feedback: values.options.hasAnswerFeedbacks
            ? choice.feedback || null
            : null,
        })),
      },
    }

    setSaveState('saving')
    onSaving(true)
    try {
      const result = await updateDraft({
        variables: { input },
      })
      const saved = result.data?.updateGeneratedElementDraft
      if (!saved) {
        setSaveState('error')
        return
      }
      formik.resetForm({ values })
      setSaveState('saved')
      onDraftSaved(saved.revision)
      try {
        await onSaved()
      } catch {
        // The draft is saved; a failed list refresh must not look like a lost save.
      }
    } catch (error) {
      setSaveState(
        elementGenerationErrorCode(error) === 'CONCURRENT_MODIFICATION'
          ? 'conflict'
          : 'error'
      )
    } finally {
      onSaving(false)
    }
  }

  return (
    <section
      className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4"
      data-cy="generated-element-tags"
    >
      <h3 className="font-semibold text-slate-900">
        {t('review.tagSelection.title')}
      </h3>

      {suggestedExisting.length > 0 ? (
        <div className="mt-3">
          <FormLabel
            label={t('review.tagSelection.existingLabel')}
            labelType="small"
            required={false}
          />
          <div className="flex flex-wrap gap-2">
            {suggestedExisting.map((tag) => (
              <TagChip
                key={tag.id}
                label={tag.name}
                selected={tagSelection.existingTagIds.includes(tag.id)}
                disabled={savingDraft}
                dataCy={`generated-tag-existing-${tag.id}`}
                onToggle={() => toggleExistingTag(tag.id)}
              />
            ))}
          </div>
        </div>
      ) : null}

      {newProposals.length > 0 ? (
        <div className="mt-3">
          <FormLabel
            label={t('review.tagSelection.newLabel')}
            labelType="small"
            required={false}
          />
          <div className="flex flex-wrap gap-2">
            {newProposals.map((name) => (
              <TagChip
                key={name}
                label={name}
                selected={tagSelection.newTagNames.includes(name)}
                disabled={savingDraft}
                dataCy={`generated-tag-new-${name}`}
                onToggle={() => toggleNewTagName(name)}
              />
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {t('review.tagSelection.newHint')}
          </p>
        </div>
      ) : null}

      <div className="mt-3" data-cy="generated-tag-input">
        <FormLabel
          label={t('review.tagSelection.manualLabel')}
          labelType="small"
          required={false}
        />
        <Creatable
          isDisabled={savingDraft}
          isClearable
          isMulti
          value={names.map((name) => ({ label: name, value: name }))}
          options={options}
          classNames={{ container: () => 'w-full h-9' }}
          onChange={(newValue) =>
            setManualNames(newValue.map((option) => option.value))
          }
          onCreateOption={(newTag) => setManualNames([...names, newTag])}
          placeholder={t('review.tagSelection.placeholder')}
        />
        <p className="mt-1 text-xs text-slate-500">
          {t('review.tagSelection.existingHint')}
        </p>
      </div>

      {saveState === 'conflict' ? (
        <UserNotification type="error" className={{ root: 'mt-3' }}>
          {t('review.tagSelection.conflict')}
        </UserNotification>
      ) : null}
      {saveState === 'error' ? (
        <UserNotification type="error" className={{ root: 'mt-3' }}>
          {t('review.tagSelection.saveError')}
        </UserNotification>
      ) : null}
      {saveState === 'saved' && !isDirty ? (
        <UserNotification type="success" className={{ root: 'mt-3' }}>
          {t('review.tagSelection.saved')}
        </UserNotification>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button
          primary
          type="button"
          disabled={savingDraft || !isDirty || saveState === 'conflict'}
          loading={savingDraft}
          onClick={handleSaveDraft}
          data={{ cy: `generated-element-save-draft-${draftId}` }}
        >
          <Button.Label>
            {savingDraft
              ? t('review.savingDraft')
              : t('review.tagSelection.saveDraft')}
          </Button.Label>
        </Button>
        {isDirty ? (
          <span
            className="text-xs text-amber-800"
            data-cy={`generated-element-unsaved-${draftId}`}
          >
            {t('review.tagSelection.unsaved')}
          </span>
        ) : null}
      </div>
    </section>
  )
}
