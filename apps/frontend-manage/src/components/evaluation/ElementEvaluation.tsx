import { faClock } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ElementInstanceEvaluation,
  ElementType,
  LocaleType,
} from '@klicker-uzh/graphql/dist/ops'
import { ChartType } from '@klicker-uzh/shared-components/src/constants'
import { useSessionStorage } from '@uidotdev/usehooks'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { twMerge } from 'tailwind-merge'
import { ActivityEvaluationType } from './ActivityEvaluation'
import CSEvaluation from './elements/CSEvaluation'
import CTEvaluation from './elements/CTEvaluation'
import ChoicesEvaluation from './elements/ChoicesEvaluation'
import FCEvaluation from './elements/FCEvaluation'
import FTEvaluation from './elements/FTEvaluation'
import NREvaluation from './elements/NREvaluation'
import QuestionCollapsible from './elements/QuestionCollapsible'
import SEEvaluation from './elements/SEEvaluation'
import { TextSizeType } from './textSizes'

interface ElementEvaluationProps {
  currentInstance: ElementInstanceEvaluation
  activeInstance: number
  activeStack: number
  courseLanguage?: LocaleType | null
  textSize: TextSizeType
  chartType: ChartType
  showSolution: boolean
  showExplanation: boolean
  type: ActivityEvaluationType
  requireShowResultsConfirmation: boolean
  className?: string
}

function ElementEvaluation({
  currentInstance,
  activeInstance,
  activeStack,
  courseLanguage,
  textSize,
  chartType,
  showSolution,
  showExplanation,
  type,
  requireShowResultsConfirmation,
  className,
}: ElementEvaluationProps) {
  const t = useTranslations()
  const hasSolution = currentInstance.hasSampleSolution ?? false
  const hasExplanation =
    (!!currentInstance?.explanation &&
      currentInstance?.explanation !== '' &&
      !currentInstance?.explanation.match(/^(<br>(\n)*)$/g)) ??
    false

  // depending on whether a block is active, the results should only be shown after confirmation
  const [showResults, setShowResults] = useSessionStorage(
    `show-results-${activeStack}-${currentInstance.id}`,
    !requireShowResultsConfirmation
  )

  // as soon as the evaluation view becomes available, the results should be shown
  useEffect(() => {
    console.log('RUNNING USE EFFECT WITH ', requireShowResultsConfirmation)
    if (!requireShowResultsConfirmation) {
      setShowResults(true)
    }
  }, [currentInstance.id, requireShowResultsConfirmation])

  if (!showResults && currentInstance.type !== ElementType.Content) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-slate-200">
        <div className="mb-3 flex flex-row items-center gap-2.5 text-xl font-bold">
          <FontAwesomeIcon icon={faClock} />
          <span>{t('manage.evaluation.blockActive')}</span>
        </div>
        <div className="mb-4 max-w-xl text-center">
          {t('manage.evaluation.blockActiveInfo')}
        </div>
        <Button primary onClick={() => setShowResults(true)}>
          {t('manage.evaluation.showResults')}
        </Button>
      </div>
    )
  }

  return (
    <div className={twMerge('flex h-full flex-col', className)}>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {(currentInstance.__typename === 'ChoicesActivityEvaluationData' ||
          currentInstance.__typename === 'NumericalActivityEvaluationData' ||
          currentInstance.__typename === 'FreeTextActivityEvaluationData' ||
          currentInstance.__typename === 'SelectionActivityEvaluationData') && (
          <div className="flex h-full w-full flex-col" key={currentInstance.id}>
            <div className="flex-none">
              <QuestionCollapsible
                content={currentInstance.content}
                proseSize={textSize.prose}
                maxExpandedHeight={
                  hasSolution && hasExplanation
                    ? 'max-h-[calc(100vh-8.3rem)]'
                    : 'max-h-[calc(100vh-8rem)]'
                }
              />
            </div>
            <div className="min-h-0 flex-1">
              {currentInstance.__typename ===
                'ChoicesActivityEvaluationData' && (
                <ChoicesEvaluation
                  instanceEvaluation={currentInstance}
                  courseLanguage={courseLanguage}
                  textSize={textSize}
                  chartType={chartType}
                  showSolution={showSolution}
                  showExplanation={showExplanation}
                  type={type}
                />
              )}
              {currentInstance.__typename ===
                'NumericalActivityEvaluationData' && (
                <NREvaluation
                  instanceEvaluation={currentInstance}
                  courseLanguage={courseLanguage}
                  textSize={textSize}
                  chartType={chartType}
                  showSolution={showSolution}
                  showExplanation={showExplanation}
                  type={type}
                />
              )}
              {currentInstance.__typename ===
                'FreeTextActivityEvaluationData' && (
                <FTEvaluation
                  instanceEvaluation={currentInstance}
                  courseLanguage={courseLanguage}
                  textSize={textSize}
                  chartType={chartType}
                  showSolution={showSolution}
                  showExplanation={showExplanation}
                  type={type}
                />
              )}
              {currentInstance.__typename ===
                'SelectionActivityEvaluationData' && (
                <SEEvaluation
                  instanceEvaluation={currentInstance}
                  textSize={textSize}
                  chartType={chartType}
                  showSolution={showSolution}
                  showExplanation={showExplanation}
                />
              )}
            </div>
          </div>
        )}

        {/* content included in case study evaluation component */}
        {currentInstance.__typename === 'CaseStudyActivityEvaluationData' && (
          <CSEvaluation
            key={currentInstance.id}
            instanceEvaluation={currentInstance}
            activeInstance={activeInstance}
            textSize={textSize}
            chartType={chartType}
            showSolution={showSolution}
            showExplanation={showExplanation}
            hasSolution={hasSolution}
            hasExplanation={hasExplanation}
            type={type}
          />
        )}

        {/* content included in flashcard evaluation component */}
        {currentInstance.__typename === 'FlashcardActivityEvaluationData' && (
          <FCEvaluation
            key={currentInstance.id}
            evaluation={currentInstance}
            textSize={textSize}
            chartType={chartType}
          />
        )}

        {/* content included in content evaluation component */}
        {currentInstance.__typename === 'ContentActivityEvaluationData' && (
          <CTEvaluation
            key={currentInstance.id}
            evaluation={currentInstance}
            textSize={textSize}
          />
        )}
      </div>
    </div>
  )
}

export default ElementEvaluation
