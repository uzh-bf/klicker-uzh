import { faListCheck } from '@fortawesome/free-solid-svg-icons'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, UserNotification, toast } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import {
  Suspense,
  useCallback,
  useEffect,
  useState,
  type ComponentProps,
} from 'react'
import ActivityCreation from '../components/activities/ActivityCreation'
import SuspendedCreationButtons from '../components/activities/creation/SuspendedCreationButtons'
import Pagination from '../components/common/Pagination'
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
import {
  ActivityType,
  type Element as CreationElement,
} from '../lib/constants/activityEnums'
import { SharingType } from '../lib/constants/sharingEnums'
import useSortingAndFiltering, {
  SORTING_FILTERING_INITIAL,
} from '../lib/hooks/useSortingAndFiltering'
import { trpc, type RouterInputs } from '../lib/trpc'

type ElementListInput = RouterInputs['element']['list']
type ElementListElement = NonNullable<
  ComponentProps<typeof ElementList>['elements']
>[number]
type ElementSelection = Record<number, ElementListElement>
const activityTypes = Object.values(ActivityType)

function getQueryString(value: string | string[] | undefined) {
  return typeof value === 'string' ? value : undefined
}

function getActivityTypeQuery(value: string | string[] | undefined) {
  const stringValue = getQueryString(value)

  return activityTypes.includes(stringValue as ActivityType)
    ? (stringValue as ActivityType)
    : undefined
}

function getPositiveIntegerQuery(value: string | string[] | undefined) {
  const numericValue = Number.parseInt(getQueryString(value) ?? '', 10)

  return Number.isInteger(numericValue) && numericValue > 0
    ? numericValue
    : undefined
}

