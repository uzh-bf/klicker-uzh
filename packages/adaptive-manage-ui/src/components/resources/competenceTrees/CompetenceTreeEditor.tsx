import { useLazyQuery, useMutation, useQuery } from '@apollo/client'
import {
  faArrowLeft,
  faCopy,
  faFloppyDisk,
  faGear,
} from '@fortawesome/free-solid-svg-icons'
import {
  DuplicateCompetenceTreeDocument,
  MCreateCompetenceTreeWithRuntimeDefaultsDocument,
  MReplaceCompetenceTreeWithRuntimeDefaultsDocument,
  MUpdateCompetenceTreeMetadataWithRuntimeDefaultsDocument,
  QCompetenceTreeWithRuntimeDefaultsDocument,
  UserProfileDocument,
  ValidateCompetenceTreeDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, H2, Switch, UserNotification } from '@uzh-bf/design-system'
import { useRouter } from 'next/router'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useUnsavedChangesGuard } from '../../../lib/hooks/useUnsavedChangesGuard'
import { ADAPTIVE_V2_AUTHORING_ENABLED } from '../../activities/creation/practiceQuiz/adaptivePracticeQuizForm'
import AssignedElementsPreview from './AssignedElementsPreview'
import { hasUnmappedElements } from './assignmentHelpers'
import CoverageMatrix from './CoverageMatrix'
import DraftNumberField, {
  NumberFieldValidityProvider,
  useHasInvalidNumberFields,
} from './DraftNumberField'
import ElementLibraryPicker from './ElementLibraryPicker'
import HierarchyEditor from './HierarchyEditor'
import LevelEditor from './LevelEditor'
import MetadataEditor from './MetadataEditor'
import ScaleVersionPanel from './ScaleVersionPanel'
import TreeStructureOverview from './TreeStructureOverview'
import {
  applyCompetenceTreeStructuralCommand,
  type CompetenceTreeStructuralCommand,
  type CompetenceTreeStructuralState,
  getChildren,
} from './treeHelpers'
import {
  type CompetenceTreeForm,
  competenceTreeFormToInput,
  competenceTreeToForm,
  createDefaultCompetenceTreeForm,
} from './types'
import ValidationPanel from './ValidationPanel'
import { type EditorStep, getEditorStepForSection } from './wizardHelpers'

