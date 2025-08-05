import { useQuery } from '@apollo/client'
import {
  ActivityType,
  Element,
  GetUserElementsDocument,
  SharingType,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, Checkbox, toast } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { isEmpty, pickBy } from 'remeda'
import SuspendedCreationButtons from '../components/activities/creation/SuspendedCreationButtons'
import ElementCreation from '../components/activities/ElementCreation'
import Pagination from '../components/common/Pagination'
import ArchiveActionButtons from '../components/elements/ArchiveActionButtons'
import ElementList from '../components/elements/ElementList'
import ElementListSearch from '../components/elements/ElementListSearch'
import ElementListSorting from '../components/elements/ElementListSorting'
import ElementEditModal, {
  ElementEditMode,
} from '../components/elements/manipulation/ElementEditModal'
import RecoveryPrompt from '../components/elements/manipulation/RecoveryPrompt'
import TagList from '../components/elements/tags/TagList'
import Layout from '../components/Layout'
import SuspendedFirstLoginModal from '../components/user/SuspendedFirstLoginModal'
import useSortingAndFiltering, {
  SORTING_FILTERING_INITIAL,
} from '../lib/hooks/useSortingAndFiltering'

const PAGE_SIZE = 10

function Index() {
  const router = useRouter()
  const t = useTranslations()

  // search, filter and pagination states
  const [searchString, setSearchString] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  // creation, recovery and editing modal states
  const [showRecoveryPrompt, setShowRecoveryPrompt] = useState(false)
  const [creationMode, setCreationMode] = useState<undefined | ActivityType>(
    undefined
  )
  const [isElementCreationModalOpen, setIsElementCreationModalOpen] =
    useState(false)

  const [selectedElements, setSelectedElements] = useState<
    Record<number, Element | undefined>
  >({})

  const selectedElementContent = useMemo(
    () =>
      pickBy(
        selectedElements,
        (value) => typeof value !== 'undefined'
      ) as Record<number, Element>,
    [selectedElements]
  )

  // initialize the sorting and filtering state from local storage (if available)
  const [storedFiltering, _] = useState(() => {
    // only try to access localStorage if we're on the client
    if (typeof window !== 'undefined') {
      try {
        const savedFilters = localStorage.getItem('library-sorting-filters')
        if (savedFilters) {
          return JSON.parse(savedFilters)
        }
      } catch (error) {
        console.error('Error loading stored filters from localStorage', error)
      }
    }
    return SORTING_FILTERING_INITIAL
  })

  const {
    filters,
    sort,
    handleSortByChange,
    handleSortOrderToggle,
    handleTagClick,
    handleReset,
    handleToggleArchive,
    toggleSampleSolutionFilter,
    toggleAnswerFeedbackFilter,
  } = useSortingAndFiltering(storedFiltering)

  const {
    loading: loadingElements,
    data: dataElements,
    refetch: refetchElements,
  } = useQuery(GetUserElementsDocument, {
    variables: {
      status: filters.status,
      type: filters.type,
      hasSampleSolution: filters.sampleSolution,
      hasAnswerFeedbacks: filters.answerFeedbacks,
      searchString: searchString.trim() || undefined,
      showOwned: filters.sharingType.includes(SharingType.Owned),
      showShared: filters.sharingType.includes(SharingType.Shared),
      showDependencies: filters.sharingType.includes(SharingType.Dependency),
      tagIds: filters.tags.map((tag) => parseInt(tag, 10)) ?? [],
      showUntagged: filters.untagged,
      sortByType: sort.by,
      sortByAsc: sort.asc,
      showArchived: filters.archive,
      numEntries: PAGE_SIZE,
      offset: (currentPage - 1) * PAGE_SIZE,
    },
    fetchPolicy: 'network-only',
  })
  const numOfElements = dataElements?.userElements?.numOfElements || 0
  const elements = dataElements?.userElements?.elements ?? []

  // reset pagination if elements length changes and current page would be out of bounds
  useEffect(() => {
    if (loadingElements) return

    const maxPage = Math.max(1, Math.ceil(numOfElements / PAGE_SIZE))
    if (currentPage > maxPage) {
      setCurrentPage(maxPage)
    }
  }, [loadingElements, numOfElements, currentPage])

  // reset pagination when filters, sorting or search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [filters, sort, searchString])

  // compute the number of total pagination pages
  const totalPages = Math.max(1, Math.ceil(numOfElements / PAGE_SIZE))

  // if the filters or sorting state changes, save it to local storage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const newState = { filters, sort }
        // only save if there are actual changes
        const currentStored = localStorage.getItem('library-sorting-filters')
        if (!currentStored || JSON.stringify(newState) !== currentStored) {
          localStorage.setItem(
            'library-sorting-filters',
            JSON.stringify(newState)
          )
        }
      } catch (error) {
        console.error('Error saving filters to localStorage', error)
      }
    }
  }, [filters, sort])

  // on initial render, preload the pages that might be visited next
  useEffect((): void => {
    router.prefetch('/quizzes/running')
    router.prefetch('/quizzes')
    router.prefetch('/activities')

    if (router.query.elementId && router.query.editMode) {
      setCreationMode(router.query.editMode as ActivityType)
    } else if (router.query.elementId && router.query.duplicationMode) {
      setCreationMode(router.query.duplicationMode as ActivityType)
    } else if (router.query.elementId && router.query.conversionMode) {
      setCreationMode(router.query.conversionMode as ActivityType)
    }
  }, [router])

  // once the activity wizard is opened, deselect all invalid elements
  useEffect(() => {
    setSelectedElements((selection) => {
      if (!!creationMode) {
        return Object.fromEntries(
          Object.entries(selection).filter(
            ([, question]) => question?.isManager ?? false
          )
        )
      }
      return selection
    })
  }, [creationMode])

  const filtersActive = !!(
    filters.tags.length > 0 ||
    filters.type ||
    filters.status ||
    filters.sharingType?.length !== 3 ||
    filters.sampleSolution ||
    filters.answerFeedbacks ||
    filters.untagged
  )

  return (
    <Layout
      displayName={t('manage.general.questionPool')}
      data={{ cy: 'homepage' }}
      className={{ children: 'pb-2' }}
    >
      {typeof creationMode === 'undefined' && (
        <Suspense fallback={<div />}>
          <SuspendedCreationButtons setCreationMode={setCreationMode} />
        </Suspense>
      )}

      {creationMode && (
        <>
          <ElementCreation
            creationMode={creationMode}
            closeWizard={() => {
              router.push('/')
              setCreationMode(() => undefined)
            }}
            activityId={router.query.elementId as string}
            editMode={router.query.editMode as ActivityType}
            conversionMode={router.query.conversionMode as string}
            duplicationMode={router.query.duplicationMode as ActivityType}
            selection={selectedElementContent}
            resetSelection={() => setSelectedElements({})}
          />
        </>
      )}

      <div className="flex h-full flex-col gap-4 overflow-y-auto md:flex-row">
        <div>
          <div className="hidden h-full md:block">
            <TagList
              key={creationMode}
              compact={!!creationMode}
              filtersActive={filtersActive}
              activeTags={filters.tags}
              activeType={filters.type}
              activeSharingTypes={filters.sharingType}
              activeStatus={filters.status}
              showUntagged={filters.untagged}
              sampleSolution={filters.sampleSolution}
              answerFeedbacks={filters.answerFeedbacks}
              handleReset={handleReset}
              handleTagClick={handleTagClick}
              toggleSampleSolutionFilter={toggleSampleSolutionFilter}
              toggleAnswerFeedbackFilter={toggleAnswerFeedbackFilter}
              handleToggleArchive={handleToggleArchive}
              isArchiveActive={filters.archive}
              refetchElements={async () => {
                await refetchElements()
              }}
            />
          </div>
          <div className="md:hidden">
            <TagList
              compact
              key={creationMode}
              filtersActive={filtersActive}
              activeTags={filters.tags}
              activeType={filters.type}
              activeSharingTypes={filters.sharingType}
              activeStatus={filters.status}
              showUntagged={filters.untagged}
              sampleSolution={filters.sampleSolution}
              answerFeedbacks={filters.answerFeedbacks}
              handleReset={handleReset}
              handleTagClick={handleTagClick}
              toggleSampleSolutionFilter={toggleSampleSolutionFilter}
              toggleAnswerFeedbackFilter={toggleAnswerFeedbackFilter}
              handleToggleArchive={handleToggleArchive}
              isArchiveActive={filters.archive}
              refetchElements={async () => {
                await refetchElements()
              }}
            />
          </div>
        </div>

        <div className="flex w-full flex-1 flex-col overflow-auto">
          <>
            <div className="flex flex-none flex-row content-center items-end justify-between pb-3">
              <div className="flex flex-row items-center gap-1">
                <div className="flex flex-col pr-0.5 text-xs">
                  <Checkbox
                    checked={
                      elements.length !== 0 &&
                      Object.values(selectedElements).filter((value) => value)
                        .length == elements.length
                    }
                    partial={
                      Object.values(selectedElements).filter((value) => value)
                        .length > 0
                    }
                    onCheck={() => {
                      setSelectedElements((prev) => {
                        let allElements = {}

                        if (elements) {
                          if (!isEmpty(selectedElementContent)) {
                            // set elements after filtering to undefined
                            // do not uncheck elements that are selected but not in the filtered set
                            allElements = elements.reduce(
                              (acc, curr) => ({
                                ...acc,
                                [curr.id]: undefined,
                              }),
                              {}
                            )
                          } else {
                            // set all elements after filtering to their id and data
                            allElements = elements.reduce(
                              (acc, question) => ({
                                ...acc,
                                [question.id]: question,
                              }),
                              {}
                            )
                          }
                        }

                        return { ...prev, ...allElements }
                      })
                    }}
                    className={{ root: 'border-unset' }}
                  />
                  {/* {t('manage.questionPool.numSelected', {
                    count: Object.keys(selectedElementContent).length,
                    total: elements.length ?? 0,
                  })} */}
                </div>

                <ElementListSearch setSearchString={setSearchString} />
                <ElementListSorting
                  sort={sort}
                  handleSortByChange={handleSortByChange}
                  handleSortOrderToggle={handleSortOrderToggle}
                />

                {Object.keys(selectedElements).length > 0 && (
                  <ArchiveActionButtons
                    selectedElements={selectedElements}
                    setSelectedElements={setSelectedElements}
                    refetchElements={async () => {
                      await refetchElements()
                    }}
                  />
                )}
              </div>
              <Button
                primary
                onClick={() => {
                  const value = localStorage.getItem(
                    'autosave-element-creation'
                  )

                  if (value) {
                    setShowRecoveryPrompt(true)
                  } else {
                    setIsElementCreationModalOpen(true)
                  }
                }}
                data={{ cy: 'create-question' }}
                className={{ root: 'font-bold' }}
              >
                {t('manage.questionPool.createQuestion')}
              </Button>
            </div>

            <div className="h-full overflow-y-auto">
              {!dataElements || loadingElements ? (
                <div className="flex h-full items-center justify-center">
                  <Loader />
                </div>
              ) : (
                <>
                  <ElementList
                    filtersActive={filtersActive}
                    activityWizardOpen={!!creationMode}
                    elements={elements}
                    selectedElements={selectedElementContent}
                    triggerSuccessToast={() =>
                      toast({
                        type: 'success',
                        message: t('manage.elements.questionSavedSuccessfully'),
                        options: { duration: 4000 },
                      })
                    }
                    setSelectedElements={(id: number, data: Element) => {
                      setSelectedElements((prev) => {
                        return { ...prev, [id]: prev[id] ? undefined : data }
                      })
                    }}
                    tagfilter={filters.tags}
                    handleTagClick={(tagId: number) =>
                      handleTagClick({
                        valueOrId: tagId.toString(),
                        isTypeTag: false,
                        isStatusTag: false,
                        isSharingTypeTag: false,
                        isUntagged: false,
                      })
                    }
                    unsetDeletedQuestion={(questionId: number) => {
                      setSelectedElements((prev) => {
                        if (prev[questionId]) {
                          const newselectedElements = { ...prev }
                          delete newselectedElements[questionId]
                          return newselectedElements
                        }
                        return prev
                      })
                    }}
                    handleFilterReset={handleReset}
                    refetchElements={async () => {
                      await refetchElements()
                    }}
                  />

                  {elements.length > 0 && totalPages > 1 && (
                    <Pagination
                      totalPages={totalPages}
                      currentPage={currentPage}
                      setCurrentPage={setCurrentPage}
                      numOfObjects={numOfElements}
                      PAGE_SIZE={PAGE_SIZE}
                      className="mb-3"
                    />
                  )}
                </>
              )}
            </div>
          </>
        </div>
      </div>

      {isElementCreationModalOpen && (
        <ElementEditModal
          handleSetIsOpen={setIsElementCreationModalOpen}
          triggerSuccessToast={() =>
            toast({
              type: 'success',
              message: t('manage.elements.questionSavedSuccessfully'),
              options: { duration: 4000 },
            })
          }
          isOpen={isElementCreationModalOpen}
          mode={ElementEditMode.CREATE}
          refetchElements={async () => {
            await refetchElements()
          }}
        />
      )}
      {showRecoveryPrompt && (
        <RecoveryPrompt
          onRecovery={() => {
            setShowRecoveryPrompt(false)
            setIsElementCreationModalOpen(true)
          }}
          onDiscard={() => {
            localStorage.removeItem('autosave-element-creation')
            setShowRecoveryPrompt(false)
            setIsElementCreationModalOpen(true)
          }}
        />
      )}
      <Suspense fallback={<div />}>
        <SuspendedFirstLoginModal
          refetchElements={async () => {
            await refetchElements()
          }}
        />
      </Suspense>
    </Layout>
  )
}

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
    },
  }
}

export default Index
