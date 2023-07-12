import { useQuery } from '@apollo/client'
import { GetUserQuestionsDocument } from '@klicker-uzh/graphql/dist/ops'
import { useRouter } from 'next/router'
import { useContext, useEffect, useMemo, useState } from 'react'
import useSortingAndFiltering from '../lib/hooks/useSortingAndFiltering'
import { buildIndex, processItems } from '../lib/utils/filters'

import TagList from '@components/questions/tags/TagList'
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
import SessionCreation from '../components/sessions/creation/SessionCreation'

function Index() {
  const router = useRouter()
  const theme = useContext(ThemeContext)

  const [searchInput, setSearchInput] = useState('')
  const [selectedQuestions, setSelectedQuestions] = useState<
    Record<number, boolean>
  >({})
  console.log(selectedQuestions)

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

  const selectedQuestionIds = useMemo(() => {
    return Object.entries(selectedQuestions).flatMap(([id, selected]) => {
      if (!selected) return []
      return [id]
    })
  }, [selectedQuestions])

  return (
    <Layout
      displayName="Fragepool"
      data={{ cy: 'homepage' }}
      className={{ children: 'pb-2' }}
    >
      <div className="flex-none mb-4">
        <SessionCreation
          sessionId={router.query.sessionId as string}
          editMode={router.query.editMode as string}
        />
      </div>

      <div className="flex flex-row flex-1 gap-4 overflow-y-auto">
        <div>
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
        <div className="flex flex-col flex-1 w-full overflow-auto">
          {!dataQuestions || loadingQuestions ? (
            // TODO: replace by nice loader
            <div>Loading...</div>
          ) : (
            <>
              <div className="flex flex-row content-center justify-between flex-none pl-7">
                <div className="flex flex-row pb-3">
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
                    setIsQuestionCreationModalOpen(!isQuestionCreationModalOpen)
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

              <div className="h-full overflow-y-auto">
                {selectedQuestionIds.length} items selected
                <QuestionList
                  questions={processedQuestions}
                  selectedQuestions={selectedQuestions}
                  setSelectedQuestions={(questionId: number) => {
                    setSelectedQuestions((prevState) => ({
                      ...prevState,
                      [questionId]: !prevState[questionId],
                    }))
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