function CompetenceTreeEditorContent({ treeId }: { treeId?: string }) {
  const t = useTranslations()
  const router = useRouter()
  const { data: profile } = useQuery(UserProfileDocument)
  const draftKey = profile?.userProfile?.id
    ? `competence-tree-draft:v1:${profile.userProfile.id}:${treeId ?? 'new'}`
    : null
  const [localDraft, setLocalDraft] = useState<CompetenceTreeForm | null>(null)
  const [draftSaved, setDraftSaved] = useState(false)
  const [step, setStep] = useState<EditorStep>(treeId ? 'review' : 'structure')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [sectionToFocus, setSectionToFocus] = useState<string | null>(null)

  const navigateToSection = (
    sectionId: string,
    preserveAssignmentFilter = false
  ) => {
    if (
      sectionId === 'competence-tree-section-assignments' &&
      !preserveAssignmentFilter
    ) {
      setEditorState((current) => ({ ...current, selectedCell: null }))
    }
    const target = getEditorStepForSection(sectionId)
    setSettingsOpen(target === 'settings')
    if (target !== 'settings') setStep(target)
    setSectionToFocus(sectionId)
  }

  useEffect(() => {
    if (!sectionToFocus) return
    const section = document.getElementById(sectionToFocus)
    if (!section) return
    let parent = section.parentElement
    while (parent) {
      if (parent instanceof HTMLDetailsElement) parent.open = true
      parent = parent.parentElement
    }
    section.scrollIntoView({ block: 'start' })
    section.focus({ preventScroll: true })
    setSectionToFocus(null)
  }, [sectionToFocus, step, settingsOpen])
  const defaultForm = useMemo(
    () =>
      createDefaultCompetenceTreeForm({
        levels: [
          t('manage.competenceTree.defaultLevelLow'),
          t('manage.competenceTree.defaultLevelMedium'),
          t('manage.competenceTree.defaultLevelHigh'),
        ],
        root: t('manage.competenceTree.defaultRoot'),
        leaf: t('manage.competenceTree.defaultLeaf'),
      }),
    [t]
  )
  const [editorState, setEditorState] = useState<CompetenceTreeStructuralState>(
    () => ({
      form: defaultForm,
      selectedNodeKey: getChildren(defaultForm.nodes, null)[0]?.key ?? null,
      selectedCell: null,
      validation: null,
    })
  )
  const { form, selectedNodeKey, selectedCell, validation } = editorState
  const [savedForm, setSavedForm] = useState<CompetenceTreeForm>(
    () => defaultForm
  )
  const [loadedTreeId, setLoadedTreeId] = useState<string | null>(null)
  const [requestError, setRequestError] = useState<string | null>(null)
  const validationVersionRef = useRef(0)
  const { data, loading, error } = useQuery(
    QCompetenceTreeWithRuntimeDefaultsDocument,
    {
      variables: { id: treeId ?? '' },
      skip: !treeId,
      fetchPolicy: 'cache-and-network',
    }
  )
  const [validateTree, { loading: validating }] = useLazyQuery(
    ValidateCompetenceTreeDocument,
    { fetchPolicy: 'no-cache' }
  )
  const [createTree, { loading: creating }] = useMutation(
    MCreateCompetenceTreeWithRuntimeDefaultsDocument
  )
  const [replaceTree, { loading: replacing }] = useMutation(
    MReplaceCompetenceTreeWithRuntimeDefaultsDocument
  )
  const [updateMetadata, { loading: updatingMetadata }] = useMutation(
    MUpdateCompetenceTreeMetadataWithRuntimeDefaultsDocument
  )
  const [duplicateTree, { loading: duplicating }] = useMutation(
    DuplicateCompetenceTreeDocument
  )
  const tree = data?.competenceTree
  const isNew = !treeId
  const isOwner = isNew || !!tree?.isOwner
  const isLocked = !!tree?.isStructurallyLocked
  const metadataDisabled = !isOwner
  const structureDisabled = !isOwner || isLocked
  const saving = creating || replacing || updatingMetadata || validating
  const hasInvalidNumberFields = useHasInvalidNumberFields()
  const canSubmit =
    isOwner &&
    form.name.trim().length > 0 &&
    form.displayName.trim().length > 0 &&
    !hasInvalidNumberFields
  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(savedForm),
    [form, savedForm]
  )

  useEffect(() => {
    if (!tree || loadedTreeId === tree.id) return
    const nextForm = competenceTreeToForm(tree)
    validationVersionRef.current += 1
    setEditorState({
      form: nextForm,
      selectedNodeKey: getChildren(nextForm.nodes, null)[0]?.key ?? null,
      selectedCell: null,
      validation: tree.validation,
    })
    setSavedForm(nextForm)
    setLoadedTreeId(tree.id)
  }, [loadedTreeId, tree])

  const { allowNextNavigation, confirmNavigation } = useUnsavedChangesGuard({
    isDirty: isDirty && JSON.stringify(form) !== JSON.stringify(localDraft),
    message: t('manage.competenceTree.leaveUnsavedDescription'),
  })

  useEffect(() => {
    if (!draftKey || isLocked || !isOwner) return
    try {
      const stored = localStorage.getItem(draftKey)
      if (!stored) {
        setLocalDraft(null)
        return
      }
      const value = JSON.parse(stored)
      if (
        value.version === 1 &&
        value.form &&
        typeof value.form.name === 'string' &&
        typeof value.form.displayName === 'string' &&
        ['levels', 'nodes', 'coverages', 'assignments'].every((key) =>
          Array.isArray(value.form[key])
        )
      ) {
        setLocalDraft({ ...defaultForm, ...value.form })
      }
    } catch {
      setLocalDraft(null)
    }
  }, [draftKey, isLocked, isOwner])

  const saveLocalDraft = () => {
    if (!draftKey) return
    try {
      localStorage.setItem(draftKey, JSON.stringify({ version: 1, form }))
      setLocalDraft(form)
      setDraftSaved(true)
    } catch {
      setRequestError(t('manage.competenceTree.localDraftError'))
    }
  }

  const clearLocalDraft = () => {
    if (draftKey) {
      try {
        localStorage.removeItem(draftKey)
      } catch {
        /* Saving the server tree still succeeded. */
      }
    }
    setLocalDraft(null)
    setDraftSaved(false)
  }

  const handleFormChange = (nextForm: CompetenceTreeForm) => {
    setDraftSaved(false)
    validationVersionRef.current += 1
    setRequestError(null)
    setEditorState((current) => {
      const nodeKeys = new Set(nextForm.nodes.map((node) => node.key))
      const levelKeys = new Set(nextForm.levels.map((level) => level.key))

      return {
        form: nextForm,
        selectedNodeKey:
          current.selectedNodeKey && nodeKeys.has(current.selectedNodeKey)
            ? current.selectedNodeKey
            : (getChildren(nextForm.nodes, null)[0]?.key ?? null),
        selectedCell:
          current.selectedCell &&
          nodeKeys.has(current.selectedCell.leafKey) &&
          levelKeys.has(current.selectedCell.levelKey)
            ? current.selectedCell
            : null,
        validation: null,
      }
    })
  }

  const handleStructuralCommand = (
    command: CompetenceTreeStructuralCommand
  ) => {
    setDraftSaved(false)
    validationVersionRef.current += 1
    setRequestError(null)
    setEditorState((current) =>
      applyCompetenceTreeStructuralCommand(current, command)
    )
  }

  const runValidation = async (validatedForm = form) => {
    const validationVersion = ++validationVersionRef.current
    setRequestError(null)
    if (hasUnmappedElements(validatedForm)) {
      setRequestError(t('manage.competenceTree.unmappedElements'))
      return null
    }
    try {
      const result = await validateTree({
        variables: { input: competenceTreeFormToInput(validatedForm) },
      })
      const nextValidation = result.data?.validateCompetenceTree ?? null
      if (validationVersionRef.current !== validationVersion) return null
      setEditorState((current) =>
        current.form === validatedForm
          ? { ...current, validation: nextValidation }
          : current
      )
      return nextValidation
    } catch (validationError) {
      if (validationVersionRef.current === validationVersion) {
        setRequestError(
          validationError instanceof Error
            ? validationError.message
            : t('manage.competenceTree.validationRequestError')
        )
      }
      return null
    }
  }

  const handleSave = async () => {
    if (!canSubmit) return
    setRequestError(null)
    const formToSave = form

    try {
      if (treeId && isLocked) {
        const result = await updateMetadata({
          variables: {
            id: treeId,
            input: {
              name: formToSave.name.trim(),
              displayName: formToSave.displayName.trim(),
              description: formToSave.description.trim() || null,
              defaultTotalQuestionCap: formToSave.defaultTotalQuestionCap,
              defaultTimeLimitSeconds: formToSave.defaultTimeLimitSeconds,
            },
          },
        })
        const updated = result.data?.updateCompetenceTreeMetadata
        if (updated) {
          const nextForm = competenceTreeToForm(updated)
          setEditorState({
            form: nextForm,
            selectedNodeKey: getChildren(nextForm.nodes, null)[0]?.key ?? null,
            selectedCell: null,
            validation: updated.validation,
          })
          setSavedForm(nextForm)
          setSettingsOpen(false)
          setStep('review')
        }
        return
      }

      const validated = await runValidation(formToSave)
      if (!validated) return
      if (validated.errors.length > 0) {
        setSettingsOpen(false)
        setStep('structure')
        return
      }

      const input = competenceTreeFormToInput(formToSave)
      if (treeId) {
        const result = await replaceTree({
          variables: { id: treeId, input },
        })
        const updated = result.data?.replaceCompetenceTree
        if (updated) {
          const nextForm = competenceTreeToForm(updated)
          setEditorState({
            form: nextForm,
            selectedNodeKey: getChildren(nextForm.nodes, null)[0]?.key ?? null,
            selectedCell: null,
            validation: updated.validation,
          })
          setSavedForm(nextForm)
          setLoadedTreeId(updated.id)
          clearLocalDraft()
          setStep('review')
          setSettingsOpen(false)
        }
      } else {
        const result = await createTree({ variables: { input } })
        const created = result.data?.createCompetenceTree
        if (!created) throw new Error(t('manage.competenceTree.saveError'))
        setSavedForm(formToSave)
        clearLocalDraft()
        allowNextNavigation()
        setStep('review')
        await router.replace(`/resources/competenceTrees/${created.id}`)
      }
    } catch (saveError) {
      setRequestError(
        saveError instanceof Error
          ? saveError.message
          : t('manage.competenceTree.saveError')
      )
    }
  }

  const handleDuplicate = async () => {
    if (!treeId) return
    setRequestError(null)
    try {
      const result = await duplicateTree({ variables: { id: treeId } })
      const duplicate = result.data?.duplicateCompetenceTree
      if (!duplicate) throw new Error(t('manage.competenceTree.actionError'))
      await router.push(`/resources/competenceTrees/${duplicate.id}`)
    } catch (duplicateError) {
      setRequestError(
        duplicateError instanceof Error
          ? duplicateError.message
          : t('manage.competenceTree.actionError')
      )
    }
  }

  if (!isNew && loading && !data) return <Loader />

  if (!isNew && (error || (!loading && !tree))) {
    return (
      <UserNotification
        type="error"
        children={error?.message ?? t('manage.competenceTree.treeNotFound')}
        data={{ cy: 'competence-tree-load-error' }}
      />
    )
  }

  return (
    <div className="w-full" data-cy="competence-tree-editor">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Button
            basic
            onClick={() => {
              if (confirmNavigation()) {
                void router.push('/resources/competenceTrees')
              }
            }}
            data={{ cy: 'competence-tree-back' }}
            className={{ root: 'mb-2 px-0' }}
          >
            <Button.Icon icon={faArrowLeft} />
            <Button.Label>
              {t('manage.competenceTree.backToLibrary')}
            </Button.Label>
          </Button>
          <H2 className={{ root: 'mb-0' }}>
            {isNew ? t('manage.competenceTree.newTitle') : form.displayName}
          </H2>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {treeId && (
            <Button
              onClick={() => void handleDuplicate()}
              loading={duplicating}
              disabled={isDirty}
              title={
                isDirty
                  ? t('manage.competenceTree.saveBeforeDuplicate')
                  : undefined
              }
              data={{ cy: 'competence-tree-editor-duplicate' }}
            >
              <Button.Icon icon={faCopy} loading={duplicating} />
              <Button.Label>
                {t('manage.competenceTree.duplicate')}
              </Button.Label>
            </Button>
          )}
          {isOwner && !isLocked && (
            <Button
              onClick={saveLocalDraft}
              disabled={!draftKey || saving}
              data={{ cy: 'competence-tree-save-draft' }}
            >
              <Button.Label>
                {t('manage.competenceTree.saveDraft')}
              </Button.Label>
            </Button>
          )}
          <Button
            onClick={() => setSettingsOpen((open) => !open)}
            disabled={saving}
            data={{ cy: 'competence-tree-settings-toggle' }}
          >
            <Button.Icon icon={faGear} />
            <Button.Label>
              {t(
                settingsOpen
                  ? 'manage.competenceTree.backToSetup'
                  : 'manage.competenceTree.treeSettings'
              )}
            </Button.Label>
          </Button>
        </div>
      </div>

      {!isOwner && (
        <UserNotification
          type="info"
          children={t('manage.competenceTree.readOnlyNotice')}
          data={{ cy: 'competence-tree-read-only-notice' }}
          className={{ root: 'mb-4' }}
        />
      )}
      {isOwner && isLocked && (
        <UserNotification
          type="warning"
          children={t('manage.competenceTree.lockedNotice')}
          data={{ cy: 'competence-tree-locked-notice' }}
          className={{ root: 'mb-4 !text-slate-800' }}
        />
      )}
      {requestError && (
        <UserNotification
          type="error"
          children={requestError}
          dismissible
          onDismiss={() => setRequestError(null)}
          data={{ cy: 'competence-tree-editor-error' }}
          className={{ root: 'mb-4' }}
        />
      )}

      {!isLocked && isOwner && (
        <p
          className="mb-4 text-sm text-slate-600"
          data-cy="competence-tree-draft-notice"
        >
          {t('manage.competenceTree.wizardDraftHint')}
        </p>
      )}
      {!isLocked && isOwner && localDraft && (
        <div
          className="mb-4 flex flex-wrap items-center gap-3 rounded border border-slate-200 p-3"
          data-cy="competence-tree-local-draft"
        >
          <p className="text-sm">
            {t(
              draftSaved
                ? 'manage.competenceTree.draftSaved'
                : 'manage.competenceTree.draftAvailable'
            )}
          </p>
          <Button
            onClick={() => {
              if (
                !isDirty ||
                window.confirm(t('manage.competenceTree.restoreDraftPrompt'))
              ) {
                handleFormChange(localDraft)
              }
            }}
            data={{ cy: 'competence-tree-restore-draft' }}
          >
            <Button.Label>
              {t('manage.competenceTree.restoreDraft')}
            </Button.Label>
          </Button>
        </div>
      )}
      <div hidden={settingsOpen}>
        {!isNew && (
          <nav
            aria-label={t('manage.competenceTree.setupSteps')}
            className="mb-5 flex gap-1 overflow-x-auto border-b border-gray-200"
          >
            {(['review', 'structure', 'questions'] as const).map((item) => (
              <button
                type="button"
                key={item}
                aria-current={step === item ? 'page' : undefined}
                disabled={saving}
                onClick={() => setStep(item)}
                data-cy={`competence-tree-step-${item}`}
                className={`min-h-11 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${step === item ? 'border-primary-100 text-primary-100' : 'border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900'}`}
              >
                {t(
                  item === 'review'
                    ? 'manage.competenceTree.structureOverview'
                    : item === 'structure'
                      ? 'manage.competenceTree.editStructure'
                      : 'manage.competenceTree.assignedElements'
                )}
              </button>
            ))}
          </nav>
        )}
        <div
          hidden={step !== 'structure'}
          data-cy="competence-tree-step-panel-structure"
        >
          <MetadataEditor
            form={form}
            onChange={handleFormChange}
            metadataDisabled={metadataDisabled}
          />
          <HierarchyEditor
            form={form}
            onChange={handleFormChange}
            onStructuralCommand={handleStructuralCommand}
            selectedKey={selectedNodeKey}
            onSelect={(selectedNodeKey) =>
              setEditorState((current) => ({ ...current, selectedNodeKey }))
            }
            disabled={structureDisabled}
          />
        </div>
        <div
          hidden={step !== 'questions'}
          data-cy="competence-tree-step-panel-questions"
        >
          {!structureDisabled && (
            <ElementLibraryPicker
              form={form}
              onChange={handleFormChange}
              disabled={saving}
            />
          )}
          <AssignedElementsPreview
            form={form}
            onChange={structureDisabled ? undefined : handleFormChange}
            disabled={saving}
          />
          {!structureDisabled && (
            <div className="mt-5 flex justify-end">
              <Button
                primary
                onClick={() => void handleSave()}
                disabled={!canSubmit || saving || !isDirty}
                loading={saving}
                data={{ cy: 'competence-tree-save-assignments' }}
              >
                <Button.Icon icon={faFloppyDisk} loading={saving} />
                <Button.Label>{t('manage.competenceTree.save')}</Button.Label>
              </Button>
            </div>
          )}
        </div>
        <div
          hidden={step !== 'review'}
          data-cy="competence-tree-step-panel-review"
        >
          <TreeStructureOverview form={form} />
        </div>

        {step === 'structure' && (
          <>
            <ValidationPanel
              form={form}
              validation={validation}
              requestError={null}
              loading={validating}
              onValidate={() => void runValidation()}
              disabled={!canSubmit || saving}
              onJumpToSection={(sectionId, nodeKey) => {
                if (nodeKey)
                  setEditorState((current) => ({
                    ...current,
                    selectedNodeKey: nodeKey,
                  }))
                navigateToSection(sectionId)
              }}
            />
            {isOwner && (
              <div className="mt-5 flex justify-end border-t border-slate-200 pt-4">
                <Button
                  primary
                  onClick={() => void handleSave()}
                  disabled={!canSubmit || saving}
                  loading={saving}
                  data={{ cy: 'competence-tree-save' }}
                >
                  <Button.Icon icon={faFloppyDisk} loading={saving} />
                  <Button.Label>{t('manage.competenceTree.save')}</Button.Label>
                </Button>
              </div>
            )}
          </>
        )}
      </div>
      <div hidden={!settingsOpen} data-cy="competence-tree-settings">
        <h2 className="text-lg font-semibold">
          {t('manage.competenceTree.treeSettings')}
        </h2>
        <p className="mb-5 text-sm text-slate-600">
          {t('manage.competenceTree.settingsHint')}
        </p>
        <div className="mb-6 rounded border border-gray-200 p-4">
          <h3 className="font-semibold">
            {t('manage.competenceTree.quizDefaults')}
          </h3>
          <p className="mb-4 text-sm text-gray-600">
            {t('manage.competenceTree.quizDefaultsHint')}
          </p>
          <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
            <DraftNumberField
              id="competence-tree-default-question-cap"
              value={form.defaultTotalQuestionCap ?? 50}
              onChange={(defaultTotalQuestionCap) =>
                handleFormChange({ ...form, defaultTotalQuestionCap })
              }
              min={2}
              max={1000}
              precision={0}
              label={t('manage.competenceTree.defaultMaxQuestions')}
              disabled={metadataDisabled}
              data={{ cy: 'competence-tree-default-question-cap' }}
            />
            <div className="space-y-3">
              <Switch
                id="competence-tree-time-limit-enabled"
                aria-label={t('manage.competenceTree.enableTimeLimit')}
                checked={form.defaultTimeLimitSeconds != null}
                onCheckedChange={(enabled) =>
                  handleFormChange({
                    ...form,
                    defaultTimeLimitSeconds: enabled ? 1800 : null,
                  })
                }
                label={t('manage.competenceTree.enableTimeLimit')}
                disabled={metadataDisabled}
                data={{ cy: 'competence-tree-time-limit-toggle' }}
              />
              {form.defaultTimeLimitSeconds != null && (
                <DraftNumberField
                  id="competence-tree-default-duration"
                  value={form.defaultTimeLimitSeconds / 60}
                  onChange={(minutes) =>
                    handleFormChange({
                      ...form,
                      defaultTimeLimitSeconds: Math.max(
                        1,
                        Math.round(minutes * 60)
                      ),
                    })
                  }
                  min={1}
                  precision={0}
                  label={t('manage.competenceTree.defaultMaxMinutes')}
                  disabled={metadataDisabled}
                  data={{ cy: 'competence-tree-default-time-limit' }}
                />
              )}
            </div>
          </div>
          <p className="mt-3 text-sm text-gray-600">
            {t('manage.competenceTree.timeLimitHint')}
          </p>
        </div>
        <div
          id="competence-tree-section-settings"
          tabIndex={-1}
          className="mb-5 max-w-sm"
        >
          <DraftNumberField
            id="competence-tree-max-depth"
            value={form.maxDepth}
            onChange={(maxDepth) => handleFormChange({ ...form, maxDepth })}
            min={1}
            max={5}
            precision={0}
            label={t('manage.competenceTree.maxDepth')}
            disabled={structureDisabled}
            data={{ cy: 'competence-tree-max-depth' }}
          />
        </div>
        <LevelEditor
          form={form}
          onChange={handleFormChange}
          disabled={structureDisabled}
        />
        <details className="mb-5 rounded border border-gray-200 p-4">
          <summary className="cursor-pointer font-semibold">
            {t('manage.competenceTree.advancedSettings')}
          </summary>
          <CoverageMatrix
            form={form}
            onChange={handleFormChange}
            disabled={structureDisabled}
            selectedCell={selectedCell}
            onSelectCell={(selectedCell) => {
              setEditorState((current) => ({ ...current, selectedCell }))
              navigateToSection('competence-tree-section-assignments', true)
            }}
          />
          {ADAPTIVE_V2_AUTHORING_ENABLED && treeId && tree ? (
            <ScaleVersionPanel
              treeId={treeId}
              treeLevels={tree.levels}
              assignments={tree.elementAssignments}
            />
          ) : null}
          {ADAPTIVE_V2_AUTHORING_ENABLED && !treeId && (
            <p className="my-4 text-sm text-slate-600">
              {t('manage.competenceTree.scaleAfterSave')}
            </p>
          )}
        </details>
        {isOwner && (
          <Button
            primary
            onClick={() => void handleSave()}
            disabled={!canSubmit || saving}
            loading={saving}
            data={{ cy: 'competence-tree-settings-save' }}
            className={{ root: 'mr-3' }}
          >
            <Button.Icon icon={faFloppyDisk} loading={saving} />
            <Button.Label>{t('manage.competenceTree.save')}</Button.Label>
          </Button>
        )}
        <Button
          onClick={() => {
            setSettingsOpen(false)
            setStep('structure')
          }}
          data={{ cy: 'competence-tree-settings-review' }}
        >
          <Button.Label>{t('manage.competenceTree.backToSetup')}</Button.Label>
        </Button>
      </div>
    </div>
  )
}

function CompetenceTreeEditor({ treeId }: { treeId?: string }) {
  return (
    <NumberFieldValidityProvider>
      <CompetenceTreeEditorContent treeId={treeId} />
    </NumberFieldValidityProvider>
  )
}

export default CompetenceTreeEditor
