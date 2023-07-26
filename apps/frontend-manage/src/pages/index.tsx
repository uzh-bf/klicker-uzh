import { useQuery } from '@apollo/client'
import { GetUserQuestionsDocument } from '@klicker-uzh/graphql/dist/ops'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import useSortingAndFiltering from '../lib/hooks/useSortingAndFiltering'

import TagList from '@components/questions/tags/TagList'
import CreationButton from '@components/sessions/creation/CreationButton'
import SessionCreation from '@components/sessions/creation/SessionCreation'
import {
  faBoxArchive,
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
import { Button, Select, TextField, Tooltip } from '@uzh-bf/design-system'
import Layout from '../components/Layout'
import QuestionEditModal from '../components/questions/QuestionEditModal'
import QuestionList from '../components/questions/QuestionList'

function Index() {
  const dropdownItems = [
    { value: 'CREATED', label: 'Datum' },
    { value: 'TITLE', label: 'Titel' },
  ]

  const router = useRouter()

  const [searchInput, setSearchInput] = useState('')
  const [creationMode, setCreationMode] = useState<
    undefined | 'liveSession' | 'microSession' | 'learningElement' | 'groupTask'
  >(undefined)
  const [selectedQuestions, setSelectedQuestions] = useState<
    Record<number, boolean>
  >({})
  const [isQuestionCreationModalOpen, setIsQuestionCreationModalOpen] =
    useState(false)
  const [sortBy, setSortBy] = useState('')
  const [processedQuestions, setProcessedQuestions] = useState([])
  const [selectedQuestionIds, setSelectedQuestionIds] = useState([])

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

  // const index = useMemo(() => {
  //   if (dataQuestions?.userQuestions) {
  //     return buildIndex('questions', dataQuestions.userQuestions, [
  //       'name',
  //       'createdAt',
  //     ])
  //   }
  //   return null
  // }, [dataQuestions?.userQuestions])

  // const processedQuestions = useMemo(() => {
  //   if (dataQuestions?.userQuestions) {
  //     const items = processItems(
  //       dataQuestions?.userQuestions,
  //       filters,
  //       sort,
  //       index
  //     )
  //     setDisplayedQuestions(items)
  //     return items
  //   }
  //   return
  // }, [dataQuestions?.userQuestions, filters, index, sort])

  useEffect(() => {
    const listedQuestions = dataQuestions?.userQuestions
    if (listedQuestions) {
      setProcessedQuestions(listedQuestions)
    }
  }, [dataQuestions])

  const sortIcon = useMemo(() => {
    if (!sortBy) {
      return faSort
    }

    if (sort.asc) {
      return faSortAsc
    }

    return faSortDesc
  }, [sortBy, sort.asc])

  useEffect(() => {
    const ids = []
    for (const [id, selected] of Object.entries(selectedQuestions)) {
      if (!selected) continue
      const parsedId = parseInt(id)
      ids.push(parsedId)
    }
    setSelectedQuestionIds(ids)
  }, [selectedQuestions])

  const moveToArchived = () => {
    const selectedQuestionsContent = processedQuestions.filter((question) =>
      selectedQuestionIds.includes(question.id)
    )
    const nonSelectedQuestionsContent = processedQuestions.filter(
      (question) => !selectedQuestionIds.includes(question.id)
    )
    setProcessedQuestions(nonSelectedQuestionsContent)
    setSelectedQuestionIds([])
    setSelectedQuestions({})
  }

  // const selectedQuestionIds = useMemo(() => {
  //   const ids = []
  //   for (const [id, selected] of Object.entries(selectedQuestions)) {
  //     if (!selected) continue;
  //     const parsedId = parseInt(id);
  //     ids.push(parsedId);
  //   }
  //   return ids;
  // }, [selectedQuestions]);

  // const [isArchiveActive, setIsArchiveActive] = useState(false)
  // // state for archive ids --> update on button click
  // const moveToArchived = () => {
  //   const filteredQuestions = displayedQuestions.filter(question => selectedQuestionIds.includes(question.id));
  //   setArchivedQuestions(filteredQuestions);
  // }
  // // useMemo for filtering
  // const filteredQuestions = useMemo(() => {
  //   if (isArchiveActive) {
  //     return archivedQuestions
  //   } else {
  //     return processedQuestions
  //   }
  // }, [archivedQuestions, isArchiveActive, processedQuestions])

  // const showArchiveView = () => {
  //   setDisplayedQuestions(archivedQuestions)
  //   setIsArchiveActive(true)
  // }
  // const showNormalView = () => {
  //   setDisplayedQuestions(processedQuestions)
  //   setIsArchiveActive(false)
  // }

  return (
    <Layout
      displayName="Fragepool"
      data={{ cy: 'homepage' }}
      className={{ children: 'pb-2' }}
    >
      {typeof creationMode === 'undefined' && (
        <div className="grid gap-1 mb-4 md:grid-cols-4 md:gap-2">
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

      <div className="flex flex-col flex-1 gap-4 overflow-y-auto md:flex-row">
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
                // handleToggleArchive={true}
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
                  {selectedQuestionIds.length > 0 && (
                    <Tooltip tooltip="Archivieren">
                      <Button
                        className={{
                          root: 'h-10 ml-1',
                        }}
                        onClick={() => {
                          moveToArchived()
                        }}
                      >
                        <Button.Icon>
                          <FontAwesomeIcon icon={faBoxArchive} />
                        </Button.Icon>
                      </Button>
                    </Tooltip>
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