function Index() {
  const router = useRouter()
  const t = useTranslations()
  const queryElementId = getQueryString(router.query.elementId)
  const queryEditMode = getActivityTypeQuery(router.query.editMode)
  const queryDuplicationMode = getActivityTypeQuery(
    router.query.duplicationMode
  )
  const queryConversionMode =
    getQueryString(router.query.conversionMode) ===
    'microLearningToPracticeQuiz'
      ? 'microLearningToPracticeQuiz'
      : undefined
  const queryCreationMode: ActivityType | undefined = queryElementId
    ? (queryEditMode ??
      queryDuplicationMode ??
      (queryConversionMode ? ActivityType.PracticeQuiz : undefined))
    : undefined
  const queryEditElementId = getPositiveIntegerQuery(router.query.editElementId)
  const filterByCourse = getQueryString(router.query.filterByCourse)
  const filterByActivity = getQueryString(router.query.filterByActivity)

  // search, filter and pagination states
  const [searchString, setSearchString] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  // initialize page size from local storage (if available)
  const [pageSize, setPageSize] = useState(() => {
    // only try to access localStorage when on the client
    if (typeof window !== 'undefined') {
      try {
        const storedPageSize = localStorage.getItem('elements-page-size')
        if (storedPageSize) {
          return JSON.parse(storedPageSize)
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

  const [selectedElements, setSelectedElements] = useState<ElementSelection>({})

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
    if (filterByActivity || filterByCourse) {
      router.push({ pathname: '/', query: {} }, undefined, {
        shallow: true,
      })
    }

    // reset the filters and sorting
    handleReset()
  }, [filterByCourse, filterByActivity])

  const elementListInput: ElementListInput = {
    status: filters.status as ElementListInput['status'],
    type: filters.type as ElementListInput['type'],
    hasSampleSolution: filters.sampleSolution,
    hasAnswerFeedbacks: filters.answerFeedbacks,
    searchString: searchString.trim() || undefined,
    showOwned: filters.sharingType.includes(
      SharingType.Owned as (typeof filters.sharingType)[number]
    ),
    showShared: filters.sharingType.includes(
      SharingType.Shared as (typeof filters.sharingType)[number]
    ),
    showDependencies: filters.sharingType.includes(
      SharingType.Dependency as (typeof filters.sharingType)[number]
    ),
    tagIds: filters.tags.map((tag) => parseInt(tag, 10)) ?? [],
    activityId: filters.activityId,
    multiplier: filters.multiplier,
    showUntagged: filters.untagged,
    sortByType: sort.by as unknown as ElementListInput['sortByType'],
    sortByAsc: sort.asc,
    showArchived: filters.archive,
    numEntries: pageSize,
    offset: (currentPage - 1) * pageSize,
  }
  const {
    isLoading: loadingElements,
    data: dataElements,
    error: elementsError,
    refetch: refetchElements,
  } = trpc.element.list.useQuery(elementListInput)
  const numOfElements = dataElements?.numOfElements || 0
  const elements = (dataElements?.elements ?? []) as ElementListElement[]

  // on change, store new page size in local storage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('elements-page-size', JSON.stringify(pageSize))
    }
  }, [pageSize])

  // reset pagination if elements length changes and current page would be out of bounds
  useEffect(() => {
    if (loadingElements) return

    const maxPage = Math.max(1, Math.ceil(numOfElements / pageSize))
    if (currentPage > maxPage) {
      setCurrentPage(maxPage)
    }
  }, [loadingElements, numOfElements, currentPage, pageSize])

  // reset pagination when filters, sorting or search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [filters, sort, searchString])

  // compute the number of total pagination pages
  const totalPages = Math.max(1, Math.ceil(numOfElements / pageSize))

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

    if (queryCreationMode) {
      setCreationMode(queryCreationMode)
    }
  }, [router, queryCreationMode])

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
    if (queryEditElementId) {
      setModificationModalOpen(true)
    }
  }, [queryEditElementId])

  // if the library should be filtered by activity, reset the filters and re-set them accordingly
  useEffect(() => {
    if (filterByActivity) {
      handleReset()

      if (filterByCourse) {
        toggleCourseIdFilter({
          courseId: filterByCourse,
        })
      }
      toggleActivityIdFilter({
        activityId: filterByActivity,
      })
    }
  }, [filterByCourse, filterByActivity])

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
            activityId={queryElementId}
            editMode={queryEditMode}
            conversionMode={queryConversionMode}
            duplicationMode={queryDuplicationMode}
            selection={
              selectedElements as Record<number, CreationElement | undefined>
            }
            resetSelection={() => setSelectedElements({})}
          />
        </>
      )}

      <div className="flex h-full flex-col gap-4 overflow-y-auto md:flex-row">
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
            refetchElements={async () => {
              await refetchElements()
            }}
          />
        </div>

        <div className="flex w-full flex-1 flex-col overflow-auto">
          <>
            <div className="flex flex-none flex-row content-center items-end justify-between pb-2.5">
              <div className="flex flex-row items-center gap-1.5">
                <ElementListSelectAllCheckbox
                  elements={elements}
                  selectedElements={selectedElements}
                  setSelectedElements={setSelectedElements}
                  creationMode={
                    creationMode as ComponentProps<
                      typeof ElementListSelectAllCheckbox
                    >['creationMode']
                  }
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

            <div className="h-full overflow-y-auto">
              {loadingElements && !dataElements ? (
                <div className="flex h-full items-center justify-center">
                  <Loader />
                </div>
              ) : elementsError && !dataElements ? (
                <UserNotification
                  type="error"
                  message={t('shared.generic.systemError')}
                  className={{ root: 'm-4' }}
                />
              ) : (
                <>
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
                    setSelectedElements={(
                      id: number,
                      data: ElementListElement
                    ) => {
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
                    refetchElements={async () => {
                      await refetchElements()
                    }}
                  />

                  {elements.length > 0 && (
                    <Pagination
                      totalPages={totalPages}
                      currentPage={currentPage}
                      setCurrentPage={setCurrentPage}
                      numOfObjects={numOfElements}
                      pageSize={pageSize}
                      setPageSize={setPageSize}
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
      {modificationModalOpen && queryEditElementId && (
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
          elementId={queryEditElementId}
          mode={ElementEditMode.EDIT}
          refetchElements={async () => {
            await refetchElements()
          }}
        />
      )}
      {batchOperationsOpen && (
        <ElementBatchOperationsModal
          selectedElements={Object.values(selectedElements)}
          onClose={() => setBatchOperationsOpen(false)}
          resetSelectedElements={() => setSelectedElements({})}
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
