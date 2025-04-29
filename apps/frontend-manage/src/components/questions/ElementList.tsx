import { faBullhorn, faX } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { Element as ElementType } from '@klicker-uzh/graphql/dist/ops'
import useStickyState from '@klicker-uzh/shared-components/src/hooks/useStickyState'
import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import React from 'react'
import Element from './Element'

interface ElementListProps {
  setSelectedQuestions: (id: number, data: ElementType) => void
  selectedQuestions: Record<number, ElementType>
  triggerSuccessToast: () => void
  elements?: ElementType[]
  tagfilter?: string[]
  handleTagClick: (tagName: string) => void
  unsetDeletedQuestion: (questionId: number) => void
}

function ElementList({
  setSelectedQuestions,
  selectedQuestions,
  triggerSuccessToast,
  elements = [],
  tagfilter = [],
  handleTagClick,
  unsetDeletedQuestion,
}: ElementListProps): React.ReactElement {
  const t = useTranslations()
  const { value: hideSurvey, setValue: setHideSurvey } = useStickyState(
    'hideLecturerSurvey',
    'false'
  )

  if (!elements) {
    return <></>
  }

  if (elements.length === 0) {
    return (
      <UserNotification
        type="warning"
        className={{ root: 'ml-7 text-sm' }}
        message={t('manage.questionPool.noQuestionsWarning')}
      />
    )
  }

  return (
    <div className="bg-uzh-blue-400 space-y-1 md:space-y-2">
      {elements.map((element) => (
        <Element
          key={`question-list-element-${element.id}`}
          element={element}
          checked={!!selectedQuestions[element.id]}
          tags={element.tags || []}
          handleTagClick={handleTagClick}
          hasAnswerFeedbacks={
            'options' in element && 'hasAnswerFeedbacks' in element.options
              ? (element.options.hasAnswerFeedbacks ?? false)
              : true
          }
          hasSampleSolution={
            'options' in element
              ? (element.options.hasSampleSolution ?? false)
              : true
          }
          onCheck={() => setSelectedQuestions(element.id, element)}
          triggerSuccessToast={triggerSuccessToast}
          unsetDeletedQuestion={unsetDeletedQuestion}
          tagfilter={tagfilter}
        />
      ))}
      {hideSurvey === 'false' && (
        <div className="fixed bottom-11 w-[calc(100%-17rem)]">
          <div className="flex flex-row items-center justify-between rounded-md bg-orange-200 px-3 py-1.5">
            <div className="flex flex-row items-center gap-3">
              <FontAwesomeIcon icon={faBullhorn} className="h-6" />
              <div>
                {t.rich('manage.support.survey', {
                  link: (text) => (
                    <Link
                      href="https://uzhwwf.qualtrics.com/jfe/form/SV_a3mYp4IsylQIaay"
                      className="text-primary-80 underline"
                      target="_blank"
                    >
                      {text}
                    </Link>
                  ),
                })}
              </div>
            </div>
            <FontAwesomeIcon
              icon={faX}
              onClick={() => setHideSurvey('true')}
              className="text-gray-400 hover:cursor-pointer hover:text-black"
              data-cy="close-survey-notification"
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default ElementList
