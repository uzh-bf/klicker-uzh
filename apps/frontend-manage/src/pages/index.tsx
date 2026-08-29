import { useQuery } from '@apollo/client'
import {
  faListCheck,
  faWandMagicSparkles,
} from '@fortawesome/free-solid-svg-icons'
import {
  ActivityType,
  Element,
  GetUserElementsDocument,
  SharingType,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, toast } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { Suspense, useCallback, useEffect, useState } from 'react'
import ActivityCreation from '../components/activities/ActivityCreation'
import SuspendedCreationButtons from '../components/activities/creation/SuspendedCreationButtons'
import Pagination, {
  isPaginationPageSize,
  type PaginationPageSize,
} from '@components/common/Pagination'
import ElementList from '../components/elements/ElementList'
import ElementListSearch from '../components/elements/ElementListSearch'
import ElementListSelectAllCheckbox from '../components/elements/ElementListSelectAllCheckbox'
import ElementListSorting from '../components/elements/ElementListSorting'
import ElementBatchOperationsModal from '../components/elements/manipulation/ElementBatchOperationsModal'
import ElementEditModal, {
  ElementEditMode,
} from '../components/elements/manipulation/ElementEditModal'
import RecoveryPrompt from '../components/elements/manipulation/RecoveryPrompt'
import FilterList from '../components/elements/tags/FilterList'
import Layout from '../components/Layout'
import SuspendedFirstLoginModal from '../components/user/SuspendedFirstLoginModal'
import { useAiFeaturesEnabled } from '../lib/hooks/useAiFeaturesEnabled'
import useSortingAndFiltering, {
  SORTING_FILTERING_INITIAL,
} from '../lib/hooks/useSortingAndFiltering'

