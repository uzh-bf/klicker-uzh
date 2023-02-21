import { useQuery } from '@apollo/client'
import { GetUserQuestionsDocument } from '@klicker-uzh/graphql/dist/ops'
import { useRouter } from 'next/router'
import { useContext, useEffect, useMemo, useState } from 'react'
import useSortingAndFiltering from '../lib/hooks/useSortingAndFiltering'
import { buildIndex, processItems } from '../lib/utils/filters'

import {
  faMagnifyingGlass,
  faSort,
  faSortAsc,
  faSortDesc,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button, Select, TextField, ThemeContext } from '@uzh-bf/design-system'
import { twMerge } from 'tailwind-merge'
import Layout from '../components/Layout'
import QuestionEditModal from '../components/questions/QuestionEditModal'
import QuestionList from '../components/questions/QuestionList'
import TagList from '../components/questions/tags/TagList'
import SessionCreation from '../components/sessions/creation/SessionCreation'

function Index() {
  const router = useRouter()
  const [selectedQuestions, setSelectedQuestions] = useState(
    new Array<boolean>()
  )
  const theme = useContext(ThemeContext)

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
  })

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

  const [isQuestionCreationModalOpen, setIsQuestionCreationModalOpen] =
    useState(false)

  const dropdownItems = [
    { value: 'CREATED', label: 'Datum' },
    { value: 'TITLE', label: 'Titel' },
  ]

  const [sortBy, setSortBy] = useState('')

  const sortIcon = useMemo(() => {
    if (!sortBy) {
      return faSort
    }

    if (sort.asc) {
      return faSortAsc
    }

    return faSortDesc
  }, [sortBy, sort.asc])

  const [searchInput, setSearchInput] = useState('')
  return (
    <Layout displayName="Fragepool" scrollable={false}>
      <div className="flex flex-col gap-6" id="homepage">
        <div className="flex-none">
          <SessionCreation
            sessionId={router.query.sessionId as string}
            editMode={router.query.editMode as string}
          />
        </div>

        <div className="flex flex-col flex-1 gap-5 md:flex-row">
          <div className="flex-none">
            {dataQuestions && dataQuestions.userQuestions && (
              <TagList
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
            )}
          </div>
          <div className="flex-1">
            {!dataQuestions || loadingQuestions ? (
              // TODO: replace by nice loader
              <div>Loading...</div>
            ) : (
              <div>
                {/* // TODO: add action area
                   <ActionSearchArea
                    withSorting
                    deletionConfirmation={deletionConfirmation}
                    handleArchiveQuestions={onArchiveQuestions}
                    handleDeleteQuestions={onDeleteQuestions}
                    handleQuickBlock={onQuickBlock}
                    handleQuickBlocks={onQuickBlocks}
                    handleQuickStart={handleQuickStart}
                    handleResetItemsChecked={handleResetSelection}
                    handleSearch={_debounce(handleSearch, 200)}
                    handleSetItemsChecked={handleSelectItems}
                    handleSortByChange={handleSortByChange}
                    handleSortOrderToggle={handleSortOrderToggle}
                    isArchiveActive={filters.archive}
                    itemsChecked={selectedItems.ids}
                    key="action-area"
                    questions={processedQuestions}
                    runningSessionId={runningSessionId}
                    sessionBlocks={sessionBlocks}
                    setSessionBlocks={setSessionBlocks}
                    sortBy={sort.by}
                    sortOrder={sort.asc}
                    sortingTypes={QUESTION_SORTINGS}
                  /> */}

                <div className="flex flex-row content-center justify-between flex-none pl-8">
                  <div className="relative flex flex-row pb-6">
                    <TextField
                      placeholder="Suchen.."
                      value={searchInput}
                      onChange={(newValue: string) => {
                        setSearchInput(newValue)
                        handleSearch(newValue)
                      }}
                      icon={faMagnifyingGlass}
                      className={{
                        input: 'h-10',
                        field: 'w-30 pr-3',
                      }}
                    />
                    <Button
                      disabled={!sortBy}
                      onClick={() => {
                        handleSortOrderToggle()
                      }}
                      className={{
                        root: 'h-10 mr-1',
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
                      placeholder="Sortieren nach.."
                      items={dropdownItems}
                      onChange={(newSortBy: string) => {
                        setSortBy(newSortBy)
                        handleSortByChange(newSortBy)
                      }}
                    />
                  </div>
                  <Button
                    onClick={() =>
                      setIsQuestionCreationModalOpen(
                        !isQuestionCreationModalOpen
                      )
                    }
                    className={{
                      root: twMerge(
                        'h-10 font-bold text-white',
                        theme.primaryBgDark
                      ),
                    }}
                    data={{ cy: 'create-question' }}
                  >
                    FRAGE ERSTELLEN
                  </Button>
                </div>
                {isQuestionCreationModalOpen && (
                  <QuestionEditModal
                    handleSetIsOpen={setIsQuestionCreationModalOpen}
                    isOpen={isQuestionCreationModalOpen}
                    mode="CREATE"
                  />
                )}
                <div className="overflow-y-auto [height:_calc(100vh-500px)]">
                  <QuestionList
                    questions={processedQuestions}
                    selectedQuestions={selectedQuestions}
                    setSelectedQuestions={(index: number) => {
                      const tempQuestions = [...selectedQuestions]
                      tempQuestions[index] = !tempQuestions[index]
                      setSelectedQuestions(tempQuestions)
                    }}
                    tagfilter={filters.tags}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}

export function getStaticProps({ locale }: any) {
  return {
    props: {
      messages: {
        ...require(`shared-components/src/intl-messages/${locale}.json`),
      },
    },
  }
}

export default Index
