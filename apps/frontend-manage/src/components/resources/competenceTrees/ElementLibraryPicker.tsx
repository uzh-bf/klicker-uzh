import {
  deriveGuessingParameter,
  mapLevelsToTheta,
  type AdaptiveItemType,
} from '@klicker-uzh/adaptive-learning'
import { useQuery } from '@apollo/client'
import {
  AdaptiveNodeKind,
  ElementStatus,
  ElementType,
  GetUserElementsDocument,
  GetUserTagsDocument,
  SortByType,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, TextField, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import CompetenceTreePagination from './CompetenceTreePagination'
import { getBreadcrumb } from './treeHelpers'
import type { CompetenceTreeForm } from './types'

const TYPES = [
  ElementType.Sc,
  ElementType.Mc,
  ElementType.Kprim,
  ElementType.Numerical,
  ElementType.FreeText,
]

function ElementLibraryPicker({
  form,
  onChange,
}: {
  form: CompetenceTreeForm
  onChange: (form: CompetenceTreeForm) => void
}) {
  const t = useTranslations()
  const [search, setSearch] = useState('')
  const [type, setType] = useState<ElementType | ''>('')
  const [tagId, setTagId] = useState('')
  const [sortBy, setSortBy] = useState(SortByType.Title)
  const { data: tags } = useQuery(GetUserTagsDocument)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [leaf, setLeaf] = useState('')
  const [level, setLevel] = useState('')
  const leaves = form.nodes.filter(
    (node) =>
      node.kind === AdaptiveNodeKind.Subcompetence &&
      !form.nodes.some((child) => child.parentKey === node.key)
  )
  const leafKey = leaves.some((node) => node.key === leaf)
    ? leaf
    : (leaves[0]?.key ?? '')
  const levelKey = form.levels.some((item) => item.key === level)
    ? level
    : (form.levels[0]?.key ?? '')
  const { data, loading, error } = useQuery(GetUserElementsDocument, {
    variables: {
      status: ElementStatus.Ready,
      searchString: search,
      type: type || undefined,
      hasSampleSolution: true,
      hasAnswerFeedbacks: false,
      showOwned: true,
      showShared: true,
      showDependencies: false,
      tagIds: tagId ? [Number(tagId)] : [],
      showUntagged: false,
      sortByType: sortBy,
      sortByAsc: sortBy === SortByType.Title,
      showArchived: false,
      numEntries: pageSize,
      offset: (page - 1) * pageSize,
    },
    fetchPolicy: 'cache-and-network',
  })
  const total = data?.userElements?.numOfElements ?? 0
  const elements = data?.userElements?.elements ?? []
  return (
    <details
      className="mb-4 rounded border border-slate-200 p-4"
      data-cy="competence-tree-library-picker"
    >
      <summary className="cursor-pointer font-semibold">
        {t('manage.competenceTree.browseElements')}
      </summary>
      <p className="my-3 text-sm text-slate-600">
        {t('manage.competenceTree.pickerDescription')}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          id="competence-tree-library-search"
          value={search}
          onChange={(value) => {
            setSearch(value)
            setPage(1)
          }}
          label={t('manage.competenceTree.searchElements')}
          data={{ cy: 'competence-tree-library-search' }}
        />
        <label className="text-sm">
          {t('manage.competenceTree.elementType')}
          <select
            className="mt-1 block w-full rounded border border-slate-300 p-2"
            value={type}
            onChange={(event) => {
              setType(event.target.value as ElementType | '')
              setPage(1)
            }}
            data-cy="competence-tree-library-type"
          >
            <option value="">{t('manage.competenceTree.allTypes')}</option>
            {TYPES.map((value) => (
              <option key={value} value={value}>
                {t(`shared.types.${value}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          {t('manage.competenceTree.selectLeaf')}
          <select
            className="mt-1 block w-full rounded border border-slate-300 p-2"
            value={leafKey}
            onChange={(event) => setLeaf(event.target.value)}
            data-cy="competence-tree-library-leaf"
          >
            {leaves.map((node) => (
              <option key={node.key} value={node.key}>
                {getBreadcrumb(form.nodes, node.key)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          {t('manage.competenceTree.selectLevel')}
          <select
            className="mt-1 block w-full rounded border border-slate-300 p-2"
            value={levelKey}
            onChange={(event) => setLevel(event.target.value)}
            data-cy="competence-tree-library-level"
          >
            {form.levels.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          {t('manage.competenceTree.tagFilter')}
          <select
            className="mt-1 block w-full rounded border border-slate-300 p-2"
            value={tagId}
            onChange={(event) => {
              setTagId(event.target.value)
              setPage(1)
            }}
            data-cy="competence-tree-library-tag"
          >
            <option value="">{t('manage.competenceTree.allTags')}</option>
            {tags?.userTags?.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          {t('manage.competenceTree.sortElements')}
          <select
            className="mt-1 block w-full rounded border border-slate-300 p-2"
            value={sortBy}
            onChange={(event) => {
              setSortBy(event.target.value as SortByType)
              setPage(1)
            }}
            data-cy="competence-tree-library-sort"
          >
            <option value={SortByType.Title}>
              {t('manage.competenceTree.sortName')}
            </option>
            <option value={SortByType.Modified}>
              {t('manage.competenceTree.sortModified')}
            </option>
          </select>
        </label>
      </div>
      {error && (
        <UserNotification
          type="error"
          message={t('manage.competenceTree.loadElementsError')}
        />
      )}
      <ul
        className="mt-4 divide-y border-y border-slate-200"
        aria-busy={loading}
      >
        {elements.map((element) => {
          if (!element) return null
          const supported = TYPES.includes(element.type)
          const assigned = form.assignments.some(
            (item) => item.elementId === element.id
          )
          return (
            <li
              key={element.id}
              className="flex items-center justify-between gap-3 py-3"
            >
              <div className="min-w-0">
                <div className="break-words font-medium">{element.name}</div>
                <div className="text-xs text-slate-600">
                  {t(`shared.types.${element.type}`)} · #{element.id}
                </div>
              </div>
              <Button
                disabled={
                  loading || assigned || !supported || !leafKey || !levelKey
                }
                data={{ cy: `competence-tree-library-add-${element.id}` }}
                onClick={() => {
                  const coverage = form.coverages.find(
                    (cell) =>
                      cell.leafKey === leafKey && cell.levelKey === levelKey
                  )
                  onChange({
                    ...form,
                    coverages: coverage
                      ? form.coverages.map((cell) =>
                          cell === coverage ? { ...cell, enabled: true } : cell
                        )
                      : [
                          ...form.coverages,
                          {
                            leafKey,
                            levelKey,
                            enabled: true,
                            targetItemCount: 5,
                          },
                        ],
                    assignments: [
                      ...form.assignments,
                      {
                        key: `assignment:local:${element.id}`,
                        sourceId: -element.id,
                        elementId: element.id,
                        elementName: element.name,
                        elementType: element.type,
                        elementVersion: element.version,
                        leafKey,
                        levelKey,
                        enabled: true,
                        discrimination: null,
                        enablePercentInput: false,
                        choiceCount:
                          'options' in element &&
                          element.options &&
                          'choices' in element.options
                            ? element.options.choices.length
                            : null,
                        a: form.defaultDiscrimination,
                        b:
                          mapLevelsToTheta(
                            form.levels,
                            { min: form.thetaMin, max: form.thetaMax },
                            form.levelMappingRule
                          ).find(
                            (item) =>
                              item.order ===
                              form.levels.find(
                                (level) => level.key === levelKey
                              )?.order
                          )?.theta ?? 0,
                        c: deriveGuessingParameter({
                          type: element.type as AdaptiveItemType,
                          choiceCount:
                            'options' in element &&
                            element.options &&
                            'choices' in element.options
                              ? element.options.choices.length
                              : null,
                        }),
                      },
                    ],
                  })
                }}
              >
                <Button.Label>
                  {t(
                    assigned
                      ? 'manage.competenceTree.assigned'
                      : 'manage.competenceTree.addElement'
                  )}
                </Button.Label>
              </Button>
            </li>
          )
        })}
      </ul>
      {!loading && elements.length === 0 && (
        <p className="py-4 text-sm">{t('manage.competenceTree.noElements')}</p>
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
    </details>
  )
}
export default ElementLibraryPicker
