import { NetworkStatus, useLazyQuery, useQuery } from '@apollo/client'
import {
  CompetenceTreeCatalogDocument,
  CompetenceTreeCatalogOwnership,
  CompetenceTreeDataFragment,
  CompetenceTreeDocument,
  CompetenceTreeSummaryDataFragment,
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
  Switch,
  TextField,
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

const TREE_CATALOG_PAGE_SIZE = 20

function useOwnedTreeCatalog(enabled: boolean) {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search), 250)
    return () => window.clearTimeout(timeout)
  }, [search])

  const variables = {
    search: debouncedSearch.trim() || undefined,
    ownership: CompetenceTreeCatalogOwnership.Owned,
    limit: TREE_CATALOG_PAGE_SIZE,
  }
  const query = useQuery(CompetenceTreeCatalogDocument, {
    variables,
    skip: !enabled,
    fetchPolicy: 'network-only',
    notifyOnNetworkStatusChange: true,
  })
  const trees = query.data?.competenceTreeCatalog.items ?? []
  const nextCursor = query.data?.competenceTreeCatalog.nextCursor

  const loadMore = async () => {
    if (!nextCursor) return
    await query.fetchMore({
      variables: { ...variables, cursor: nextCursor },
      updateQuery: (previous, { fetchMoreResult }) => {
        const previousItems = previous.competenceTreeCatalog.items
        const knownIds = new Set(previousItems.map((tree) => tree.id))
        return {
          ...previous,
          competenceTreeCatalog: {
            ...fetchMoreResult.competenceTreeCatalog,
            items: [
              ...previousItems,
              ...fetchMoreResult.competenceTreeCatalog.items.filter(
                (tree) => !knownIds.has(tree.id)
              ),
            ],
          },
        }
      },
    })
  }

  return {
    ...query,
    trees,
    search,
    setSearch,
    nextCursor,
    loadMore,
    loadingMore: query.networkStatus === NetworkStatus.fetchMore,
  }
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
        discrimination: null,
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
  const [pickerOpen, setPickerOpen] = useState(false)
  const {
    data,
    loading,
    error,
    refetch: refetchElementTrees,
  } = useQuery(ElementCompetenceTreesDocument, {
    variables: { elementId },
    fetchPolicy: 'network-only',
  })
  const catalog = useOwnedTreeCatalog(pickerOpen)

  const detailedTrees = useMemo(
    () => (data?.elementCompetenceTrees ?? []) as CompetenceTreeDataFragment[],
    [data?.elementCompetenceTrees]
  )
  const detailedTreeIds = useMemo(
    () => new Set(detailedTrees.map((tree) => tree.id)),
    [detailedTrees]
  )
  const unassignedTrees = catalog.trees.filter(
    (tree) => !detailedTreeIds.has(tree.id)
  )
  const onChanged = async () => {
    await refetchElementTrees()
    if (pickerOpen) await catalog.refetch()
  }

  if (loading) {
    return <Loader data={{ cy: 'adaptive-mapping-loading' }} />
  }

  if (error) {
    return (
      <UserNotification
        type="error"
        message={error.message ?? t('shared.generic.systemError')}
      />
    )
  }

  return (
    <div className="space-y-4">
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
      {!pickerOpen ? (
        <div className="flex justify-end">
          <Button
            onClick={() => setPickerOpen(true)}
            disabled={inputsDisabled}
            data={{ cy: 'adaptive-mapping-open-picker' }}
          >
            {t('manage.elements.adaptiveMapping.add')}
          </Button>
        </div>
      ) : (
        <div className="space-y-3" data-cy="adaptive-mapping-picker">
          <TextField
            label={t('manage.elements.adaptiveMapping.searchTrees')}
            value={catalog.search}
            onChange={catalog.setSearch}
            placeholder={t('manage.competenceTree.searchPlaceholder')}
            data={{ cy: 'adaptive-mapping-search' }}
          />
          {catalog.loading && !catalog.data ? (
            <Loader data={{ cy: 'adaptive-mapping-catalog-loading' }} />
          ) : catalog.error ? (
            <UserNotification type="error" message={catalog.error.message} />
          ) : unassignedTrees.length === 0 ? (
            <p className="text-sm text-gray-600">
              {t('manage.elements.adaptiveMapping.noAdditionalTrees')}
            </p>
          ) : (
            unassignedTrees.map((tree) => (
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
            ))
          )}
          {catalog.nextCursor ? (
            <div className="flex justify-center">
              <Button
                onClick={() => void catalog.loadMore()}
                loading={catalog.loadingMore}
                data={{ cy: 'adaptive-mapping-load-more' }}
              >
                {t('manage.competenceTree.loadMore')}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

function PendingAdaptiveMappingEditor({
  elementType,
  choiceCount,
  inputsDisabled,
  pendingMapping,
  onPendingMappingChange,
}: {
  elementType: ElementType
  choiceCount?: number | null
  inputsDisabled: boolean
  pendingMapping: PendingAdaptiveMapping | null
  onPendingMappingChange: (mapping: PendingAdaptiveMapping | null) => void
}) {
  const t = useTranslations()
  const catalog = useOwnedTreeCatalog(true)
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
  const selectedTree =
    treeResult.data?.competenceTree?.id === selectedTreeId
      ? treeResult.data.competenceTree
      : undefined
  const trees = selectedTree
    ? [
        selectedTree,
        ...catalog.trees.filter((tree) => tree.id !== selectedTree.id),
      ]
    : catalog.trees
  const editorDisabled = inputsDisabled

  useEffect(() => {
    if (selectedTreeId) {
      loadTree({ variables: { id: selectedTreeId } })
    }
  }, [loadTree, selectedTreeId])

  if (catalog.loading && !catalog.data) {
    return <Loader data={{ cy: 'adaptive-mapping-loading' }} />
  }

  if (catalog.error) {
    return <UserNotification type="error" message={catalog.error.message} />
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
      {catalog.loading && !catalog.data ? (
        <Loader data={{ cy: 'adaptive-mapping-loading' }} />
      ) : (
        <div className="max-w-2xl space-y-3">
          <TextField
            label={t('manage.elements.adaptiveMapping.searchTrees')}
            value={catalog.search}
            onChange={catalog.setSearch}
            placeholder={t('manage.competenceTree.searchPlaceholder')}
            disabled={editorDisabled}
            data={{ cy: 'adaptive-mapping-search' }}
          />
          <FormLabel
            id="adaptive-mapping-tree-select"
            required={false}
            label={t('manage.elements.adaptiveMapping.tree')}
            labelType="small"
          />
          <Select
            id="adaptive-mapping-tree-select"
            value={selectedTreeId}
            placeholder={t('manage.elements.adaptiveMapping.selectTree')}
            disabled={editorDisabled}
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
          {catalog.nextCursor ? (
            <div className="flex justify-end">
              <Button
                onClick={() => void catalog.loadMore()}
                loading={catalog.loadingMore}
                disabled={editorDisabled}
                data={{ cy: 'adaptive-mapping-load-more' }}
              >
                {t('manage.competenceTree.loadMore')}
              </Button>
            </div>
          ) : null}
        </div>
      )}

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
            disabled={editorDisabled}
          />
          {pendingMapping?.treeId === selectedTree.id ? (
            <div className="mt-3 flex justify-end">
              <Button
                destructive
                onClick={() => {
                  setDraft(createMappingDraft())
                  onPendingMappingChange(null)
                }}
                disabled={editorDisabled}
                data={{ cy: `adaptive-mapping-remove-${selectedTree.id}` }}
              >
                {t('manage.elements.adaptiveMapping.remove')}
              </Button>
            </div>
          ) : null}
        </div>
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
  submissionError,
  onPendingMappingChange,
}: {
  elementId?: number
  elementType: ElementType
  choiceCount?: number | null
  editMode: boolean
  inputsDisabled: boolean
  formDirty: boolean
  pendingMapping: PendingAdaptiveMapping | null
  submissionError: string | null
  onPendingMappingChange: (mapping: PendingAdaptiveMapping | null) => void
}) {
  const t = useTranslations()
  const supported = supportsAdaptiveMapping(elementType)
  const [createAssignmentEnabled, setCreateAssignmentEnabled] = useState(
    pendingMapping !== null
  )

  useEffect(() => {
    if (!supported && pendingMapping) {
      onPendingMappingChange(null)
    }
  }, [onPendingMappingChange, pendingMapping, supported])

  useEffect(() => {
    if (!editMode && pendingMapping) {
      setCreateAssignmentEnabled(true)
    }
  }, [editMode, pendingMapping])

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
      {submissionError ? (
        <UserNotification
          type="error"
          message={submissionError}
          className={{ root: 'mb-4' }}
        />
      ) : null}

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
        <div className="space-y-4">
          <label htmlFor="adaptive-mapping-create-toggle" className="sr-only">
            {t('manage.elements.adaptiveMapping.assignDuringCreation')}
          </label>
          <Switch
            id="adaptive-mapping-create-toggle"
            size="sm"
            label={t('manage.elements.adaptiveMapping.assignDuringCreation')}
            checked={createAssignmentEnabled}
            disabled={inputsDisabled}
            onCheckedChange={(checked) => {
              setCreateAssignmentEnabled(checked)
              if (!checked) {
                onPendingMappingChange(null)
              }
            }}
            data={{ cy: 'adaptive-mapping-create-toggle' }}
          />
          {createAssignmentEnabled ? (
            <PendingAdaptiveMappingEditor
              elementType={elementType}
              choiceCount={choiceCount}
              inputsDisabled={inputsDisabled}
              pendingMapping={pendingMapping}
              onPendingMappingChange={onPendingMappingChange}
            />
          ) : null}
        </div>
      )}
    </section>
  )
}

export default AdaptiveElementMapping
