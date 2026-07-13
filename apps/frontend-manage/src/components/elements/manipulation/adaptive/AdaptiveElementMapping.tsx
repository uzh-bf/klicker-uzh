import { useLazyQuery, useQuery } from '@apollo/client'
import {
  CompetenceTreeDataFragment,
  CompetenceTreeDocument,
  CompetenceTreeSummaryDataFragment,
  CompetenceTreesDocument,
  ElementCompetenceTreesDocument,
  ElementType,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import {
  Button,
  FormLabel,
  H3,
  H4,
  Select,
  UserNotification,
} from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import AdaptiveMappingFields from './AdaptiveMappingFields'
import {
  AdaptiveMappingDraft,
  PendingAdaptiveMapping,
  createMappingDraft,
  getElementAssignment,
  supportsAdaptiveMapping,
  toPendingAdaptiveMapping,
} from './types'
import useAdaptiveMappingMutation from './useAdaptiveMappingMutation'

function isArchived(
  tree: CompetenceTreeDataFragment | CompetenceTreeSummaryDataFragment
): boolean {
  return 'isArchived' in tree && tree.isArchived === true
}

function canEditTree(
  tree: CompetenceTreeDataFragment | CompetenceTreeSummaryDataFragment,
  inputsDisabled: boolean
): boolean {
  return (
    !inputsDisabled &&
    tree.isOwner &&
    tree.canEdit &&
    !tree.isStructurallyLocked &&
    !isArchived(tree)
  )
}

function TreeState({
  tree,
}: {
  tree: CompetenceTreeDataFragment | CompetenceTreeSummaryDataFragment
}) {
  const t = useTranslations()
  const state = isArchived(tree)
    ? 'archived'
    : tree.isStructurallyLocked
      ? 'locked'
      : tree.isOwner && tree.canEdit
        ? 'owner'
        : 'readOnly'

  return (
    <span className="text-xs font-medium text-gray-600">
      {t(`manage.elements.adaptiveMapping.states.${state}`)}
    </span>
  )
}

function TreeHeading({
  tree,
}: {
  tree: CompetenceTreeDataFragment | CompetenceTreeSummaryDataFragment
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
      <H4 className={{ root: 'm-0 truncate' }}>{tree.displayName}</H4>
      <TreeState tree={tree} />
    </div>
  )
}

function PersistedTreeMapping({
  tree,
  elementId,
  elementType,
  choiceCount,
  inputsDisabled,
  formDirty,
  onChanged,
}: {
  tree: CompetenceTreeDataFragment
  elementId: number
  elementType: ElementType
  choiceCount?: number | null
  inputsDisabled: boolean
  formDirty: boolean
  onChanged: () => Promise<void>
}) {
  const t = useTranslations()
  const assignment = getElementAssignment(tree, elementId)
  const [draft, setDraft] = useState<AdaptiveMappingDraft>(() =>
    createMappingDraft(assignment)
  )
  const { saveMapping, loading, error, clearError } =
    useAdaptiveMappingMutation()
  const editable = canEditTree(tree, inputsDisabled)

  useEffect(() => {
    setDraft(createMappingDraft(assignment))
  }, [assignment])

  const save = async () => {
    if (
      typeof draft.leafNodeId !== 'number' ||
      typeof draft.levelId !== 'number'
    ) {
      return
    }

    const saved = await saveMapping({
      treeId: tree.id,
      elementId,
      assignment: {
        leafNodeId: draft.leafNodeId,
        levelId: draft.levelId,
        enabled: draft.enabled,
        enablePercentInput:
          elementType === ElementType.Numerical
            ? draft.enablePercentInput
            : false,
        discrimination: draft.discrimination,
      },
    })

    if (saved) {
      await onChanged()
    }
  }

  const remove = async () => {
    const removed = await saveMapping({
      treeId: tree.id,
      elementId,
      assignment: null,
    })

    if (removed) {
      setDraft(createMappingDraft())
      await onChanged()
    }
  }

  return (
    <div
      className="border-b border-gray-200 py-4 first:border-t"
      data-cy={`adaptive-mapping-tree-${tree.id}`}
    >
      <TreeHeading tree={tree} />

      {assignment || editable ? (
        <AdaptiveMappingFields
          tree={tree}
          elementType={elementType}
          choiceCount={choiceCount}
          assignment={assignment}
          value={draft}
          onChange={(value) => {
            clearError()
            setDraft(value)
          }}
          disabled={!editable}
        />
      ) : (
        <p className="mt-2 text-sm text-gray-600">
          {t('manage.elements.adaptiveMapping.notAssigned')}
        </p>
      )}

      {error ? (
        <UserNotification
          type="error"
          message={error}
          className={{ root: 'mt-3' }}
        />
      ) : null}

      {editable ? (
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          {assignment ? (
            <Button
              destructive
              onClick={remove}
              disabled={formDirty}
              loading={loading}
              data={{ cy: `adaptive-mapping-remove-${tree.id}` }}
            >
              {t('manage.elements.adaptiveMapping.remove')}
            </Button>
          ) : null}
          <Button
            primary
            onClick={save}
            disabled={
              formDirty ||
              typeof draft.leafNodeId !== 'number' ||
              typeof draft.levelId !== 'number'
            }
            loading={loading}
            data={{ cy: `adaptive-mapping-save-${tree.id}` }}
          >
            {t('manage.elements.adaptiveMapping.save')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function UnassignedTreeMapping({
  tree,
  elementId,
  elementType,
  choiceCount,
  inputsDisabled,
  formDirty,
  onChanged,
}: {
  tree: CompetenceTreeSummaryDataFragment
  elementId: number
  elementType: ElementType
  choiceCount?: number | null
  inputsDisabled: boolean
  formDirty: boolean
  onChanged: () => Promise<void>
}) {
  const t = useTranslations()
  const [loadTree, { data, loading, error }] = useLazyQuery(
    CompetenceTreeDocument,
    { fetchPolicy: 'network-only' }
  )

  if (data?.competenceTree) {
    return (
      <PersistedTreeMapping
        tree={data.competenceTree}
        elementId={elementId}
        elementType={elementType}
        choiceCount={choiceCount}
        inputsDisabled={inputsDisabled}
        formDirty={formDirty}
        onChanged={onChanged}
      />
    )
  }

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 py-4 first:border-t"
      data-cy={`adaptive-mapping-tree-${tree.id}`}
    >
      <div>
        <TreeHeading tree={tree} />
        <p className="mt-1 text-sm text-gray-600">
          {error?.message ?? t('manage.elements.adaptiveMapping.notAssigned')}
        </p>
      </div>
      {canEditTree(tree, inputsDisabled) ? (
        <Button
          onClick={() => loadTree({ variables: { id: tree.id } })}
          loading={loading}
          data={{ cy: `adaptive-mapping-add-${tree.id}` }}
        >
          {t('manage.elements.adaptiveMapping.add')}
        </Button>
      ) : null}
    </div>
  )
}

function EditAdaptiveMappings({
  elementId,
  elementType,
  choiceCount,
  inputsDisabled,
  formDirty,
}: {
  elementId: number
  elementType: ElementType
  choiceCount?: number | null
  inputsDisabled: boolean
  formDirty: boolean
}) {
  const t = useTranslations()
  const {
    data,
    loading,
    error,
    refetch: refetchElementTrees,
  } = useQuery(ElementCompetenceTreesDocument, {
    variables: { elementId },
    fetchPolicy: 'network-only',
  })
  const {
    data: summaryData,
    loading: summariesLoading,
    error: summariesError,
    refetch: refetchSummaries,
  } = useQuery(CompetenceTreesDocument, { fetchPolicy: 'network-only' })

  const detailedTrees = useMemo(
    () => (data?.elementCompetenceTrees ?? []) as CompetenceTreeDataFragment[],
    [data?.elementCompetenceTrees]
  )
  const detailedTreeIds = useMemo(
    () => new Set(detailedTrees.map((tree) => tree.id)),
    [detailedTrees]
  )
  const unassignedTrees = (
    (summaryData?.competenceTrees ?? []) as CompetenceTreeSummaryDataFragment[]
  ).filter((tree) => !detailedTreeIds.has(tree.id))
  const onChanged = async () => {
    await Promise.all([refetchElementTrees(), refetchSummaries()])
  }

  if (loading || summariesLoading) {
    return <Loader data={{ cy: 'adaptive-mapping-loading' }} />
  }

  if (error || summariesError) {
    return (
      <UserNotification
        type="error"
        message={
          error?.message ??
          summariesError?.message ??
          t('shared.generic.systemError')
        }
      />
    )
  }

  if (detailedTrees.length === 0 && unassignedTrees.length === 0) {
    return (
      <p className="text-sm text-gray-600">
        {t('manage.elements.adaptiveMapping.noTrees')}
      </p>
    )
  }

  return (
    <div>
      {detailedTrees.map((tree) => (
        <PersistedTreeMapping
          key={tree.id}
          tree={tree}
          elementId={elementId}
          elementType={elementType}
          choiceCount={choiceCount}
          inputsDisabled={inputsDisabled}
          formDirty={formDirty}
          onChanged={onChanged}
        />
      ))}
      {unassignedTrees.map((tree) => (
        <UnassignedTreeMapping
          key={tree.id}
          tree={tree}
          elementId={elementId}
          elementType={elementType}
          choiceCount={choiceCount}
          inputsDisabled={inputsDisabled}
          formDirty={formDirty}
          onChanged={onChanged}
        />
      ))}
    </div>
  )
}

function PendingAdaptiveMappingEditor({
  elementType,
  choiceCount,
  inputsDisabled,
  pendingMapping,
  onPendingMappingChange,
  mutationError,
}: {
  elementType: ElementType
  choiceCount?: number | null
  inputsDisabled: boolean
  pendingMapping: PendingAdaptiveMapping | null
  onPendingMappingChange: (mapping: PendingAdaptiveMapping | null) => void
  mutationError: string | null
}) {
  const t = useTranslations()
  const { data, loading, error } = useQuery(CompetenceTreesDocument, {
    fetchPolicy: 'network-only',
  })
  const [selectedTreeId, setSelectedTreeId] = useState(
    pendingMapping?.treeId ?? ''
  )
  const [draft, setDraft] = useState<AdaptiveMappingDraft>(() =>
    pendingMapping?.assignment
      ? { ...pendingMapping.assignment }
      : createMappingDraft()
  )
  const [loadTree, treeResult] = useLazyQuery(CompetenceTreeDocument, {
    fetchPolicy: 'network-only',
  })
  const trees = (data?.competenceTrees ??
    []) as CompetenceTreeSummaryDataFragment[]
  const selectedTree =
    treeResult.data?.competenceTree?.id === selectedTreeId
      ? treeResult.data.competenceTree
      : undefined

  useEffect(() => {
    if (selectedTreeId) {
      loadTree({ variables: { id: selectedTreeId } })
    }
  }, [loadTree, selectedTreeId])

  if (loading) {
    return <Loader data={{ cy: 'adaptive-mapping-loading' }} />
  }

  if (error) {
    return <UserNotification type="error" message={error.message} />
  }

  if (trees.length === 0) {
    return (
      <p className="text-sm text-gray-600">
        {t('manage.elements.adaptiveMapping.noTrees')}
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="max-w-2xl">
        <FormLabel
          id="adaptive-mapping-tree-select"
          required={false}
          label={t('manage.elements.adaptiveMapping.tree')}
          labelType="small"
        />
        <Select
          id="adaptive-mapping-tree-select"
          value={selectedTreeId || undefined}
          placeholder={t('manage.elements.adaptiveMapping.selectTree')}
          disabled={inputsDisabled}
          items={trees.map((tree) => ({
            value: tree.id,
            label: tree.displayName,
            disabled: !canEditTree(tree, inputsDisabled),
            data: { cy: `adaptive-mapping-tree-option-${tree.id}` },
          }))}
          onChange={(treeId) => {
            setSelectedTreeId(treeId)
            setDraft(createMappingDraft())
            onPendingMappingChange(null)
          }}
          data={{ cy: 'adaptive-mapping-tree-select' }}
          className={{ root: 'w-full', trigger: 'w-full' }}
        />
      </div>

      {treeResult.loading ? (
        <Loader data={{ cy: 'adaptive-mapping-tree-detail-loading' }} />
      ) : null}
      {treeResult.error ? (
        <UserNotification type="error" message={treeResult.error.message} />
      ) : null}
      {selectedTree ? (
        <div data-cy={`adaptive-mapping-tree-${selectedTree.id}`}>
          <TreeHeading tree={selectedTree} />
          <AdaptiveMappingFields
            tree={selectedTree}
            elementType={elementType}
            choiceCount={choiceCount}
            value={draft}
            onChange={(value) => {
              const normalized = {
                ...value,
                enablePercentInput:
                  elementType === ElementType.Numerical
                    ? value.enablePercentInput
                    : false,
              }
              setDraft(normalized)
              onPendingMappingChange(
                toPendingAdaptiveMapping(selectedTree.id, normalized)
              )
            }}
            disabled={inputsDisabled}
          />
          {pendingMapping?.treeId === selectedTree.id ? (
            <div className="mt-3 flex justify-end">
              <Button
                destructive
                onClick={() => {
                  setDraft(createMappingDraft())
                  onPendingMappingChange(null)
                }}
                data={{ cy: `adaptive-mapping-remove-${selectedTree.id}` }}
              >
                {t('manage.elements.adaptiveMapping.remove')}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
      {mutationError ? (
        <UserNotification type="error" message={mutationError} />
      ) : null}
    </div>
  )
}

function AdaptiveElementMapping({
  elementId,
  elementType,
  choiceCount,
  editMode,
  inputsDisabled,
  formDirty,
  pendingMapping,
  onPendingMappingChange,
  mutationError,
}: {
  elementId?: number
  elementType: ElementType
  choiceCount?: number | null
  editMode: boolean
  inputsDisabled: boolean
  formDirty: boolean
  pendingMapping: PendingAdaptiveMapping | null
  onPendingMappingChange: (mapping: PendingAdaptiveMapping | null) => void
  mutationError: string | null
}) {
  const t = useTranslations()
  const supported = supportsAdaptiveMapping(elementType)

  useEffect(() => {
    if (!supported && pendingMapping) {
      onPendingMappingChange(null)
    }
  }, [onPendingMappingChange, pendingMapping, supported])

  return (
    <section
      className="mt-6 border-t border-gray-200 pt-4"
      data-cy="adaptive-mapping-section"
    >
      <H3 className={{ root: 'mb-1' }}>
        {t('manage.elements.adaptiveMapping.title')}
      </H3>
      <p className="mb-4 text-sm text-gray-600">
        {t('manage.elements.adaptiveMapping.description')}
      </p>

      {!supported ? (
        <UserNotification
          type="info"
          message={t('manage.elements.adaptiveMapping.unsupportedType')}
        />
      ) : editMode && typeof elementId === 'number' ? (
        <>
          {formDirty ? (
            <UserNotification
              type="info"
              message={t('manage.elements.adaptiveMapping.saveElementFirst')}
              className={{ root: 'mb-3' }}
            />
          ) : null}
          <EditAdaptiveMappings
            elementId={elementId}
            elementType={elementType}
            choiceCount={choiceCount}
            inputsDisabled={inputsDisabled}
            formDirty={formDirty}
          />
        </>
      ) : (
        <PendingAdaptiveMappingEditor
          elementType={elementType}
          choiceCount={choiceCount}
          inputsDisabled={inputsDisabled}
          pendingMapping={pendingMapping}
          onPendingMappingChange={onPendingMappingChange}
          mutationError={mutationError}
        />
      )}
    </section>
  )
}

export default AdaptiveElementMapping
