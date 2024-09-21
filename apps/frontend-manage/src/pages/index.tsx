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
  Element,
  GetUserQuestionsDocument,
  ToggleIsArchivedDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import {
  Button,
  Checkbox,
  Select,
  TextField,
  Tooltip,
} from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { isEmpty, pickBy } from 'remeda'
import { buildIndex, processItems } from 'src/lib/utils/filters'
import Layout from '../components/Layout'
import QuestionEditModal from '../components/questions/QuestionEditModal'
import QuestionList from '../components/questions/QuestionList'
import TagList from '../components/questions/tags/TagList'
import ElementCreation, {
  WizardMode,
} from '../components/sessions/creation/ElementCreation'
import SuspendedCreationButtons from '../components/sessions/creation/SuspendedCreationButtons'
import SuspendedFirstLoginModal from '../components/user/SuspendedFirstLoginModal'
import useSortingAndFiltering, {
  SortyByType,
} from '../lib/hooks/useSortingAndFiltering'

function Index() {
  const router = useRouter()
  const t = useTranslations()

  const [toggleIsArchived] = useMutation(ToggleIsArchivedDocument)

  const [searchInput, setSearchInput] = useState('')
  const [creationMode, setCreationMode] = useState<undefined | WizardMode>(
    undefined
  )
  const [isQuestionCreationModalOpen, setIsQuestionCreationModalOpen] =
    useState(false)
  const [sortBy, setSortBy] = useState('')

  const [selectedQuestions, setSelectedQuestions] = useState<
    Record<number, Element | undefined>
  >({})

  const selectedQuestionData: Record<number, Element> = useMemo(
    () =>
      pickBy(
        selectedQuestions,
        (value) => typeof value !== 'undefined'
      ) as Record<number, Element>,
    [selectedQuestions]
  )

  const {
    loading: loadingQuestions,
    error: errorQuestions,
    data: dataQuestions,
  } = useQuery(GetUserQuestionsDocument)

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
  } = useSortingAndFiltering()

  useEffect((): void => {
    router.prefetch('/sessions/running')
    router.prefetch('/sessions')

    if (router.query.elementId && router.query.editMode) {
      setCreationMode(router.query.editMode as any)
    } else if (router.query.elementId && router.query.duplicationMode) {
      setCreationMode(router.query.duplicationMode as any)
    } else if (router.query.elementId && router.query.conversionMode) {
      setCreationMode(router.query.conversionMode as any)
    }
  }, [router])

  const index = useMemo(() => {
    if (dataQuestions?.userQuestions) {
      return buildIndex('questions', dataQuestions.userQuestions as Element[], [
        'name',
        'createdAt',
        'updatedAt',
      ])
    }
    return null
  }, [dataQuestions?.userQuestions])

  const processedQuestions = useMemo(() => {
    if (dataQuestions?.userQuestions) {
      const items = processItems(
        dataQuestions?.userQuestions,
        filters,
        sort,
        index
      )
      return items
    }
  }, [dataQuestions?.userQuestions, filters, index, sort])

  const sortIcon = useMemo(() => {
    if (!sortBy) {
      return faSort
    }

    if (sort.asc) {
      return faSortAsc
    }

    return faSortDesc
  }, [sortBy, sort.asc])

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
            elementId={router.query.elementId as string}
            editMode={router.query.editMode as string}
            conversionMode={router.query.conversionMode as string}
            duplicationMode={router.query.duplicationMode as WizardMode}
            selection={selectedQuestionData}
            resetSelection={() => setSelectedQuestions({})}
          />
        </>
      )}

      <div className="flex h-full flex-col gap-4 overflow-y-auto md:flex-row">
        {dataQuestions && dataQuestions.userQuestions && (
          <div>
            <div className="hidden h-full md:block">
              <TagList
                key={creationMode}
                compact={!!creationMode}
                activeTags={filters.tags}
                activeType={filters.type}
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
                activeTags={filters.tags}
                activeType={filters.type}
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
        )}
        <div className="flex w-full flex-1 flex-col overflow-auto">
          {!dataQuestions || loadingQuestions ? (
            <Loader />
          ) : (
            <>
              <div className="flex flex-none flex-row content-center justify-between">
                <div className="flex flex-row items-center gap-1 pb-3">
                  <div className="flex flex-col pr-0.5 text-sm">
                    <Checkbox
                      checked={
                        Object.values(selectedQuestions).filter(
                          (value) => value
                        ).length == processedQuestions?.length
                      }
                      partial={
                        Object.values(selectedQuestions).filter(
                          (value) => value
                        ).length > 0
                      }
                      onCheck={() => {
                        setSelectedQuestions((prev) => {
                          let allQuestions = {}

                          if (processedQuestions) {
                            if (!isEmpty(selectedQuestionData)) {
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
                    />
                    {t('manage.questionPool.numSelected', {
                      count: Object.keys(selectedQuestionData).length,
                      total: processedQuestions?.length,
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
                      input: 'h-10 pl-9',

                      field: 'w-30 rounded-md pr-3',
                    }}
                  />

                  <div className="flex flex-row gap-1 pr-3">
                    <Button
                      disabled={!sortBy}
                      onClick={() => {
                        handleSortOrderToggle()
                      }}
                      className={{
                        root: 'h-10 rounded-md shadow-sm',
                      }}
                      data={{ cy: 'sort-order-question-pool-toggle' }}
                    >
                      <Button.Icon>
                        <FontAwesomeIcon icon={sortIcon} />
                      </Button.Icon>
                    </Button>
                    <Select
                      className={{
                        root: 'min-w-30',
                        trigger: 'h-10',
                      }}
                      placeholder={t('manage.general.sortBy')}
                      items={[
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
                        {
                          value: SortyByType.TITLE,
                          label: t('manage.general.title'),
                          data: { cy: 'sort-by-question-pool-title' },
                        },
                      ]}
                      onChange={(newSortBy: string) => {
                        setSortBy(newSortBy)
                        handleSortByChange(newSortBy as SortyByType)
                      }}
                      data={{ cy: 'sort-by-question-pool' }}
                    />
                  </div>

                  {Object.keys(selectedQuestionData).length > 0 && (
                    <>
                      <Tooltip tooltip={t('manage.questionPool.moveToArchive')}>
                        <Button
                          className={{
                            root: 'ml-1 h-10',
                          }}
                          onClick={async () => {
                            await toggleIsArchived({
                              variables: {
                                questionIds:
                                  Object.keys(selectedQuestionData).map(Number),
                                isArchived: true,
                              },
                            })
                            setSelectedQuestions({})
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
                          className={{
                            root: 'ml-1 h-10',
                          }}
                          onClick={async () => {
                            await toggleIsArchived({
                              variables: {
                                questionIds:
                                  Object.keys(selectedQuestionData).map(Number),
                                isArchived: false,
                              },
                            })
                            setSelectedQuestions({})
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
                  onClick={() =>
                    setIsQuestionCreationModalOpen(!isQuestionCreationModalOpen)
                  }
                  className={{
                    root: 'bg-primary-80 h-10 font-bold text-white',
                  }}
                  data={{ cy: 'create-question' }}
                >
                  {t('manage.questionPool.createQuestionCaps')}
                </Button>
              </div>

              <div className="h-full overflow-y-auto">
                <QuestionList
                  questions={processedQuestions}
                  selectedQuestions={selectedQuestionData}
                  setSelectedQuestions={(id: number, data: Element) => {
                    setSelectedQuestions((prev) => {
                      return { ...prev, [id]: prev[id] ? undefined : data }
                    })
                  }}
                  tagfilter={filters.tags}
                  handleTagClick={(tag: string) =>
                    handleTagClick({
                      tagName: tag,
                      isTypeTag: false,
                      isStatusTag: false,
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
                />
              </div>
            </>
          )}
        </div>
      </div>

      {isQuestionCreationModalOpen && (
        <QuestionEditModal
          handleSetIsOpen={setIsQuestionCreationModalOpen}
          isOpen={isQuestionCreationModalOpen}
          mode={QuestionEditModal.Mode.CREATE}
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
