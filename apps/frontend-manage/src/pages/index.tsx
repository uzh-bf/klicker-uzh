import { useQuery } from '@apollo/client'
import {
  GetUserQuestionsDocument,
  Question,
} from '@klicker-uzh/graphql/dist/ops'
import { useRouter } from 'next/router'
import * as R from 'ramda'
import { useEffect, useMemo, useState } from 'react'
import useSortingAndFiltering from '../lib/hooks/useSortingAndFiltering'
import { buildIndex, processItems } from '../lib/utils/filters'

import {
  faChalkboardUser,
  faGraduationCap,
  faMagnifyingGlass,
  faSort,
  faSortAsc,
  faSortDesc,
  faUserGroup,
  faUsersLine,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, Checkbox, Select, TextField } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Layout from '../components/Layout'
import QuestionEditModal from '../components/questions/QuestionEditModal'
import QuestionList from '../components/questions/QuestionList'
import TagList from '../components/questions/tags/TagList'
import CreationButton from '../components/sessions/creation/CreationButton'
import SessionCreation from '../components/sessions/creation/SessionCreation'

function Index() {
  const router = useRouter()
  const t = useTranslations()

  const [searchInput, setSearchInput] = useState('')
  const [creationMode, setCreationMode] = useState<
    undefined | 'liveSession' | 'microSession' | 'learningElement' | 'groupTask'
  >(undefined)
  const [isQuestionCreationModalOpen, setIsQuestionCreationModalOpen] =
    useState(false)
  const [sortBy, setSortBy] = useState('')

  const [selectedQuestions, setSelectedQuestions] = useState<
    Record<number, Question | undefined>
  >({})

  const selectedQuestionData: Record<number, Question> = useMemo(
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
    handleSampleSolutionClick,
    handleAnswerFeedbacksClick,
  } = useSortingAndFiltering()

  useEffect((): void => {
    router.prefetch('/sessions/running')
    router.prefetch('/sessions')

    if (router.query.sessionId) {
      setCreationMode(router.query.editMode as any)
    }
  }, [router])

  const index = useMemo(() => {
    if (dataQuestions?.userQuestions) {
      return buildIndex('questions', dataQuestions.userQuestions, [
        'name',
        'createdAt',
      ])
    }
    return null
  }, [dataQuestions])

  const processedQuestions = useMemo(() => {
    if (dataQuestions?.userQuestions) {
      return processItems(dataQuestions?.userQuestions, filters, sort, index)
    }
    return
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
        <div className="grid md:grid-cols-4 gap-1 md:gap-2 mb-4">
          <CreationButton
            icon={faUsersLine}
            text={t('manage.questionPool.createLiveSession')}
            onClick={() => {
              setCreationMode('liveSession')
            }}
            data={{ cy: 'create-live-session' }}
          />
          <CreationButton
            icon={faChalkboardUser}
            text={t('manage.questionPool.createMicroSession')}
            onClick={() => {
              setCreationMode('microSession')
            }}
            data={{ cy: 'create-micro-session' }}
          />
          <CreationButton
            icon={faGraduationCap}
            text={t('manage.questionPool.createLearningElement')}
            onClick={() => {
              setCreationMode('learningElement')
            }}
            data={{ cy: 'create-learning-element' }}
          />
          <CreationButton
            icon={faUserGroup}
            text={t('manage.questionPool.createGroupTask')}
            onClick={() => {
              setCreationMode('groupTask')
            }}
            data={{ cy: 'create-group-task' }}
            disabled
          />
        </div>
      )}
      {creationMode && (
        <div className="flex-none mb-4">
          <SessionCreation
            creationMode={creationMode}
            closeWizard={() => {
              router.push('/')
              setCreationMode(() => undefined)
            }}
            sessionId={router.query.sessionId as string}
            editMode={router.query.editMode as string}
            selection={selectedQuestionData}
            resetSelection={() => setSelectedQuestions({})}
          />
        </div>
      )}

      <div className="flex flex-col md:flex-row flex-1 gap-4 overflow-y-auto">
        {dataQuestions && dataQuestions.userQuestions && (
          <div>
            <div className="hidden md:block">
              <TagList
                key={creationMode}
                compact={!!creationMode}
                activeTags={filters.tags}
                activeType={filters.type}
                sampleSolution={filters.sampleSolution}
                answerFeedbacks={filters.answerFeedbacks}
                handleReset={handleReset}
                handleTagClick={handleTagClick}
                handleSampleSolutionClick={handleSampleSolutionClick}
                handleAnswerFeedbacksClick={handleAnswerFeedbacksClick}
                // handleToggleArchive={onToggleArchive}
                // isArchiveActive={filters.archive}
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
                handleSampleSolutionClick={handleSampleSolutionClick}
                handleAnswerFeedbacksClick={handleAnswerFeedbacksClick}
                // handleToggleArchive={onToggleArchive}
                // isArchiveActive={filters.archive}
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
                <div className="flex flex-row pb-3">
                  <Checkbox
                    checked={
                      Object.values(selectedQuestions).filter((value) => value)
                        .length > 0
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
                    className={{ root: 'mr-1' }}
                  />
                  <TextField
                    placeholder={t('manage.general.searchPlaceholder')}
                    value={searchInput}
                    onChange={(newValue: string) => {
                      setSearchInput(newValue)
                      handleSearch(newValue)
                    }}
                    icon={faMagnifyingGlass}
                    className={{
                      input: 'h-10',
                      field: 'w-30 pr-3 rounded-md',
                    }}
                  />
                  <Button
                    disabled={!sortBy}
                    onClick={() => {
                      handleSortOrderToggle()
                    }}
                    className={{
                      root: 'h-10 mr-1 shadow-sm rounded-md',
                    }}
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
                      { value: 'CREATED', label: t('manage.general.date') },
                      { value: 'TITLE', label: t('manage.general.title') },
                    ]}
                    onChange={(newSortBy: string) => {
                      setSortBy(newSortBy)
                      handleSortByChange(newSortBy)
                    }}
                  />
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
                  setSelectedQuestions={(id: number, data: Question) => {
                    setSelectedQuestions((prev) => {
                      return { ...prev, [id]: prev[id] ? undefined : data }
                    })
                  }}
                  tagfilter={filters.tags}
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
    </Layout>
  )
}

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}.json`))
        .default,
    },
  }
}

export default Index
