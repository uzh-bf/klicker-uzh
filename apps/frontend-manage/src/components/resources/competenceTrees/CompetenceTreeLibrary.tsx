import { NetworkStatus, useMutation, useQuery } from '@apollo/client'
import {
  faArchive,
  faArrowRotateLeft,
  faCopy,
  faFolderOpen,
  faLink,
  faLock,
  faMagnifyingGlass,
  faPlus,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ArchiveCompetenceTreeDocument,
  CompetenceTreeCatalogDocument,
  CompetenceTreeCatalogOwnership,
  CompetenceTreeSummaryDataFragment,
  DuplicateCompetenceTreeDocument,
  GetUserCoursesDocument,
  RestoreCompetenceTreeDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import {
  Badge,
  Button,
  Select,
  Switch,
  TextField,
  UserNotification,
} from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import ConfirmationModal from './ConfirmationModal'
import CourseLinksModal from './CourseLinksModal'
import IconAction from './IconAction'

type OwnershipFilter = 'owned' | 'linked' | 'all'

const ownershipFilterLabels: Record<
  OwnershipFilter,
  | 'manage.competenceTree.filterOwned'
  | 'manage.competenceTree.filterLinked'
  | 'manage.competenceTree.filterAll'
> = {
  owned: 'manage.competenceTree.filterOwned',
  linked: 'manage.competenceTree.filterLinked',
  all: 'manage.competenceTree.filterAll',
}

function CompetenceTreeLibrary() {
  const t = useTranslations()
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [ownershipFilter, setOwnershipFilter] =
    useState<OwnershipFilter>('owned')
  const [courseFilter, setCourseFilter] = useState('all')
  const [showArchived, setShowArchived] = useState(false)
  const [selectedTree, setSelectedTree] =
    useState<CompetenceTreeSummaryDataFragment | null>(null)
  const [archiveTree, setArchiveTree] =
    useState<CompetenceTreeSummaryDataFragment | null>(null)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [pendingTreeId, setPendingTreeId] = useState<string | null>(null)
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search), 250)
    return () => window.clearTimeout(timeout)
  }, [search])

  const ownership =
    ownershipFilter === 'owned'
      ? CompetenceTreeCatalogOwnership.Owned
      : ownershipFilter === 'linked'
        ? CompetenceTreeCatalogOwnership.Linked
        : CompetenceTreeCatalogOwnership.All
  const catalogVariables = {
    search: debouncedSearch.trim() || undefined,
    includeArchived: showArchived,
    ownership,
    courseId: courseFilter === 'all' ? undefined : courseFilter,
    limit: 25,
  }
  const { data, loading, error, refetch, fetchMore, networkStatus } = useQuery(
    CompetenceTreeCatalogDocument,
    {
      variables: catalogVariables,
      fetchPolicy: 'cache-and-network',
      notifyOnNetworkStatusChange: true,
    }
  )
  const { data: coursesData } = useQuery(GetUserCoursesDocument)
  const [duplicateTree] = useMutation(DuplicateCompetenceTreeDocument)
  const [archiveCompetenceTree] = useMutation(ArchiveCompetenceTreeDocument)
  const [restoreCompetenceTree] = useMutation(RestoreCompetenceTreeDocument)
  const trees = useMemo(
    () => data?.competenceTreeCatalog.items ?? [],
    [data?.competenceTreeCatalog.items]
  )
  const courses = useMemo(
    () =>
      (coursesData?.userCourses ?? [])
        .filter((course) => !course.isArchived)
        .map((course) => [course.id, course.displayName] as const)
        .sort((a, b) => a[1].localeCompare(b[1])),
    [coursesData?.userCourses]
  )
  const nextCursor = data?.competenceTreeCatalog.nextCursor

  const runAction = async (treeId: string, action: () => Promise<unknown>) => {
    setPendingTreeId(treeId)
    setRequestError(null)
    try {
      await action()
      await refetch()
    } catch (actionError) {
      setRequestError(
        actionError instanceof Error
          ? actionError.message
          : t('manage.competenceTree.actionError')
      )
    } finally {
      setPendingTreeId(null)
    }
  }

  const handleDuplicate = async (tree: CompetenceTreeSummaryDataFragment) => {
    await runAction(tree.id, async () => {
      const result = await duplicateTree({ variables: { id: tree.id } })
      const duplicate = result.data?.duplicateCompetenceTree
      if (!duplicate) throw new Error(t('manage.competenceTree.actionError'))
      await router.push(`/resources/competenceTrees/${duplicate.id}`)
    })
  }

  return (
    <div className="w-full" data-cy="competence-tree-library">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            {t('manage.resources.competenceTrees')}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            {t('manage.competenceTree.libraryDescription')}
          </p>
        </div>
        <Button
          primary
          onClick={() => router.push('/resources/competenceTrees/new')}
          data={{ cy: 'competence-tree-create' }}
        >
          <Button.Icon icon={faPlus} />
          <Button.Label>{t('manage.competenceTree.create')}</Button.Label>
        </Button>
      </div>

      <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(14rem,1fr)_auto_minmax(12rem,0.5fr)_auto] lg:items-center">
        <TextField
          label={t('manage.competenceTree.searchLabel')}
          value={search}
          onChange={setSearch}
          icon={faMagnifyingGlass}
          placeholder={t('manage.competenceTree.searchPlaceholder')}
          data={{ cy: 'competence-tree-search' }}
        />
        <div
          className="flex h-9"
          role="group"
          aria-label={t('manage.competenceTree.ownershipFilter')}
        >
          {(['owned', 'linked', 'all'] as const).map((filter) => (
            <Button
              key={filter}
              active={ownershipFilter === filter}
              onClick={() => setOwnershipFilter(filter)}
              data={{ cy: `competence-tree-filter-${filter}` }}
              className={{
                root: 'h-9 rounded-none first:rounded-l first:border-r-0 last:rounded-r last:border-l-0',
              }}
            >
              <Button.Label>{t(ownershipFilterLabels[filter])}</Button.Label>
            </Button>
          ))}
        </div>
        <Select
          value={courseFilter}
          onChange={setCourseFilter}
          items={[
            {
              value: 'all',
              label: t('manage.competenceTree.allCourses'),
            },
            ...courses.map(([id, name]) => ({ value: id, label: name })),
          ]}
          data={{ cy: 'competence-tree-course-filter' }}
          className={{ trigger: 'h-9 w-full' }}
        />
        <div className="flex items-center gap-3">
          <label
            htmlFor="competence-tree-show-archived"
            className="text-sm font-medium"
          >
            {t('manage.competenceTree.showArchived')}
          </label>
          <Switch
            id="competence-tree-show-archived"
            checked={showArchived}
            onCheckedChange={setShowArchived}
            size="sm"
            data={{ cy: 'competence-tree-show-archived' }}
          />
        </div>
      </div>

      {(requestError || error) && (
        <UserNotification
          type="error"
          message={requestError ?? error?.message ?? ''}
          dismissible={!!requestError}
          onDismiss={() => setRequestError(null)}
          data={{ cy: 'competence-tree-library-error' }}
          className={{ root: 'mb-4' }}
        />
      )}

      {loading && !data ? (
        <Loader />
      ) : (
        <div className="border-y border-slate-300">
          <div className="hidden grid-cols-[minmax(14rem,1.3fr)_minmax(12rem,1fr)_11rem_12rem_12rem] gap-4 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 xl:grid">
            <div>{t('manage.competenceTree.tree')}</div>
            <div>{t('manage.competenceTree.linkedCourses')}</div>
            <div>{t('manage.competenceTree.structure')}</div>
            <div>{t('manage.competenceTree.usage')}</div>
            <div className="text-right">
              {t('manage.competenceTree.actions')}
            </div>
          </div>

          {trees.map((tree) => {
            const pending = pendingTreeId === tree.id

            return (
              <div
                key={tree.id}
                className={`grid gap-3 border-t border-slate-200 px-3 py-3 first:border-t-0 xl:grid-cols-[minmax(14rem,1.3fr)_minmax(12rem,1fr)_11rem_12rem_12rem] xl:items-center xl:gap-4 ${
                  tree.isArchived ? 'bg-slate-50 text-slate-600' : 'bg-white'
                }`}
                data-cy={`competence-tree-row-${tree.id}`}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        router.push(`/resources/competenceTrees/${tree.id}`)
                      }
                      className="min-w-0 truncate text-left font-semibold hover:underline"
                      data-cy={`competence-tree-open-name-${tree.id}`}
                    >
                      {tree.displayName}
                    </button>
                    <Badge
                      className={
                        tree.isOwner
                          ? 'bg-green-100 text-green-800 hover:bg-green-100'
                          : 'bg-sky-100 text-sky-800 hover:bg-sky-100'
                      }
                    >
                      {t(
                        tree.isOwner
                          ? 'manage.competenceTree.owned'
                          : 'manage.competenceTree.linkedReadOnly'
                      )}
                    </Badge>
                    {tree.isArchived && (
                      <Badge>{t('manage.competenceTree.archived')}</Badge>
                    )}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-slate-500">
                    {tree.name}
                  </div>
                  {tree.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                      {tree.description}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {tree.courseLinks.map((link) => (
                    <Badge
                      key={link.id}
                      className="bg-slate-100 text-slate-700 hover:bg-slate-100"
                    >
                      {link.courseName}
                    </Badge>
                  ))}
                  {tree.courseLinks.length === 0 && (
                    <span className="text-sm text-slate-500">
                      {t('manage.competenceTree.noLinkedCourses')}
                    </span>
                  )}
                  {tree.courseLinkCount > tree.courseLinks.length ? (
                    <span className="text-xs text-slate-500">
                      {t('manage.competenceTree.moreCourseLinks', {
                        count: tree.courseLinkCount - tree.courseLinks.length,
                      })}
                    </span>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm xl:block">
                  <div>
                    {t('manage.competenceTree.levelCount', {
                      count: tree.levelCount,
                    })}
                  </div>
                  <div>
                    {t('manage.competenceTree.nodeCount', {
                      count: tree.nodeCount,
                    })}
                  </div>
                  <div>
                    {t('manage.competenceTree.assignmentCount', {
                      count: tree.assignmentCount,
                    })}
                  </div>
                </div>

                <div className="text-sm">
                  <div>
                    {t('manage.competenceTree.draftUsage', {
                      count: tree.draftAdaptiveQuizCount,
                    })}
                  </div>
                  <div>
                    {t('manage.competenceTree.publishedUsage', {
                      count: tree.publishedAdaptiveQuizCount,
                    })}
                  </div>
                  {tree.isStructurallyLocked && (
                    <div className="mt-1 flex items-center gap-1 text-amber-700">
                      <FontAwesomeIcon
                        icon={faLock}
                        className="h-3 w-3"
                        title={t('manage.competenceTree.structurallyLocked')}
                      />
                      <span>
                        {t('manage.competenceTree.structurallyLocked')}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-0.5">
                  <IconAction
                    icon={faFolderOpen}
                    label={t('manage.competenceTree.open')}
                    onClick={() =>
                      router.push(`/resources/competenceTrees/${tree.id}`)
                    }
                    disabled={pending}
                    dataCy={`competence-tree-open-${tree.id}`}
                  />
                  <IconAction
                    icon={faCopy}
                    label={t('manage.competenceTree.duplicate')}
                    onClick={() => void handleDuplicate(tree)}
                    disabled={pending}
                    dataCy={`competence-tree-duplicate-${tree.id}`}
                  />
                  {tree.isOwner && (
                    <IconAction
                      icon={faLink}
                      label={t('manage.competenceTree.manageLinks')}
                      onClick={() => setSelectedTree(tree)}
                      disabled={pending}
                      dataCy={`competence-tree-links-${tree.id}`}
                    />
                  )}
                  {tree.isOwner && !tree.isArchived && (
                    <IconAction
                      icon={faArchive}
                      label={t('manage.competenceTree.archive')}
                      onClick={() => setArchiveTree(tree)}
                      disabled={pending}
                      dataCy={`competence-tree-archive-${tree.id}`}
                    />
                  )}
                  {tree.isOwner && tree.isArchived && (
                    <IconAction
                      icon={faArrowRotateLeft}
                      label={t('manage.competenceTree.restore')}
                      onClick={() =>
                        void runAction(tree.id, () =>
                          restoreCompetenceTree({ variables: { id: tree.id } })
                        )
                      }
                      disabled={pending}
                      dataCy={`competence-tree-restore-${tree.id}`}
                    />
                  )}
                </div>
              </div>
            )
          })}

          {trees.length === 0 && (
            <div className="p-8 text-center text-sm text-slate-600">
              {t('manage.competenceTree.emptyLibrary')}
            </div>
          )}
          {nextCursor ? (
            <div className="flex justify-center border-t border-slate-200 p-4">
              <Button
                onClick={() =>
                  void fetchMore({
                    variables: { ...catalogVariables, cursor: nextCursor },
                    updateQuery: (previous, { fetchMoreResult }) => {
                      const previousItems = previous.competenceTreeCatalog.items
                      const knownIds = new Set(
                        previousItems.map((tree) => tree.id)
                      )
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
                loading={networkStatus === NetworkStatus.fetchMore}
                data={{ cy: 'competence-tree-load-more' }}
              >
                {t('manage.competenceTree.loadMore')}
              </Button>
            </div>
          ) : null}
        </div>
      )}

      {selectedTree && selectedTree.isOwner && (
        <CourseLinksModal
          tree={selectedTree}
          onClose={() => setSelectedTree(null)}
          onChanged={() => refetch()}
        />
      )}

      {archiveTree && (
        <ConfirmationModal
          title={t('manage.competenceTree.archiveTitle')}
          message={t('manage.competenceTree.archiveWarning', {
            tree: archiveTree.displayName,
          })}
          confirmLabel={t('manage.competenceTree.archive')}
          cancelLabel={t('manage.competenceTree.cancel')}
          onConfirm={() => {
            const tree = archiveTree
            setArchiveTree(null)
            void runAction(tree.id, () =>
              archiveCompetenceTree({ variables: { id: tree.id } })
            )
          }}
          onClose={() => setArchiveTree(null)}
          dataCy="competence-tree-archive-modal"
        />
      )}
    </div>
  )
}

export default CompetenceTreeLibrary