function Index() {
  const router = useRouter()
  const t = useTranslations()
  const aiFeaturesEnabled = useAiFeaturesEnabled()

  // search, filter and pagination states
  const [searchString, setSearchString] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  // initialize page size from local storage (if available)
  const [pageSize, setPageSize] = useState<PaginationPageSize>(() => {
    // only try to access localStorage when on the client
    if (typeof window !== 'undefined') {
      try {
        const storedPageSize = localStorage.getItem('elements-page-size')
        if (storedPageSize) {
          const parsedPageSize = JSON.parse(storedPageSize) as unknown
          if (isPaginationPageSize(parsedPageSize)) {
            return parsedPageSize
          }
        }
      } catch (error) {
        console.error(
          'Error parsing stored elements-page-size from localStorage',
          error
        )
      }
    }
    return 10
  })

  const [modificationModalOpen, setModificationModalOpen] = useState(false)
  const [batchOperationsOpen, setBatchOperationsOpen] = useState(false)

  // creation, recovery and editing modal states
  const [showRecoveryPrompt, setShowRecoveryPrompt] = useState(false)
  const [creationMode, setCreationMode] = useState<undefined | ActivityType>(
    undefined
  )
  const [isElementCreationModalOpen, setIsElementCreationModalOpen] =
    useState(false)

  const [selectedElements, setSelectedElements] = useState<{
    [elementId: number]: Element
  }>({})

  // initialize the sorting and filtering state from local storage (if available)
  const [storedFiltering, _] = useState(() => {
    // only try to access localStorage if we're on the client
    if (typeof window !== 'undefined') {
      try {
        const savedFilters = localStorage.getItem('library-filtering-sorting')
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
    toggleCourseIdFilter,
    toggleActivityIdFilter,
    toggleMultiplierFilter,
    toggleSampleSolutionFilter,
    toggleAnswerFeedbackFilter,
  } = useSortingAndFiltering(storedFiltering)

  const handleResetCleanURL = useCallback(() => {
    // if a filtering by activity / course is set through the URL, reset it
    if (router.query.filterByActivity || router.query.filterByCourse) {
      router.push({ pathname: '/', query: {} }, undefined, {
        shallow: true,
      })
    }

    // reset the filters and sorting
    handleReset()
  }, [router.query.filterByCourse, router.query.filterByActivity])

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
      activityId: filters.activityId,
      multiplier: filters.multiplier,
      showUntagged: filters.untagged,
      sortByType: sort.by,
      sortByAsc: sort.asc,
      showArchived: filters.archive,
      numEntries: pageSize === 'all' ? undefined : pageSize,
      offset: pageSize === 'all' ? undefined : (currentPage - 1) * pageSize,
    },
    fetchPolicy: 'network-only',
  })
  const numOfElements = dataElements?.userElements?.numOfElements || 0
  const elements = dataElements?.userElements?.elements ?? []
  const refetchElementsForChildren = useCallback(async () => {
    await refetchElements()
  }, [refetchElements])

  // on change, store new page size in local storage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('elements-page-size', JSON.stringify(pageSize))
    }
  }, [pageSize])

  // reset pagination if elements length changes and current page would be out of bounds
  useEffect(() => {
    if (loadingElements) return

    const maxPage =
      pageSize === 'all' ? 1 : Math.max(1, Math.ceil(numOfElements / pageSize))
    if (currentPage > maxPage) {
      setCurrentPage(maxPage)
    }
  }, [loadingElements, numOfElements, currentPage, pageSize])

  // reset pagination when filters, sorting or search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [filters, sort, searchString])

  // compute the number of total pagination pages
  const totalPages =
    pageSize === 'all' ? 1 : Math.max(1, Math.ceil(numOfElements / pageSize))

  // if the filters or sorting state changes, save it to local storage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const newState = { filters, sort }
        // only save if there are actual changes
        const currentStored = localStorage.getItem('library-filtering-sorting')
        if (!currentStored || JSON.stringify(newState) !== currentStored) {
          localStorage.setItem(
            'library-filtering-sorting',
            JSON.stringify(newState)
          )
        }
      } catch (error) {
        console.error('Error saving filters to localStorage', error)
      }
    }
  }, [filters, sort])

  // when the shown elements change, make sure the selected elements are still valid
  useEffect(() => {
    setSelectedElements((prev) => {
      const updatedSelection = { ...prev }
      let changed = false

      Object.keys(updatedSelection).forEach((id) => {
        const numericalId = parseInt(id, 10)
        if (!elements.some((el) => el.id === numericalId)) {
          delete updatedSelection[numericalId]
          changed = true
        }
      })

      // only update state if something actually changed to avoid render loop
      return changed ? updatedSelection : prev
    })
  }, [elements])

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

  // if passed through the query arguments, open the element editing dialog
  useEffect(() => {
    if (router.query.editElementId) {
      setModificationModalOpen(true)
    }
  }, [router.query.editElementId])

  // if the library should be filtered by activity, reset the filters and re-set them accordingly
  useEffect(() => {
    if (router.query.filterByActivity) {
      handleReset()

      if (router.query.filterByCourse) {
        toggleCourseIdFilter({
          courseId: router.query.filterByCourse as string,
        })
      }
      toggleActivityIdFilter({
        activityId: router.query.filterByActivity as string,
      })
    }
  }, [router.query.filterByCourse, router.query.filterByActivity])

  // since only applying the course filter does not result in a filtering of the elements, no warning should be shown
  const filtersActiveExceptCourse = !!(
    filters.tags.length > 0 ||
    filters.activityId ||
    filters.type ||
    filters.status ||
    filters.sharingType?.length !== 3 ||
    filters.multiplier ||
    filters.sampleSolution ||
    filters.answerFeedbacks ||
    filters.untagged
  )
  const filtersActive = filtersActiveExceptCourse || !!filters.courseId

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
          <ActivityCreation
            creationMode={creationMode}
            closeWizard={() => {
              router.push('/')
              setCreationMode(() => undefined)
            }}
            activityId={router.query.elementId as string}
            editMode={router.query.editMode as ActivityType}
            conversionMode={router.query.conversionMode as string}
            duplicationMode={router.query.duplicationMode as ActivityType}
            selection={selectedElements}
            resetSelection={() => setSelectedElements({})}
          />
        </>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto md:flex-row">
        <div>
          <FilterList
            key={creationMode}
            defaultValue={
              filters.courseId || filters.activityId
                ? 'used-in-activity'
                : undefined
            }
            filtersActive={filtersActive}
            filters={filters}
            handleReset={handleResetCleanURL}
            handleTagClick={handleTagClick}
            toggleCourseIdFilter={toggleCourseIdFilter}
            toggleActivityIdFilter={toggleActivityIdFilter}
            toggleMultiplierFilter={toggleMultiplierFilter}
            toggleSampleSolutionFilter={toggleSampleSolutionFilter}
            toggleAnswerFeedbackFilter={toggleAnswerFeedbackFilter}
            handleToggleArchive={handleToggleArchive}
            isArchiveActive={filters.archive}
            refetchElements={refetchElementsForChildren}
          />
        </div>

        <div className="flex w-full flex-1 flex-col">
          <>
            <div className="flex flex-none flex-row content-center items-end justify-between pb-2.5">
              <div className="flex flex-row items-center gap-1.5">
                <ElementListSelectAllCheckbox
                  elements={elements}
                  selectedElements={selectedElements}
                  setSelectedElements={setSelectedElements}
                  creationMode={creationMode}
                />
                <ElementListSearch setSearchString={setSearchString} />
                <ElementListSorting
                  sort={sort}
                  handleSortByChange={handleSortByChange}
                  handleSortOrderToggle={handleSortOrderToggle}
                />
              </div>

              <div className="flex flex-row items-center gap-2">
                {!creationMode && Object.keys(selectedElements).length > 0 ? (
                  <Button
                    className={{
                      root: 'h-9 border-orange-300 bg-orange-100 hover:border-orange-400 hover:bg-orange-200 hover:text-orange-900',
                    }}
                    onClick={() => setBatchOperationsOpen(true)}
                    data={{ cy: 'element-batch-operations' }}
                  >
                    <Button.Icon icon={faListCheck} />
                    <Button.Label>
                      {t('manage.questionPool.batchOperations', {
                        numElements: Object.keys(selectedElements).length,
                      })}
                    </Button.Label>
                  </Button>
                ) : null}
                {aiFeaturesEnabled ? (
                  <Button
                    onClick={() => router.push('/elements/generate')}
                    data={{ cy: 'generate-elements' }}
                    className={{ root: 'h-9 font-bold' }}
                  >
                    <Button.Icon icon={faWandMagicSparkles} />
                    <Button.Label>
                      {t('manage.elementGeneration.actions.generate')}
                    </Button.Label>
                  </Button>
                ) : null}
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
                  className={{ root: 'h-9 font-bold' }}
                >
                  {t('manage.questionPool.createElement')}
                </Button>
              </div>
            </div>

            {!dataElements || loadingElements ? (
              <div className="flex flex-1 items-center justify-center">
                <Loader />
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <ElementList
                    filtersActive={filtersActiveExceptCourse}
                    activityWizardOpen={!!creationMode}
                    elements={elements}
                    selectedElements={selectedElements}
                    triggerSuccessToast={() =>
                      toast({
                        type: 'success',
                        message: t('manage.elements.questionSavedSuccessfully'),
                        options: { duration: 4000 },
                      })
                    }
                    setSelectedElements={(id: number, data: Element) => {
                      setSelectedElements((prev) => {
                        const newSelected = { ...prev }
                        if (newSelected[id]) {
                          delete newSelected[id]
                        } else {
                          newSelected[id] = data
                        }
                        return newSelected
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
                    handleFilterReset={handleResetCleanURL}
                    refetchElements={refetchElementsForChildren}
                  />
                </div>

                {elements.length > 0 && (
                  <Pagination
                    totalPages={totalPages}
                    currentPage={currentPage}
                    setCurrentPage={setCurrentPage}
                    numOfObjects={numOfElements}
                    pageSize={pageSize}
                    setPageSize={setPageSize}
                    showAll
                    className="flex-none pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0 md:pr-56"
                  />
                )}
              </div>
            )}
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
          refetchElements={refetchElementsForChildren}
        />
      )}
      {modificationModalOpen && router.query.editElementId && (
        <ElementEditModal
          isOpen
          inputsDisabled={false}
          handleSetIsOpen={setModificationModalOpen}
          triggerSuccessToast={() =>
            toast({
              type: 'success',
              message: t('manage.elements.questionSavedSuccessfully'),
              options: { duration: 4000 },
            })
          }
          elementId={parseInt(router.query.editElementId as string, 10)}
          mode={ElementEditMode.EDIT}
          refetchElements={refetchElementsForChildren}
        />
      )}
      {batchOperationsOpen && (
        <ElementBatchOperationsModal
          selectedElements={Object.values(selectedElements)}
          onClose={() => setBatchOperationsOpen(false)}
          resetSelectedElements={() => setSelectedElements({})}
          refetchElements={refetchElementsForChildren}
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
          refetchElements={refetchElementsForChildren}
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
