import { useQuery } from '@apollo/client'
import { faListCheck } from '@fortawesome/free-solid-svg-icons'
import {
  ActivityType,
  Element,
  GetUserElementsDocument,
  SharingType,
  UserProfileDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, toast } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { Suspense, useEffect, useState } from 'react'
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

  const { data: dataUser } = useQuery(UserProfileDocument, {
    fetchPolicy: 'cache-only',
  })
  const user = dataUser?.userProfile

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
      activityId: filters.activityId,
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

  const filtersActive = !!(
    filters.tags.length > 0 ||
    filters.courseId ||
    filters.activityId ||
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

      <div className="flex h-full flex-col gap-4 overflow-y-auto md:flex-row">
        <div>
          <div className="hidden h-full md:block">
            <FilterList
              key={creationMode}
              compact={!!creationMode}
              filtersActive={filtersActive}
              activeTags={filters.tags}
              activeCourseId={filters.courseId}
              activeActivityId={filters.activityId}
              activeType={filters.type}
              activeSharingTypes={filters.sharingType}
              activeStatus={filters.status}
              showUntagged={filters.untagged}
              sampleSolution={filters.sampleSolution}
              answerFeedbacks={filters.answerFeedbacks}
              handleReset={handleReset}
              handleTagClick={handleTagClick}
              toggleCourseIdFilter={toggleCourseIdFilter}
              toggleActivityIdFilter={toggleActivityIdFilter}
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
            <FilterList
              compact
              key={creationMode}
              filtersActive={filtersActive}
              activeTags={filters.tags}
              activeCourseId={filters.courseId}
              activeActivityId={filters.activityId}
              activeType={filters.type}
              activeSharingTypes={filters.sharingType}
              activeStatus={filters.status}
              showUntagged={filters.untagged}
              sampleSolution={filters.sampleSolution}
              answerFeedbacks={filters.answerFeedbacks}
              handleReset={handleReset}
              handleTagClick={handleTagClick}
              toggleCourseIdFilter={toggleCourseIdFilter}
              toggleActivityIdFilter={toggleActivityIdFilter}
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
                {!creationMode &&
                Object.keys(selectedElements).length > 0 &&
                user?.privatePreview ? (
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
          refetchElements={async () => {
            await refetchElements()
          }}
        />
      )}
      {user?.privatePreview && batchOperationsOpen ? (
        <ElementBatchOperationsModal
          selectedElements={Object.values(selectedElements)}
          onClose={() => setBatchOperationsOpen(false)}
          resetSelectedElements={() => setSelectedElements({})}
          refetchElements={async () => {
            await refetchElements()
          }}
        />
      ) : null}
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
