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
import { Button, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import AssignmentTable from './AssignmentTable'
import ConfirmationModal from './ConfirmationModal'
import CoverageMatrix, { CoverageCellSelection } from './CoverageMatrix'
import HierarchyEditor from './HierarchyEditor'
import LevelEditor from './LevelEditor'
import MetadataEditor from './MetadataEditor'
import {
  CompetenceTreeForm,
  CompetenceTreeValidationView,
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
  const [form, setForm] = useState<CompetenceTreeForm>(() => defaultForm)
  const [savedForm, setSavedForm] = useState<CompetenceTreeForm>(
    () => defaultForm
  )
  const [loadedTreeId, setLoadedTreeId] = useState<string | null>(null)
  const [selectedCell, setSelectedCell] =
    useState<CoverageCellSelection | null>(null)
  const [validation, setValidation] =
    useState<CompetenceTreeValidationView | null>(null)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [leaveConfirmationOpen, setLeaveConfirmationOpen] = useState(false)
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
  const saving = creating || replacing || updatingMetadata
  const canSubmit =
    isOwner && form.name.trim().length > 0 && form.displayName.trim().length > 0
  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(savedForm),
    [form, savedForm]
  )

  useEffect(() => {
    if (!tree || loadedTreeId === tree.id) return
    const nextForm = competenceTreeToForm(tree)
    setForm(nextForm)
    setSavedForm(nextForm)
    setValidation(tree.validation)
    setLoadedTreeId(tree.id)
    setSelectedCell(null)
  }, [loadedTreeId, tree])

  useEffect(() => {
    if (!isDirty) return

    const preventUnsavedUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', preventUnsavedUnload)
    return () =>
      window.removeEventListener('beforeunload', preventUnsavedUnload)
  }, [isDirty])

  const runValidation = async () => {
    setRequestError(null)
    try {
      const result = await validateTree({
        variables: { input: competenceTreeFormToInput(form) },
      })
      const nextValidation = result.data?.validateCompetenceTree ?? null
      setValidation(nextValidation)
      return nextValidation
    } catch (validationError) {
      setRequestError(
        validationError instanceof Error
          ? validationError.message
          : t('manage.competenceTree.validationRequestError')
      )
      return null
    }
  }

  const handleSave = async () => {
    if (!canSubmit) return
    setRequestError(null)

    try {
      if (treeId && isLocked) {
        const result = await updateMetadata({
          variables: {
            id: treeId,
            input: {
              name: form.name.trim(),
              displayName: form.displayName.trim(),
              description: form.description.trim() || null,
            },
          },
        })
        const updated = result.data?.updateCompetenceTreeMetadata
        if (updated) {
          const nextForm = competenceTreeToForm(updated)
          setForm(nextForm)
          setSavedForm(nextForm)
          setValidation(updated.validation)
        }
        return
      }

      const validated = await runValidation()
      if (!validated || validated.errors.length > 0) return

      const input = competenceTreeFormToInput(form)
      if (treeId) {
        const result = await replaceTree({
          variables: { id: treeId, input },
        })
        const updated = result.data?.replaceCompetenceTree
        if (updated) {
          const nextForm = competenceTreeToForm(updated)
          setForm(nextForm)
          setSavedForm(nextForm)
          setValidation(updated.validation)
          setLoadedTreeId(updated.id)
        }
      } else {
        const result = await createTree({ variables: { input } })
        const created = result.data?.createCompetenceTree
        if (!created) throw new Error(t('manage.competenceTree.saveError'))
        setSavedForm(form)
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
              if (isDirty) {
                setLeaveConfirmationOpen(true)
              } else {
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
        onChange={setForm}
        metadataDisabled={metadataDisabled}
        structureDisabled={structureDisabled}
      />
      <LevelEditor
        form={form}
        onChange={setForm}
        disabled={structureDisabled}
      />
      <HierarchyEditor
        form={form}
        onChange={setForm}
        disabled={structureDisabled}
      />
      <CoverageMatrix
        form={form}
        onChange={setForm}
        disabled={structureDisabled}
        selectedCell={selectedCell}
        onSelectCell={setSelectedCell}
      />
      <AssignmentTable
        form={form}
        onChange={setForm}
        disabled={structureDisabled}
        selectedCell={selectedCell}
        onClearCell={() => setSelectedCell(null)}
      />
      <ValidationPanel
        validation={validation}
        requestError={null}
        loading={validating}
        onValidate={() => void runValidation()}
        disabled={!form.name.trim() || !form.displayName.trim()}
      />
      {leaveConfirmationOpen && (
        <ConfirmationModal
          title={t('manage.competenceTree.leaveUnsavedTitle')}
          message={t('manage.competenceTree.leaveUnsavedDescription')}
          confirmLabel={t('manage.competenceTree.leaveUnsavedAction')}
          cancelLabel={t('shared.generic.cancel')}
          destructive
          onConfirm={() => {
            setLeaveConfirmationOpen(false)
            void router.push('/resources/competenceTrees')
          }}
          onClose={() => setLeaveConfirmationOpen(false)}
          dataCy="competence-tree-leave-unsaved"
        />
      )}
    </div>
  )
}

export default CompetenceTreeEditor
