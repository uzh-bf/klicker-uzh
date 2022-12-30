import { useQuery } from '@apollo/client'
import { GetUserQuestionsDocument } from '@klicker-uzh/graphql/dist/ops'
import { useRouter } from 'next/router'
import { useContext, useEffect, useMemo, useState } from 'react'
import useSortingAndFiltering from '../lib/hooks/useSortingAndFiltering'
import { buildIndex, processItems } from '../lib/utils/filters'

import TagList from '@components/questions/TagList'
import SessionCreation from '@components/sessions/creation/SessionCreation'
import { Button, ThemeContext } from '@uzh-bf/design-system'
import { twMerge } from 'tailwind-merge'
import Layout from '../components/Layout'
import QuestionEditModal from '../components/questions/QuestionEditModal'
import QuestionList from '../components/questions/QuestionList'

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
        <SessionCreation
          sessionId={router.query.sessionId as string}
          editMode={router.query.editMode as string}
        />

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
                      className={{
                        root: twMerge(
                          'float-right mb-3 font-bold text-white',
                          theme.primaryBgDark
                        ),
                      }}
                      data={{ cy: 'create-question' }}
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
                      tagfilter={filters.tags}
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
