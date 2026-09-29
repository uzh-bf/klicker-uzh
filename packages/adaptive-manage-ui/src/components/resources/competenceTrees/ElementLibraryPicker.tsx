import { useApolloClient, useQuery } from '@apollo/client'
import {
  ElementStatus,
  ElementType,
  GetUserElementsDocument,
  type GetUserElementsQuery,
  GetUserTagsDocument,
  SortByType,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  Checkbox,
  Select,
  TextField,
  UserNotification,
} from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { getAssignmentLeaves } from './assignmentHelpers'
import {
  ASSIGNABLE_TYPES,
  addElementBatch,
  type LibraryAssignmentElement,
} from './bulkAssignmentHelpers'
import CompetenceTreePagination from './CompetenceTreePagination'
import ElementPreview from './ElementPreview'
import { getBreadcrumb } from './treeHelpers'
import type { CompetenceTreeForm } from './types'

type LibraryElement = NonNullable<
  NonNullable<GetUserElementsQuery['userElements']>['elements']
>[number]
function selectionElement(
  element: NonNullable<LibraryElement>
): LibraryAssignmentElement {
  return {
    id: element.id,
    name: element.name,
    type: element.type,
    version: element.version,
    choiceCount:
      'options' in element && element.options && 'choices' in element.options
        ? element.options.choices.length
        : null,
  }
}

