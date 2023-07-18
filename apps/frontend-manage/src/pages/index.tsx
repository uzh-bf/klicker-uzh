import { useQuery } from '@apollo/client'
import { GetUserQuestionsDocument } from '@klicker-uzh/graphql/dist/ops'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import useSortingAndFiltering from '../lib/hooks/useSortingAndFiltering'
import { buildIndex, processItems } from '../lib/utils/filters'

import TagList from '@components/questions/tags/TagList'
import CreationButton from '@components/sessions/creation/CreationButton'
import SessionCreation from '@components/sessions/creation/SessionCreation'
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
import { Button, Select, TextField } from '@uzh-bf/design-system'
import Layout from '../components/Layout'
import QuestionEditModal from '../components/questions/QuestionEditModal'
import QuestionList from '../components/questions/QuestionList'

function Index() {
  const router = useRouter()

  const [searchInput, setSearchInput] = useState('')
  const [creationMode, setCreationMode] = useState<
    undefined | 'liveSession' | 'microSession' | 'learningElement' | 'groupTask'
  >(undefined)
  const [selectedQuestions, setSelectedQuestions] = useState(
    new Array<boolean>()
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

  return (
    <Layout
      displayName="Fragepool"
      data={{ cy: 'homepage' }}
      className={{ children: 'pb-2' }}
    >
      {typeof creationMode === 'undefined' && (
        <div className="grid md:grid-cols-4 gap-1 md:gap-2 mb-4">
          <CreationButton
            icon={faUsersLine}
            text="Live-Session erstellen"
            onClick={() => {
              setCreationMode('liveSession')
            }}
            data={{ cy: 'create-live-session' }}
          />
          <CreationButton
            icon={faChalkboardUser}
            text="Micro-Session erstellen"
            onClick={() => {
              setCreationMode('microSession')
            }}
            data={{ cy: 'create-micro-session' }}
          />
          <CreationButton
            icon={faGraduationCap}
            text="Lernelement erstellen"
            onClick={() => {
              setCreationMode('learningElement')
            }}
            data={{ cy: 'create-learning-element' }}
          />
          <CreationButton
            icon={faUserGroup}
            text="Gruppentask erstellen"
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
                    root: 'h-10 font-bold text-white bg-primary-80',
                  }}
                  data={{ cy: 'create-question' }}
                >
                  FRAGE ERSTELLEN
                </Button>
              </div>

              <div className="h-full overflow-y-auto">
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
