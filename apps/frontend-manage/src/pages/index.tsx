import { useMutation, useQuery } from '@apollo/client'
import {
  Element,
  GetUserQuestionsDocument,
  ToggleIsArchivedDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { useRouter } from 'next/router'
import * as R from 'ramda'
import { Suspense, useEffect, useMemo, useState } from 'react'
import useSortingAndFiltering, {
  SortyByType,
} from '../lib/hooks/useSortingAndFiltering'

import {
  faArchive,
  faInbox,
  faMagnifyingGlass,
  faSort,
  faSortAsc,
  faSortDesc,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
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
import { buildIndex, processItems } from 'src/lib/utils/filters'
import Layout from '../components/Layout'
import QuestionEditModal from '../components/questions/QuestionEditModal'
import QuestionList from '../components/questions/QuestionList'
import TagList from '../components/questions/tags/TagList'
import SessionCreation, {
  WizardMode,
} from '../components/sessions/creation/SessionCreation'
import SuspendedCreationButtons from '../components/sessions/creation/SuspendedCreationButtons'
import SuspendedFirstLoginModal from '../components/user/SuspendedFirstLoginModal'

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
    () => R.pickBy((value) => typeof value !== 'undefined', selectedQuestions),
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

    if (router.query.sessionId && router.query.editMode) {
      setCreationMode(router.query.editMode as any)
    } else if (router.query.sessionId && router.query.duplicationMode) {
      setCreationMode(router.query.duplicationMode as any)
    } else if (router.query.sessionId && router.query.conversionMode) {
      setCreationMode(router.query.conversionMode as any)
    }
  }, [router])

  const index = useMemo(() => {
    if (dataQuestions?.userQuestions) {
      return buildIndex('questions', dataQuestions.userQuestions as Element[], [
        'name',
        'createdAt',
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
          <SessionCreation
            creationMode={creationMode}
            closeWizard={() => {
              router.push('/')
              setCreationMode(() => undefined)
            }}
            sessionId={router.query.sessionId as string}
            editMode={router.query.editMode as string}
            conversionMode={router.query.conversionMode as string}
            duplicationMode={router.query.duplicationMode as string}
            selection={selectedQuestionData}
            resetSelection={() => setSelectedQuestions({})}
          />
        </>
      )}

      <div className="flex flex-col gap-4 overflow-y-auto md:flex-row h-full">
        {dataQuestions && dataQuestions.userQuestions && (
          <div>
            <div className="hidden h-full md:block">
              <TagList
                key={creationMode}
                compact={!!creationMode}
                activeTags={filters.tags}
                activeType={filters.type}
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
        <div className="flex flex-col flex-1 w-full overflow-auto">
          {!dataQuestions || loadingQuestions ? (
            <Loader />
          ) : (
            <>
              <div className="flex flex-row content-center justify-between flex-none">
                <div className="flex flex-row items-center gap-1 pb-3">
                  <div className="flex flex-col text-sm pr-0.5">
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
                            if (!R.isEmpty(selectedQuestionData)) {
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

                      field: 'w-30 pr-3 rounded-md',
                    }}
                  />

                  <div className="flex flex-row gap-1 pr-3">
                    <Button
                      disabled={!sortBy}
                      onClick={() => {
                        handleSortOrderToggle()
                      }}
                      className={{
                        root: 'h-10 shadow-sm rounded-md',
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
                          label: t('manage.general.date'),
                          data: { cy: 'sort-by-question-pool-created' },
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
                            root: 'h-10 ml-1',
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
                            root: 'h-10 ml-1',
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
                    root: 'h-10 font-bold text-white bg-primary-80',
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
                  handleTagClick={(tag: string) => handleTagClick(tag, false)}
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
