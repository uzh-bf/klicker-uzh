import { useQuery } from '@apollo/client'
import {
  Course,
  GetUserCoursesDocument,
  GetUserQuestionsDocument,
} from '@klicker-uzh/graphql/dist/ops'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import useSortingAndFiltering from '../lib/hooks/useSortingAndFiltering'
import { buildIndex, processItems } from '../lib/utils/filters'

import TagList from '@components/questions/TagList'
import { Button, H4 } from '@uzh-bf/design-system'
import Layout from '../components/Layout'
import QuestionEditModal from '../components/questions/QuestionEditModal'
import QuestionList from '../components/questions/QuestionList'
import LearningElementCreationForm from '../components/sessions/creation/LearningElementCreationForm'
import LiveSessionCreationForm from '../components/sessions/creation/LiveSessionCreationForm'
import MicroSessionCreationForm from '../components/sessions/creation/MicroSessionCreationForm'

function Index() {
  // TODO: add toasts
  // const { addToast } = useToasts()

  const router = useRouter()
  const [selectedQuestions, setSelectedQuestions] = useState(
    new Array<boolean>()
  )

  const {
    loading: loadingQuestions,
    error: errorQuestions,
    data: dataQuestions,
  } = useQuery(GetUserQuestionsDocument)

  const {
    loading: loadingCourses,
    error: errorCourses,
    data: dataCourses,
  } = useQuery(GetUserCoursesDocument)

  const courseSelection = useMemo(
    () =>
      dataCourses?.userCourses?.map((course: Course) => ({
        label: course.displayName,
        value: course.id,
      })),
    [dataCourses]
  )

  const {
    filters,
    sort,
    handleSearch,
    handleSortByChange,
    handleSortOrderToggle,
    handleTagClick,
    handleReset,
    handleToggleArchive,
  } = useSortingAndFiltering()

  useEffect((): void => {
    router.prefetch('/sessions/running')
    router.prefetch('/sessions')
  })

  const index = useMemo(() => {
    if (dataQuestions?.userQuestions) {
      return buildIndex('questions', dataQuestions.userQuestions, [
        'title',
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

  return (
    <Layout displayName="Fragepool">
      <div className="w-full h-full" id="homepage">
        <div className="flex justify-center mx-5 sm:mx-10 md:mx-20 print-hidden">
          <div className="max-w-[100rem] h-full w-full mt-6 gap-5 border border-solid border-uzh-grey-60 rounded-md">
            {/* // TODO: replace by proper session creation component */}
            <TabsPrimitive.Root defaultValue="live-session">
              <TabsPrimitive.List className="flex flex-row justify-between w-full h-8 border-b border-solid border-uzh-grey-60">
                <TabsPrimitive.Trigger
                  value="live-session"
                  className="flex-1 hover:bg-uzh-blue-20"
                >
                  <H4 className="flex flex-col justify-center h-full">
                    Live-Session
                  </H4>
                </TabsPrimitive.Trigger>
                <div className="border-r-2 border-solid border-uzh-grey-60" />
                <TabsPrimitive.Trigger
                  value="micro-session"
                  className="flex-1 hover:bg-uzh-blue-20 disabled:text-uzh-grey-80 disabled:hover:bg-white disabled:cursor-not-allowed"
                  disabled
                >
                  <H4 className="flex flex-col justify-center h-full">
                    Micro-Session
                  </H4>
                </TabsPrimitive.Trigger>
                <div className="border-r-2 border-solid border-uzh-grey-60" />
                <TabsPrimitive.Trigger
                  value="learning-element"
                  className="flex-1 hover:bg-uzh-blue-20 disabled:text-uzh-grey-80 disabled:hover:bg-white disabled:cursor-not-allowed"
                  disabled
                >
                  <H4 className="flex flex-col justify-center h-full">
                    Learning Element
                  </H4>
                </TabsPrimitive.Trigger>
              </TabsPrimitive.List>
              <div className="p-3">
                <TabsPrimitive.Content
                  value="live-session"
                  className="overflow-y-scroll md:h-72"
                >
                  <LiveSessionCreationForm courses={courseSelection} />
                </TabsPrimitive.Content>
                <TabsPrimitive.Content
                  value="micro-session"
                  className="overflow-y-scroll md:h-64"
                >
                  <MicroSessionCreationForm />
                </TabsPrimitive.Content>
                <TabsPrimitive.Content
                  value="learning-element"
                  className="overflow-y-scroll md:h-64"
                >
                  <LearningElementCreationForm />
                </TabsPrimitive.Content>
              </div>
            </TabsPrimitive.Root>
            {/* {editSessionId ? (
              <SessionEditForm
                handleCreateSession={onCreateSession}
                handleSetIsAuthenticationEnabled={setIsAuthenticationEnabled}
                handleSetSessionAuthenticationMode={
                  setSessionAuthenticationMode
                }
                handleSetSessionBlocks={setSessionBlocks}
                handleSetSessionName={setSessionName}
                handleSetSessionParticipants={setSessionParticipants}
                isAuthenticationEnabled={isAuthenticationEnabled}
                runningSessionId={runningSessionId}
                sessionAuthenticationMode={sessionAuthenticationMode}
                sessionBlocks={sessionBlocks}
                sessionName={sessionName}
                sessionParticipants={sessionParticipants}
                setSessionName={setSessionName}
              />
            ) : (
              <SessionCreationForm
                handleCreateSession={onCreateSession}
                handleSetIsAuthenticationEnabled={setIsAuthenticationEnabled}
                handleSetSessionAuthenticationMode={
                  setSessionAuthenticationMode
                }
                handleSetSessionBlocks={setSessionBlocks}
                handleSetSessionName={setSessionName}
                handleSetSessionParticipants={setSessionParticipants}
                isAuthenticationEnabled={isAuthenticationEnabled}
                runningSessionId={runningSessionId}
                sessionAuthenticationMode={sessionAuthenticationMode}
                sessionBlocks={sessionBlocks}
                sessionName={sessionName}
                sessionParticipants={sessionParticipants}
                setSessionName={setSessionName}
              />
            )} */}
          </div>
        </div>
        <div className="flex justify-center mx-5 sm:mx-10 md:mx-20">
          <div className="flex flex-col md:flex-row max-w-[100rem] w-full mt-6 gap-5 ">
            {dataQuestions && dataQuestions.userQuestions && (
              <TagList
                activeTags={filters.tags}
                activeType={filters.type}
                handleReset={handleReset}
                handleTagClick={handleTagClick}
                // handleToggleArchive={onToggleArchive}
                // isArchiveActive={filters.archive}
              />
            )}
            <div className="w-full">
              {!dataQuestions || loadingQuestions ? (
                // TODO: replace by nice loader
                <div>Loading...</div>
              ) : (
                <div className="flex flex-col w-full">
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

                  <div
                    className="w-full h-full mt-4 md:overflow-y-auto md:mx-auto"
                    key="question-list"
                  >
                    <Button
                      onClick={() =>
                        setIsQuestionCreationModalOpen(
                          !isQuestionCreationModalOpen
                        )
                      }
                      className="float-right mb-3 font-bold text-white bg-uzh-blue-80"
                    >
                      FRAGE ERSTELLEN
                    </Button>
                    {isQuestionCreationModalOpen && (
                      <QuestionEditModal
                        handleSetIsOpen={setIsQuestionCreationModalOpen}
                        isOpen={isQuestionCreationModalOpen}
                        mode="CREATE"
                      />
                    )}
                    <QuestionList
                      questions={processedQuestions}
                      selectedQuestions={selectedQuestions}
                      setSelectedQuestions={(index: number) => {
                        const tempQuestions = [...selectedQuestions]
                        tempQuestions[index] = !tempQuestions[index]
                        setSelectedQuestions(tempQuestions)
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default Index