function ElementLibraryPicker({
  form,
  onChange,
  disabled = false,
}: {
  form: CompetenceTreeForm
  onChange: (form: CompetenceTreeForm) => void
  disabled?: boolean
}) {
  const t = useTranslations()
  const client = useApolloClient()
  const [search, setSearch] = useState('')
  const [type, setType] = useState('all')
  const [tagId, setTagId] = useState('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [selected, setSelected] = useState<
    Map<number, LibraryAssignmentElement>
  >(new Map())
  const [leafKey, setLeafKey] = useState('')
  const [levelKey, setLevelKey] = useState('')
  const [collecting, setCollecting] = useState(false)
  const [selectionError, setSelectionError] = useState(false)
  const [limitError, setLimitError] = useState(false)
  const [added, setAdded] = useState(0)
  const { data: tags } = useQuery(GetUserTagsDocument)
  const variables = {
    status: ElementStatus.Ready,
    searchString: search,
    type: type === 'all' ? undefined : (type as ElementType),
    hasSampleSolution: true,
    hasAnswerFeedbacks: false,
    showOwned: true,
    showShared: true,
    showDependencies: false,
    tagIds: tagId === 'all' ? [] : [Number(tagId)],
    showUntagged: false,
    sortByType: SortByType.Title,
    sortByAsc: true,
    showArchived: false,
  }
  const { data, loading, error } = useQuery(GetUserElementsDocument, {
    variables: {
      ...variables,
      numEntries: pageSize,
      offset: (page - 1) * pageSize,
    },
    fetchPolicy: 'cache-and-network',
  })
  const total = data?.userElements?.numOfElements ?? 0
  const assigned = new Set(form.assignments.map((item) => item.elementId))
  const elements = data?.userElements?.elements ?? []
  const eligible = elements.filter(
    (element): element is NonNullable<LibraryElement> =>
      !!element &&
      ASSIGNABLE_TYPES.includes(element.type) &&
      !assigned.has(element.id)
  )
  const leaves = getAssignmentLeaves(form)
  const busy = disabled || collecting
  const resetSelection = () => {
    setSelected(new Map())
    setPage(1)
    setAdded(0)
    setSelectionError(false)
    setLimitError(false)
  }
  const selectAll = async () => {
    setCollecting(true)
    setSelectionError(false)
    setLimitError(false)
    const next = new Map<number, LibraryAssignmentElement>()
    const seen = new Set<number>()
    let expectedTotal: number | undefined
    try {
      // Fetch bounded pages; never render thousands of element previews at once.
      for (let offset = 0; ; offset += 200) {
        const result = await client.query({
          query: GetUserElementsDocument,
          variables: { ...variables, numEntries: 200, offset },
          fetchPolicy: 'no-cache',
        })
        const batch = result.data.userElements
        if (!batch) throw new Error('Missing library result')
        expectedTotal ??= batch.numOfElements
        if (batch.numOfElements !== expectedTotal)
          throw new Error('Library changed during selection')
        for (const element of batch.elements ?? []) {
          if (!element || seen.has(element.id))
            throw new Error('Inconsistent library page')
          seen.add(element.id)
          if (
            element &&
            ASSIGNABLE_TYPES.includes(element.type) &&
            !assigned.has(element.id)
          )
            next.set(element.id, selectionElement(element))
        }
        if (next.size + assigned.size > 10000) {
          setLimitError(true)
          return
        }
        if (offset + 200 >= batch.numOfElements || !batch.elements?.length)
          break
      }
      if (seen.size !== expectedTotal)
        throw new Error('Incomplete library selection')
      setSelected(next)
    } catch {
      setSelectionError(true)
    } finally {
      setCollecting(false)
    }
  }
  return (
    <details
      className="mb-6 rounded border border-gray-200 bg-white p-4"
      data-cy="competence-tree-library-picker"
    >
      <summary className="cursor-pointer font-semibold">
        {t('manage.competenceTree.browseElements')}
      </summary>
      <p className="my-3 text-sm text-gray-600">
        {t('manage.competenceTree.bulkDescription')}
      </p>
      <fieldset disabled={busy} className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <TextField
            id="competence-tree-library-search"
            label={t('manage.competenceTree.searchElements')}
            value={search}
            onChange={(value) => {
              setSearch(value)
              resetSelection()
            }}
            data={{ cy: 'competence-tree-library-search' }}
          />
          <label
            htmlFor="competence-tree-type"
            className="min-w-0 space-y-1 text-sm"
          >
            <span className="block">
              {t('manage.competenceTree.elementType')}
            </span>
            <Select
              id="competence-tree-type"
              className={{ trigger: 'w-full' }}
              value={type}
              items={[
                { value: 'all', label: t('manage.competenceTree.allTypes') },
                ...ASSIGNABLE_TYPES.map((value) => ({
                  value,
                  label: t(`shared.types.${value}`),
                })),
              ]}
              onChange={(value) => {
                setType(value)
                resetSelection()
              }}
              disabled={busy}
              data={{ cy: 'competence-tree-library-type' }}
            />
          </label>
          <label
            htmlFor="competence-tree-tag"
            className="min-w-0 space-y-1 text-sm"
          >
            <span className="block">
              {t('manage.competenceTree.tagFilter')}
            </span>
            <Select
              id="competence-tree-tag"
              className={{ trigger: 'w-full' }}
              value={tagId}
              items={[
                { value: 'all', label: t('manage.competenceTree.allTags') },
                ...(tags?.userTags ?? []).map((tag) => ({
                  value: String(tag.id),
                  label: tag.name,
                })),
              ]}
              onChange={(value) => {
                setTagId(value)
                resetSelection()
              }}
              disabled={busy}
              data={{ cy: 'competence-tree-library-tag' }}
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            disabled={busy || loading || eligible.length === 0}
            onClick={() =>
              setSelected((current) => {
                const next = new Map(current)
                for (const element of eligible)
                  next.set(element.id, selectionElement(element))
                return next
              })
            }
            data={{ cy: 'competence-tree-select-page' }}
          >
            <Button.Label>{t('manage.competenceTree.selectPage')}</Button.Label>
          </Button>
          <Button
            disabled={busy || loading || total === 0}
            loading={collecting}
            onClick={() => void selectAll()}
            data={{ cy: 'competence-tree-select-matching' }}
          >
            <Button.Label>
              {t('manage.competenceTree.selectMatching')}
            </Button.Label>
          </Button>
          <Button
            disabled={busy || selected.size === 0}
            onClick={() => setSelected(new Map())}
            data={{ cy: 'competence-tree-clear-selection' }}
          >
            <Button.Label>
              {t('manage.competenceTree.clearSelection')}
            </Button.Label>
          </Button>
          <span role="status" className="text-sm font-medium">
            {t('manage.competenceTree.selectedCount', { count: selected.size })}
          </span>
        </div>
        {(error || selectionError) && (
          <UserNotification type="error">
            {t('manage.competenceTree.loadElementsError')}
          </UserNotification>
        )}
        {(limitError || selected.size + assigned.size > 10000) && (
          <UserNotification type="warning">
            {t('manage.competenceTree.batchLimit')}
          </UserNotification>
        )}
        <div className="grid items-end gap-3 rounded bg-gray-50 p-4 md:grid-cols-3">
          <label
            htmlFor="competence-tree-leaf"
            className="min-w-0 space-y-1 text-sm"
          >
            <span className="block">
              {t('manage.competenceTree.selectLeaf')}
            </span>
            <Select
              id="competence-tree-leaf"
              className={{ trigger: 'w-full' }}
              value={leafKey}
              placeholder={t('manage.competenceTree.selectLeaf')}
              items={leaves.map((leaf) => ({
                value: leaf.key,
                label: getBreadcrumb(form.nodes, leaf.key),
              }))}
              onChange={setLeafKey}
              disabled={busy}
              data={{ cy: 'competence-tree-bulk-leaf' }}
            />
          </label>
          <label
            htmlFor="competence-tree-level"
            className="min-w-0 space-y-1 text-sm"
          >
            <span className="block">
              {t('manage.competenceTree.selectLevel')}
            </span>
            <Select
              id="competence-tree-level"
              className={{ trigger: 'w-full' }}
              value={levelKey}
              placeholder={t('manage.competenceTree.selectLevel')}
              items={form.levels.map((level) => ({
                value: level.key,
                label: level.label,
              }))}
              onChange={setLevelKey}
              disabled={busy}
              data={{ cy: 'competence-tree-bulk-level' }}
            />
          </label>
          <Button
            primary
            disabled={
              busy ||
              !selected.size ||
              selected.size + assigned.size > 10000 ||
              !leaves.some((leaf) => leaf.key === leafKey) ||
              !form.levels.some((level) => level.key === levelKey)
            }
            onClick={() => {
              const next = addElementBatch(
                form,
                [...selected.values()],
                leafKey,
                levelKey
              )
              setAdded(next.assignments.length - form.assignments.length)
              onChange(next)
              setSelected(new Map())
            }}
            data={{ cy: 'competence-tree-add-batch' }}
          >
            <Button.Label>
              {t('manage.competenceTree.addSelected')}
            </Button.Label>
          </Button>
        </div>
        <ul className="divide-y border-y border-gray-200" aria-busy={loading}>
          {elements.map(
            (element) =>
              element && (
                <li key={element.id} className="flex items-center gap-3 py-3">
                  <Checkbox
                    id={`competence-tree-select-${element.id}`}
                    checked={selected.has(element.id)}
                    disabled={
                      busy ||
                      loading ||
                      assigned.has(element.id) ||
                      !ASSIGNABLE_TYPES.includes(element.type)
                    }
                    onCheck={() =>
                      setSelected((current) => {
                        const next = new Map(current)
                        if (next.has(element.id)) next.delete(element.id)
                        else next.set(element.id, selectionElement(element))
                        return next
                      })
                    }
                    data={{
                      cy: `competence-tree-library-select-${element.id}`,
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <label
                      htmlFor={`competence-tree-select-${element.id}`}
                      className="block cursor-pointer break-words font-medium"
                    >
                      {element.name}
                    </label>
                    <div className="text-xs text-gray-500">
                      {t(`shared.types.${element.type}`)} · #{element.id}
                      {assigned.has(element.id)
                        ? ` · ${t('manage.competenceTree.assigned')}`
                        : ''}
                    </div>
                  </div>
                  <ElementPreview elementId={element.id} name={element.name} />
                </li>
              )
          )}
        </ul>
        {!loading && !elements.length && (
          <p className="text-sm">{t('manage.competenceTree.noElements')}</p>
        )}
        <CompetenceTreePagination
          totalPages={Math.max(1, Math.ceil(total / pageSize))}
          currentPage={page}
          setCurrentPage={setPage}
          numOfObjects={total}
          pageSize={pageSize}
          setPageSize={(value) => {
            setPageSize(value)
            setPage(1)
          }}
        />
        {added > 0 && (
          <div role="status">
            <UserNotification type="info">
              {t('manage.competenceTree.batchAdded', { count: added })}
            </UserNotification>
          </div>
        )}
      </fieldset>
    </details>
  )
}
export default ElementLibraryPicker
