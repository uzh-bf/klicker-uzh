import { useMutation, useQuery } from '@apollo/client'
import {
  faArchive,
  faInbox,
  faMagnifyingGlass,
  faSort,
  faSortAsc,
  faSortDesc,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ActivityType,
  Element,
  GetUserElementsDocument,
  ToggleIsArchivedDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import {
  Button,
  Checkbox,
  Select,
  TextField,
  toast,
  Tooltip,
} from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { isEmpty, pickBy } from 'remeda'
import { buildIndex, processItems } from 'src/lib/utils/filters'
import SuspendedCreationButtons from '../components/activities/creation/SuspendedCreationButtons'
import ElementCreation from '../components/activities/ElementCreation'
import Layout from '../components/Layout'
import ElementList from '../components/questions/ElementList'
import ElementEditModal, {
  ElementEditMode,
} from '../components/questions/manipulation/ElementEditModal'
import RecoveryPrompt from '../components/questions/manipulation/RecoveryPrompt'
import TagList from '../components/questions/tags/TagList'
import SuspendedFirstLoginModal from '../components/user/SuspendedFirstLoginModal'
import useSortingAndFiltering, {
  SORTING_FILTERING_INITIAL,
  SortyByType,
} from '../lib/hooks/useSortingAndFiltering'

function Index() {
  const router = useRouter()
  const t = useTranslations()

  const [toggleIsArchived, { loading: toggelingArchive }] = useMutation(
    ToggleIsArchivedDocument
  )

  const [searchInput, setSearchInput] = useState('')
  const [showRecoveryPrompt, setShowRecoveryPrompt] = useState(false)
  const [creationMode, setCreationMode] = useState<undefined | ActivityType>(
    undefined
  )
  const [isQuestionCreationModalOpen, setIsQuestionCreationModalOpen] =
    useState(false)

  const [selectedQuestions, setSelectedQuestions] = useState<
    Record<number, Element | undefined>
  >({})

  const selectedElementContent = useMemo(
    () =>
      pickBy(
        selectedQuestions,
        (value) => typeof value !== 'undefined'
      ) as Record<number, Element>,
    [selectedQuestions]
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
    handleSearch,
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
      showArchived: filters.archive,
      tagIds: filters.tags.map((tag) => parseInt(tag, 10)),
    },
    fetchPolicy: 'network-only',
  })

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

  // once the activity wizard is opened, deselect all invalid questions
  useEffect(() => {
    setSelectedQuestions((selection) => {
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

  const index = useMemo(() => {
    if (dataElements?.userElements) {
      const dataQuestionsFlatTags = dataElements.userElements.map(
        (question) => ({
          ...question,
          tagsString: (question.tags ?? []).map((tag) => tag.name).join(' '),
        })
      )
      return buildIndex('questions', dataQuestionsFlatTags, [
        'name',
        'content',
        'createdAt',
        'updatedAt',
        'tagsString',
      ])
    }
    return null
  }, [dataElements?.userElements])

  const processedQuestions = useMemo(() => {
    if (dataElements?.userElements) {
      const items = processItems(
        dataElements?.userElements,
        filters,
        sort,
        index
      )
      return items
    }
  }, [dataElements?.userElements, filters, index, sort])

  const filtersActive = useMemo(
    () =>
      !!(
        filters.tags.length > 0 ||
        filters.type ||
        filters.status ||
        filters.sharingType?.length !== 3 ||
        filters.sampleSolution ||
        filters.answerFeedbacks ||
        filters.untagged
      ),
    [
      filters.tags,
      filters.type,
      filters.status,
      filters.sharingType,
      filters.sampleSolution,
      filters.answerFeedbacks,
      filters.untagged,
    ]
  )

  const sortIcon = useMemo(() => {
    if (!sort.by) {
      return faSort
    }

    if (sort.asc) {
      return faSortAsc
    }

    return faSortDesc
  }, [sort.by, sort.asc])

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
            resetSelection={() => setSelectedQuestions({})}
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
                      processedQuestions?.length !== 0 &&
                      Object.values(selectedQuestions).filter((value) => value)
                        .length == processedQuestions?.length
                    }
                    partial={
                      Object.values(selectedQuestions).filter((value) => value)
                        .length > 0
                    }
                    onCheck={() => {
                      setSelectedQuestions((prev) => {
                        let allQuestions = {}

                        if (processedQuestions) {
                          if (!isEmpty(selectedElementContent)) {
                            // set questions after filtering to undefined
                            // do not uncheck questions that are selected but not in the filtered set
                            allQuestions = processedQuestions.reduce(
                              (acc, curr) => ({
                                ...acc,
                                [curr.id]: undefined,
                              }),
                              {}
                            )
                          } else {
                            // set all questions after filtering to their id and data
                            allQuestions = processedQuestions.reduce(
                              (acc, question) => ({
                                ...acc,
                                [question.id]: question,
                              }),
                              {}
                            )
                          }
                        }

                        return { ...prev, ...allQuestions }
                      })
                    }}
                    className={{ root: 'border-unset' }}
                  />
                  {t('manage.questionPool.numSelected', {
                    count: Object.keys(selectedElementContent).length,
                    total: processedQuestions?.length ?? 0,
                  })}
                </div>

                <TextField
                  placeholder={t('manage.general.searchPlaceholder')}
                  value={searchInput}
                  onChange={(newValue: string) => {
                    setSearchInput(newValue)
                    handleSearch(newValue)
                  }}
                  icon={faMagnifyingGlass}
                  className={{
                    input: 'h-10 pl-8',
                    field: 'min-w-30 rounded-md pr-3',
                  }}
                />

                <div className="flex flex-row gap-1 pr-3">
                  <Button
                    disabled={!sort.by}
                    onClick={() => {
                      handleSortOrderToggle()
                    }}
                    className={{ root: 'h-10 rounded-md' }}
                    data={{ cy: 'sort-order-question-pool-toggle' }}
                  >
                    <Button.Icon icon={sortIcon} withoutLabel />
                  </Button>
                  <Select
                    value={sort.by}
                    onChange={(newSortBy) =>
                      handleSortByChange(newSortBy as SortyByType)
                    }
                    placeholder={t('manage.general.sortBy')}
                    contentPosition="popper"
                    items={[
                      {
                        value: SortyByType.TITLE,
                        label: t('manage.general.title'),
                        data: { cy: 'sort-by-question-pool-title' },
                      },
                      {
                        value: SortyByType.TYPE,
                        label: t('manage.general.elementType'),
                        data: { cy: 'sort-by-question-pool-type' },
                      },
                      {
                        value: SortyByType.CREATED,
                        label: t('manage.general.dateCreated'),
                        data: { cy: 'sort-by-question-pool-created' },
                      },
                      {
                        value: SortyByType.MODIFIED,
                        label: t('manage.general.dateModified'),
                        data: { cy: 'sort-by-question-pool-modified' },
                      },
                    ]}
                    className={{ root: 'min-w-30', trigger: 'h-10' }}
                    data={{ cy: 'sort-by-question-pool' }}
                  />
                </div>

                {Object.keys(selectedElementContent).length > 0 && (
                  <>
                    <Tooltip tooltip={t('manage.questionPool.moveToArchive')}>
                      <Button
                        disabled={toggelingArchive}
                        className={{ root: 'ml-1 h-10' }}
                        onClick={async () => {
                          const { data } = await toggleIsArchived({
                            variables: {
                              elementIds: Object.keys(
                                selectedElementContent
                              ).map(Number),
                              isArchived: true,
                            },
                            update: (cache, { data }) => {
                              // if the request was not successful, do nothing
                              if (
                                !data?.toggleIsArchived ||
                                data.toggleIsArchived.failure
                              )
                                return

                              // check if request was successful
                              const update = data?.toggleIsArchived
                              if (!update) return

                              // extract the ids of all elements that should now be marked as archived
                              const updatedElementIds =
                                update.elements?.map((element) => element.id) ??
                                []

                              // fetch the previously returned value for the elements list
                              const elements = cache.readQuery({
                                query: GetUserElementsDocument,
                              })

                              if (elements?.userElements) {
                                cache.writeQuery({
                                  query: GetUserElementsDocument,
                                  data: {
                                    userElements: elements.userElements.map(
                                      (obj) =>
                                        updatedElementIds.includes(obj.id)
                                          ? {
                                              ...obj,
                                              isArchived: true,
                                            }
                                          : obj
                                    ),
                                  },
                                })
                              }
                            },
                          })

                          if (data?.toggleIsArchived?.success) {
                            toast({
                              type: 'success',
                              message: t(
                                'manage.questionPool.archivingSuccess'
                              ),
                              options: { duration: 3000 },
                            })
                            setSelectedQuestions({})
                          } else if (data?.toggleIsArchived?.partialSuccess) {
                            toast({
                              type: 'warning',
                              message: t(
                                'manage.questionPool.archivingPartialSuccess'
                              ),
                              options: { duration: 8000 },
                            })
                            setSelectedQuestions({})
                          } else if (data?.toggleIsArchived?.failure) {
                            toast({
                              type: 'error',
                              message: t('manage.questionPool.archivingFailed'),
                              options: { duration: 8000 },
                            })
                          }
                        }}
                        data={{ cy: 'move-to-archive' }}
                      >
                        <FontAwesomeIcon icon={faArchive} />
                      </Button>
                    </Tooltip>
                    <Tooltip
                      tooltip={t('manage.questionPool.restoreFromArchive')}
                    >
                      <Button
                        disabled={toggelingArchive}
                        className={{ root: 'ml-1 h-10' }}
                        onClick={async () => {
                          const { data } = await toggleIsArchived({
                            variables: {
                              elementIds: Object.keys(
                                selectedElementContent
                              ).map(Number),
                              isArchived: false,
                            },
                            update: (cache, { data }) => {
                              // if the request was not successful, do nothing
                              if (
                                !data?.toggleIsArchived ||
                                data.toggleIsArchived.failure
                              )
                                return

                              // check if request was successful
                              const updatedElements = data?.toggleIsArchived
                              if (!updatedElements) return

                              // extract the ids of all elements that should now be marked as archived
                              const updatedElementIds =
                                updatedElements.elements?.map(
                                  (element) => element.id
                                ) ?? []

                              // fetch the previously returned value for the elements list
                              const elements = cache.readQuery({
                                query: GetUserElementsDocument,
                              })

                              if (elements?.userElements) {
                                cache.writeQuery({
                                  query: GetUserElementsDocument,
                                  data: {
                                    userElements: elements.userElements.map(
                                      (obj) =>
                                        updatedElementIds.includes(obj.id)
                                          ? {
                                              ...obj,
                                              isArchived: false,
                                            }
                                          : obj
                                    ),
                                  },
                                })
                              }
                            },
                          })

                          if (data?.toggleIsArchived?.success) {
                            toast({
                              type: 'success',
                              message: t(
                                'manage.questionPool.restoreFromArchiveSuccess'
                              ),
                              options: { duration: 8000 },
                            })
                            setSelectedQuestions({})
                          } else if (data?.toggleIsArchived?.partialSuccess) {
                            toast({
                              type: 'warning',
                              message: t(
                                'manage.questionPool.restoreFromArchivePartialSuccess'
                              ),
                              options: { duration: 8000 },
                            })
                            setSelectedQuestions({})
                          } else if (data?.toggleIsArchived?.failure) {
                            toast({
                              type: 'error',
                              message: t(
                                'manage.questionPool.restoreFromArchiveFailed'
                              ),
                              options: { duration: 8000 },
                            })
                          }
                        }}
                        data={{ cy: 'restore-from-archive' }}
                      >
                        <FontAwesomeIcon icon={faInbox} />
                      </Button>
                    </Tooltip>
                  </>
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
                    setIsQuestionCreationModalOpen(true)
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
                <ElementList
                  filtersActive={filtersActive}
                  activityWizardOpen={!!creationMode}
                  elements={processedQuestions}
                  selectedQuestions={selectedElementContent}
                  triggerSuccessToast={() =>
                    toast({
                      type: 'success',
                      message: t('manage.elements.questionSavedSuccessfully'),
                      options: { duration: 4000 },
                    })
                  }
                  setSelectedQuestions={(id: number, data: Element) => {
                    setSelectedQuestions((prev) => {
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
                    setSelectedQuestions((prev) => {
                      if (prev[questionId]) {
                        const newSelectedQuestions = { ...prev }
                        delete newSelectedQuestions[questionId]
                        return newSelectedQuestions
                      }
                      return prev
                    })
                  }}
                  handleFilterReset={handleReset}
                />
              )}
            </div>
          </>
        </div>
      </div>

      {isQuestionCreationModalOpen && (
        <ElementEditModal
          handleSetIsOpen={setIsQuestionCreationModalOpen}
          triggerSuccessToast={() =>
            toast({
              type: 'success',
              message: t('manage.elements.questionSavedSuccessfully'),
              options: { duration: 4000 },
            })
          }
          isOpen={isQuestionCreationModalOpen}
          mode={ElementEditMode.CREATE}
        />
      )}
      {showRecoveryPrompt && (
        <RecoveryPrompt
          onRecovery={() => {
            setShowRecoveryPrompt(false)
            setIsQuestionCreationModalOpen(true)
          }}
          onDiscard={() => {
            localStorage.removeItem('autosave-element-creation')
            setShowRecoveryPrompt(false)
            setIsQuestionCreationModalOpen(true)
          }}
        />
      )}
      <Suspense fallback={<div />}>
        <SuspendedFirstLoginModal />
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
