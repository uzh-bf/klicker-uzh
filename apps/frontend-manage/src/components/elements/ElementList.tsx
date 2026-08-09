import type { Element as ElementType } from '@klicker-uzh/graphql/dist/ops'
import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React from 'react'
import Element from './Element'

interface ElementListProps {
  filtersActive: boolean
  activityWizardOpen: boolean
  setSelectedElements: (id: number, data: ElementType) => void
  selectedElements: Record<number, ElementType | undefined>
  triggerSuccessToast: () => void
  elements?: ElementType[]
  tagfilter?: string[]
  handleTagClick: (tagId: number) => void
  handleFilterReset: () => void
  refetchElements: () => Promise<void>
}

function ElementList({
  filtersActive,
  activityWizardOpen,
  setSelectedElements,
  selectedElements,
  triggerSuccessToast,
  elements = [],
  tagfilter = [],
  handleTagClick,
  handleFilterReset,
  refetchElements,
}: ElementListProps): React.ReactElement {
  const t = useTranslations()
  // const {
  //   value: hideSurvey,
  //   setValue: setHideSurvey,
  //   hasInitialized,
  // } = useStickyState('hideLecturerSurvey', 'false')

  if (!elements) {
    return <></>
  }

  if (elements.length === 0) {
    return (
      <UserNotification
        type={filtersActive ? 'warning' : undefined}
        className={{ root: 'ml-7 text-sm' }}
      >
        <span className="mr-1">
          {t('manage.questionPool.noElementsWarning')}
        </span>
        {filtersActive && (
          <span>
            {t.rich('manage.questionPool.activeFiltersWarning', {
              reset: (text) => (
                <button
                  type="button"
                  className="cursor-pointer border-0 bg-transparent p-0 font-bold underline"
                  onClick={handleFilterReset}
                >
                  {text}
                </button>
              ),
            })}
          </span>
        )}
      </UserNotification>
    )
  }

  return (
    <div className="space-y-1 md:space-y-2">
      {filtersActive && (
        <UserNotification type="warning" className={{ root: 'ml-6.5' }}>
          {t.rich('manage.questionPool.activeFiltersWarning', {
            reset: (text) => (
              <button
                type="button"
                className="cursor-pointer border-0 bg-transparent p-0 font-bold underline"
                onClick={handleFilterReset}
              >
                {text}
              </button>
            ),
          })}
        </UserNotification>
      )}
      {elements.map((element) => (
        <Element
          key={`question-list-element-${element.id}`}
          element={element}
          disabled={!element.isManager && activityWizardOpen}
          checked={!!selectedElements[element.id]}
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
          onCheck={() => setSelectedElements(element.id, element)}
          triggerSuccessToast={triggerSuccessToast}
          tagfilter={tagfilter}
          refetchElements={refetchElements}
        />
      ))}
      {/* {hasInitialized && hideSurvey === 'false' && (
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
      )} */}
    </div>
  )
}

export default ElementList
