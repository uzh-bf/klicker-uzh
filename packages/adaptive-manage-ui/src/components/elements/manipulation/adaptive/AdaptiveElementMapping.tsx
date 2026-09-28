import { NetworkStatus, useQuery } from '@apollo/client'
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
  Checkbox,
  H3,
  H4,
  Switch,
  UserNotification,
} from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import AdaptiveMappingFields from './AdaptiveMappingFields'
import {
  AdaptiveMappingDraft,
  PendingAdaptiveMappingDraft,
  createMappingDraft,
  getElementAssignment,
  supportsAdaptiveMapping,
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
  const variables = {
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
        additionalLeafNodeIds: draft.additionalLeafNodeIds,
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

function TreeSelection({
  catalog,
  selectedIds,
  lockedIds = new Set<string>(),
  inputsDisabled,
  onToggle,
}: {
  catalog: ReturnType<typeof useOwnedTreeCatalog>
  selectedIds: Set<string>
  lockedIds?: Set<string>
  inputsDisabled: boolean
  onToggle: (treeId: string) => void
}) {
  const t = useTranslations()
  return (
    <fieldset className="space-y-2" data-cy="adaptive-tree-selection">
      <legend className="mb-1 font-semibold">
        {t('manage.elements.adaptiveMapping.selectTrees')}
      </legend>
      <p className="text-sm text-gray-600">
        {t('manage.elements.adaptiveMapping.multipleTreesHint')}
      </p>
      {catalog.loading && !catalog.data && <Loader />}
      {catalog.error && (
        <UserNotification type="error" message={catalog.error.message} />
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {catalog.trees.map((tree) => (
          <div
            key={tree.id}
            className="flex items-center gap-3 rounded-md border border-solid p-3"
          >
            <Checkbox
              id={`adaptive-tree-choice-${tree.id}`}
              checked={selectedIds.has(tree.id)}
              disabled={
                inputsDisabled ||
                lockedIds.has(tree.id) ||
                !canEditTree(tree, false)
              }
              onCheck={() => onToggle(tree.id)}
              data={{ cy: `adaptive-tree-choice-${tree.id}` }}
            />
            <label
              htmlFor={`adaptive-tree-choice-${tree.id}`}
              className="min-w-0 flex-1 cursor-pointer text-sm"
            >
              <span className="block font-medium">{tree.displayName}</span>
              {tree.isStructurallyLocked && (
                <span className="text-gray-500">
                  {t('manage.competenceTree.structurallyLocked')}
                </span>
              )}
            </label>
          </div>
        ))}
      </div>
      {!catalog.loading && !catalog.error && catalog.trees.length === 0 && (
        <p className="text-sm text-gray-600">
          {t('manage.elements.adaptiveMapping.noTrees')}
        </p>
      )}
      {catalog.nextCursor && (
        <Button
          onClick={() => void catalog.loadMore()}
          loading={catalog.loadingMore}
          data={{ cy: 'adaptive-mapping-load-more' }}
        >
          <Button.Label>{t('manage.competenceTree.loadMore')}</Button.Label>
        </Button>
      )}
    </fieldset>
  )
}

function SelectedTreeMapping({
  treeId,
  ...props
}: {
  treeId: string
  elementId: number
  elementType: ElementType
  choiceCount?: number | null
  inputsDisabled: boolean
  formDirty: boolean
  onChanged: () => Promise<void>
}) {
  const { data, loading, error } = useQuery(CompetenceTreeDocument, {
    variables: { id: treeId },
  })
  if (loading) return <Loader />
  if (error) return <UserNotification type="error" message={error.message} />
  return data?.competenceTree ? (
    <PersistedTreeMapping tree={data.competenceTree} {...props} />
  ) : null
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
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const { data, loading, error, refetch } = useQuery(
    ElementCompetenceTreesDocument,
    { variables: { elementId }, fetchPolicy: 'network-only' }
  )
  const catalog = useOwnedTreeCatalog(true)
  const trees = data?.elementCompetenceTrees ?? []
  const persistedIds = new Set(trees.map((tree) => tree.id))
  const allIds = new Set([...persistedIds, ...selectedIds])
  const onChanged = async () => {
    const result = await refetch()
    await catalog.refetch()
    const assigned = new Set(
      result.data?.elementCompetenceTrees?.map((tree) => tree.id)
    )
    setSelectedIds((current) => current.filter((id) => !assigned.has(id)))
  }
  if (loading && !data) return <Loader />
  if (error) return <UserNotification type="error" message={error.message} />
  return (
    <div className="space-y-4">
      <TreeSelection
        catalog={catalog}
        selectedIds={allIds}
        lockedIds={persistedIds}
        inputsDisabled={inputsDisabled || formDirty}
        onToggle={(id) =>
          setSelectedIds((current) =>
            current.includes(id)
              ? current.filter((value) => value !== id)
              : [...current, id]
          )
        }
      />
      {trees.map((tree) => (
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
      {selectedIds
        .filter((id) => !persistedIds.has(id))
        .map((id) => (
          <SelectedTreeMapping
            key={id}
            treeId={id}
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

function PendingTreeAssignment({
  treeId,
  initialMapping,
  elementType,
  choiceCount,
  inputsDisabled,
  onChange,
}: {
  treeId: string
  initialMapping: PendingAdaptiveMappingDraft
  elementType: ElementType
  choiceCount?: number | null
  inputsDisabled: boolean
  onChange: (mapping: PendingAdaptiveMappingDraft) => void
}) {
  const { data, loading, error } = useQuery(CompetenceTreeDocument, {
    variables: { id: treeId },
    fetchPolicy: 'network-only',
  })
  const [draft, setDraft] = useState<AdaptiveMappingDraft>(
    () => initialMapping?.assignment ?? createMappingDraft()
  )
  if (loading) return <Loader />
  if (error) return <UserNotification type="error" message={error.message} />
  const tree = data?.competenceTree
  if (!tree) return null
  return (
    <div
      className="rounded-md border border-solid p-4"
      data-cy={`adaptive-mapping-tree-${tree.id}`}
    >
      <TreeHeading tree={tree} />
      <AdaptiveMappingFields
        tree={tree}
        elementType={elementType}
        choiceCount={choiceCount}
        value={draft}
        disabled={!canEditTree(tree, inputsDisabled)}
        onChange={(value) => {
          setDraft(value)
          onChange({ treeId, assignment: value })
        }}
      />
    </div>
  )
}

function PendingAdaptiveMappingDraftEditor({
  elementType,
  choiceCount,
  inputsDisabled,
  pendingMapping,
  onPendingMappingChange,
  onValidityChange,
}: {
  elementType: ElementType
  choiceCount?: number | null
  inputsDisabled: boolean
  pendingMapping: PendingAdaptiveMappingDraft[] | null
  onPendingMappingChange: (
    mapping: PendingAdaptiveMappingDraft[] | null
  ) => void
  onValidityChange?: (valid: boolean) => void
}) {
  const catalog = useOwnedTreeCatalog(true)
  const [selections, setSelections] = useState<
    Record<string, PendingAdaptiveMappingDraft>
  >(() =>
    Object.fromEntries(
      (pendingMapping ?? []).map((mapping) => [mapping.treeId, mapping])
    )
  )
  const update = (next: typeof selections) => {
    setSelections(next)
    const mappings = Object.values(next)
    onValidityChange?.(
      mappings.length > 0 &&
        mappings.every(
          (mapping) =>
            typeof mapping.assignment.leafNodeId === 'number' &&
            typeof mapping.assignment.levelId === 'number'
        )
    )
    onPendingMappingChange(mappings)
  }
  useEffect(() => {
    onValidityChange?.(
      Object.values(selections).length > 0 &&
        Object.values(selections).every(
          (mapping) =>
            typeof mapping.assignment.leafNodeId === 'number' &&
            typeof mapping.assignment.levelId === 'number'
        )
    )
    return () => onValidityChange?.(true)
  }, [onValidityChange, selections])
  return (
    <div className="space-y-4">
      <TreeSelection
        catalog={catalog}
        selectedIds={new Set(Object.keys(selections))}
        inputsDisabled={inputsDisabled}
        onToggle={(id) => {
          const next = { ...selections }
          if (id in next) delete next[id]
          else next[id] = { treeId: id, assignment: createMappingDraft() }
          update(next)
        }}
      />
      {Object.entries(selections).map(([id, mapping]) => (
        <PendingTreeAssignment
          key={id}
          treeId={id}
          initialMapping={mapping}
          elementType={elementType}
          choiceCount={choiceCount}
          inputsDisabled={inputsDisabled}
          onChange={(value) => update({ ...selections, [id]: value })}
        />
      ))}
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
  onValidityChange,
  onPendingMappingChange,
}: {
  elementId?: number
  elementType: ElementType
  choiceCount?: number | null
  editMode: boolean
  inputsDisabled: boolean
  formDirty: boolean
  pendingMapping: PendingAdaptiveMappingDraft[] | null
  onValidityChange?: (valid: boolean) => void
  submissionError: string | null
  onPendingMappingChange: (
    mapping: PendingAdaptiveMappingDraft[] | null
  ) => void
}) {
  const t = useTranslations()
  const supported = supportsAdaptiveMapping(elementType)
  const existingMappings = useQuery(ElementCompetenceTreesDocument, {
    variables: { elementId: elementId ?? 0 },
    skip: !editMode || typeof elementId !== 'number' || !supported,
    fetchPolicy: 'cache-and-network',
  })
  const hasMappings =
    (existingMappings.data?.elementCompetenceTrees?.length ?? 0) > 0
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

  const enabled = supported && (createAssignmentEnabled || hasMappings)
  return (
    <section
      className="mt-6 border-t border-gray-200 pt-4"
      data-cy="adaptive-mapping-section"
    >
      <Switch
        id="adaptive-mapping-create-toggle"
        size="sm"
        label={t('manage.elements.adaptiveMapping.enableAdaptive')}
        checked={enabled}
        disabled={
          inputsDisabled ||
          !supported ||
          existingMappings.loading ||
          hasMappings
        }
        onCheckedChange={(checked) => {
          setCreateAssignmentEnabled(checked)
          if (!checked) onPendingMappingChange(null)
        }}
        data={{ cy: 'adaptive-mapping-create-toggle' }}
      />
      {hasMappings && (
        <p className="mt-2 text-xs text-gray-600">
          {t('manage.elements.adaptiveMapping.disableHint')}
        </p>
      )}
      {!supported && (
        <p className="mt-2 text-sm text-gray-600">
          {t('manage.elements.adaptiveMapping.unsupportedType')}
        </p>
      )}
      {existingMappings.error && (
        <UserNotification
          type="error"
          message={existingMappings.error.message}
        />
      )}
      {submissionError && (
        <UserNotification type="error" message={submissionError} />
      )}
      {enabled && (
        <div className="mt-4" data-cy="adaptive-mapping-settings">
          <p className="mb-4 text-sm text-gray-600">
            {t('manage.elements.adaptiveMapping.description')}
          </p>
          {editMode && typeof elementId === 'number' ? (
            <>
              {formDirty && (
                <UserNotification
                  type="info"
                  message={t(
                    'manage.elements.adaptiveMapping.saveElementFirst'
                  )}
                  className={{ root: 'mb-3' }}
                />
              )}
              <EditAdaptiveMappings
                elementId={elementId}
                elementType={elementType}
                choiceCount={choiceCount}
                inputsDisabled={inputsDisabled}
                formDirty={formDirty}
              />
            </>
          ) : (
            <PendingAdaptiveMappingDraftEditor
              elementType={elementType}
              choiceCount={choiceCount}
              inputsDisabled={inputsDisabled}
              pendingMapping={pendingMapping}
              onValidityChange={onValidityChange}
              onPendingMappingChange={onPendingMappingChange}
            />
          )}
        </div>
      )}
    </section>
  )
}

export default AdaptiveElementMapping
