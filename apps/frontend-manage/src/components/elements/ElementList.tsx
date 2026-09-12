import type { Element as ElementType } from '@klicker-uzh/graphql/dist/ops'
import { Button, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import type React from 'react'
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
  hasActiveSearch: boolean
  onClearSearch: () => void
  onCreateElement: () => void
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
  hasActiveSearch,
  onClearSearch,
  onCreateElement,
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
    if (!filtersActive && !hasActiveSearch) {
      return (
        <section
          data-cy="elements-empty-state"
          className="mx-7 mt-6 flex max-w-xl flex-col items-start gap-3 rounded-md border border-dashed border-slate-300 bg-slate-50 p-6"
        >
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-800">
              {t('manage.questionPool.emptyStateTitle')}
            </h2>
            <p className="text-sm text-slate-600">
              {t('manage.questionPool.emptyStateDescription')}
            </p>
          </div>
          <Button
            primary
            onClick={onCreateElement}
            data={{ cy: 'elements-empty-create' }}
          >
            <Button.Label>
              {t('manage.questionPool.createElement')}
            </Button.Label>
          </Button>
        </section>
      )
    }

    return (
      <UserNotification type="warning" className={{ root: 'ml-7 text-sm' }}>
        <div data-cy="elements-no-results" className="text-slate-800">
          <p>{t('manage.questionPool.noElementsWarning')}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
            {hasActiveSearch && (
              <button
                type="button"
                onClick={onClearSearch}
                data-cy="elements-clear-search"
                className="cursor-pointer font-bold underline"
              >
                {t('manage.questionPool.clearSearch')}
              </button>
            )}
            {filtersActive && (
              <button
                type="button"
                onClick={handleFilterReset}
                data-cy="elements-reset-filters"
                className="cursor-pointer font-bold underline"
              >
                {t('manage.questionPool.resetFilters')}
              </button>
            )}
          </div>
        </div>
      </UserNotification>
    )
  }

  return (
    <div
      className={activityWizardOpen ? 'space-y-1' : 'space-y-1 md:space-y-2'}
    >
      {filtersActive && (
        <UserNotification type="warning" className={{ root: 'ml-6.5' }}>
          {t.rich('manage.questionPool.activeFiltersWarning', {
            reset: (text) => (
              <span
                className="cursor-pointer font-bold underline"
                onClick={handleFilterReset}
              >
                {text}
              </span>
            ),
          })}
        </UserNotification>
      )}
      {elements.map((element) => (
        <Element
          key={`question-list-element-${element.id}`}
          element={element}
          disabled={!element.isManager && activityWizardOpen}
          compact={activityWizardOpen}
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
