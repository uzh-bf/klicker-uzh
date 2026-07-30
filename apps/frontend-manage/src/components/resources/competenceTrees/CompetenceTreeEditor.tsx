import { useLazyQuery, useMutation, useQuery } from '@apollo/client'
import {
  faArrowLeft,
  faCopy,
  faFloppyDisk,
} from '@fortawesome/free-solid-svg-icons'
import {
  CompetenceTreeDocument,
  CreateCompetenceTreeDocument,
  DuplicateCompetenceTreeDocument,
  ReplaceCompetenceTreeDocument,
  UpdateCompetenceTreeMetadataDocument,
  ValidateCompetenceTreeDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { useUnsavedChangesGuard } from '@lib/hooks/useUnsavedChangesGuard'
import { Button, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useRef, useState } from 'react'
import AssignmentTable from './AssignmentTable'
import CoverageMatrix from './CoverageMatrix'
import HierarchyEditor from './HierarchyEditor'
import LevelEditor from './LevelEditor'
import MetadataEditor from './MetadataEditor'
import {
  applyCompetenceTreeStructuralCommand,
  CompetenceTreeStructuralCommand,
  CompetenceTreeStructuralState,
  getChildren,
} from './treeHelpers'
import {
  CompetenceTreeForm,
  competenceTreeFormToInput,
  competenceTreeToForm,
  createDefaultCompetenceTreeForm,
} from './types'
import ValidationPanel from './ValidationPanel'

function CompetenceTreeEditor({ treeId }: { treeId?: string }) {
  const t = useTranslations()
  const router = useRouter()
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
  const { data, loading, error } = useQuery(CompetenceTreeDocument, {
    variables: { id: treeId ?? '' },
    skip: !treeId,
    fetchPolicy: 'cache-and-network',
  })
  const [validateTree, { loading: validating }] = useLazyQuery(
    ValidateCompetenceTreeDocument,
    { fetchPolicy: 'no-cache' }
  )
  const [createTree, { loading: creating }] = useMutation(
    CreateCompetenceTreeDocument
  )
  const [replaceTree, { loading: replacing }] = useMutation(
    ReplaceCompetenceTreeDocument
  )
  const [updateMetadata, { loading: updatingMetadata }] = useMutation(
    UpdateCompetenceTreeMetadataDocument
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
  const canSubmit =
    isOwner && form.name.trim().length > 0 && form.displayName.trim().length > 0
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
    isDirty,
    message: t('manage.competenceTree.leaveUnsavedDescription'),
  })

  const handleFormChange = (nextForm: CompetenceTreeForm) => {
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
    validationVersionRef.current += 1
    setRequestError(null)
    setEditorState((current) =>
      applyCompetenceTreeStructuralCommand(current, command)
    )
  }

  const runValidation = async (validatedForm = form) => {
    const validationVersion = ++validationVersionRef.current
    setRequestError(null)
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
        }
        return
      }

      const validated = await runValidation(formToSave)
      if (!validated || validated.errors.length > 0) return

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
        }
      } else {
        const result = await createTree({ variables: { input } })
        const created = result.data?.createCompetenceTree
        if (!created) throw new Error(t('manage.competenceTree.saveError'))
        setSavedForm(formToSave)
        allowNextNavigation()
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
        message={error?.message ?? t('manage.competenceTree.treeNotFound')}
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
          <h1 className="truncate text-2xl font-semibold">
            {t(
              isNew
                ? 'manage.competenceTree.newTitle'
                : 'manage.competenceTree.editTitle'
            )}
          </h1>
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
          {isOwner && (
            <Button
              primary
              onClick={() => void handleSave()}
              disabled={!canSubmit}
              loading={saving}
              data={{ cy: 'competence-tree-save' }}
            >
              <Button.Icon icon={faFloppyDisk} loading={saving} />
              <Button.Label>{t('manage.competenceTree.save')}</Button.Label>
            </Button>
          )}
        </div>
      </div>

      {!isOwner && (
        <UserNotification
          type="info"
          message={t('manage.competenceTree.readOnlyNotice')}
          data={{ cy: 'competence-tree-read-only-notice' }}
          className={{ root: 'mb-4' }}
        />
      )}
      {isOwner && isLocked && (
        <UserNotification
          type="warning"
          message={t('manage.competenceTree.lockedNotice')}
          data={{ cy: 'competence-tree-locked-notice' }}
          className={{ root: 'mb-4' }}
        />
      )}
      {requestError && (
        <UserNotification
          type="error"
          message={requestError}
          dismissible
          onDismiss={() => setRequestError(null)}
          data={{ cy: 'competence-tree-editor-error' }}
          className={{ root: 'mb-4' }}
        />
      )}

      <MetadataEditor
        form={form}
        onChange={handleFormChange}
        metadataDisabled={metadataDisabled}
        structureDisabled={structureDisabled}
      />
      <LevelEditor
        form={form}
        onChange={handleFormChange}
        disabled={structureDisabled}
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
      <CoverageMatrix
        form={form}
        onChange={handleFormChange}
        disabled={structureDisabled}
        selectedCell={selectedCell}
        onSelectCell={(selectedCell) =>
          setEditorState((current) => ({ ...current, selectedCell }))
        }
      />
      <AssignmentTable
        form={form}
        onChange={handleFormChange}
        disabled={structureDisabled}
        selectedCell={selectedCell}
        onClearCell={() =>
          setEditorState((current) => ({ ...current, selectedCell: null }))
        }
      />
      <ValidationPanel
        validation={validation}
        requestError={null}
        loading={validating}
        onValidate={() => void runValidation()}
        disabled={!form.name.trim() || !form.displayName.trim()}
      />
    </div>
  )
}

export default CompetenceTreeEditor
