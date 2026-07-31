import { faClock } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ElementBlockStatus,
  ElementInstanceEvaluation,
  ElementType,
  LocaleType,
  StackEvaluation,
} from '@klicker-uzh/graphql/dist/ops'
import { ChartType } from '@klicker-uzh/shared-components/src/constants'
import { useSessionStorage } from '@uidotdev/usehooks'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import LiveQuizCountdown from '../liveQuiz/cockpit/LiveQuizCountdown'
import { ActivityEvaluationType } from './ActivityEvaluation'
import CSEvaluation from './elements/CSEvaluation'
import CTEvaluation from './elements/CTEvaluation'
import ChoicesEvaluation from './elements/ChoicesEvaluation'
import CodeEvaluation from './elements/CodeEvaluation'
import FCEvaluation from './elements/FCEvaluation'
import FTEvaluation from './elements/FTEvaluation'
import NREvaluation from './elements/NREvaluation'
import QuestionCollapsible from './elements/QuestionCollapsible'
import SEEvaluation from './elements/SEEvaluation'
import { TextSizeType } from './textSizes'

interface ElementEvaluationProps {
  currentInstance: ElementInstanceEvaluation
  currentStack: StackEvaluation
  activeInstance: number
  activeStack: number
  courseLanguage?: LocaleType | null
  textSize: TextSizeType
  chartType: ChartType
  showSolution: boolean
  showExplanation: boolean
  type: ActivityEvaluationType
  requireShowResultsConfirmation: boolean
  isStackActive?: boolean
  isAssessmentEnabled: boolean
  pinCode?: string | null
  className?: string
}

function ElementEvaluation({
  currentInstance,
  currentStack,
  activeInstance,
  activeStack,
  courseLanguage,
  textSize,
  chartType,
  showSolution,
  showExplanation,
  type,
  requireShowResultsConfirmation,
  isStackActive,
  isAssessmentEnabled,
  pinCode,
  className,
}: ElementEvaluationProps) {
  const t = useTranslations()
  const [inCooldown, setInCooldown] = useState(false)
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
    if (!requireShowResultsConfirmation) {
      setShowResults(true)
    }
  }, [currentInstance.id, requireShowResultsConfirmation])

  if (!showResults && currentInstance.type !== ElementType.Content) {
    return (
      <div
        className="relative flex h-full w-full flex-col items-center justify-center bg-slate-200"
        key={`overlay-${currentInstance.id}-${currentStack.stackId}`}
      >
        {currentStack.expiresAt && (
          <div className="absolute right-4 top-4">
            <LiveQuizCountdown
              size="lg"
              block={{
                id: currentStack.stackId,
                status: currentStack.status ?? ElementBlockStatus.Scheduled,
                expiresAt: currentStack.expiresAt,
                timeLimit: currentStack.timeLimit,
              }}
              inCooldown={inCooldown}
              setInCooldown={setInCooldown}
              onExpiration={() => {}}
            />
          </div>
        )}
        <div className="mb-3 flex flex-row items-center gap-2.5 text-xl font-bold">
          <FontAwesomeIcon icon={faClock} />
          <span>{t('manage.evaluation.blockActive')}</span>
        </div>
        <div className="mb-4 max-w-xl text-center">
          {t('manage.evaluation.blockActiveInfo')}
        </div>
        <Button
          primary
          onClick={() => setShowResults(true)}
          data={{ cy: 'show-results-evaluation' }}
        >
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
                  showSolution={!isStackActive && showSolution}
                  showExplanation={!isStackActive && showExplanation}
                  isAssessmentEnabled={isAssessmentEnabled}
                  pinCode={pinCode}
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
                  showSolution={!isStackActive && showSolution}
                  showExplanation={!isStackActive && showExplanation}
                  isAssessmentEnabled={isAssessmentEnabled}
                  pinCode={pinCode}
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
                  showSolution={!isStackActive && showSolution}
                  showExplanation={!isStackActive && showExplanation}
                  isAssessmentEnabled={isAssessmentEnabled}
                  pinCode={pinCode}
                  type={type}
                />
              )}
              {currentInstance.__typename ===
                'SelectionActivityEvaluationData' && (
                <SEEvaluation
                  instanceEvaluation={currentInstance}
                  textSize={textSize}
                  chartType={chartType}
                  showSolution={!isStackActive && showSolution}
                  showExplanation={!isStackActive && showExplanation}
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
            showSolution={!isStackActive && showSolution}
            showExplanation={!isStackActive && showExplanation}
            hasSolution={hasSolution}
            hasExplanation={hasExplanation}
            isAssessmentEnabled={isAssessmentEnabled}
            pinCode={pinCode}
            type={type}
            // TODO: word cloud for case study?
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
            // TODO: word cloud for content?
          />
        )}

        {currentInstance.__typename === 'CodeActivityEvaluationData' && (
          <div className="flex h-full w-full flex-col" key={currentInstance.id}>
            <div className="flex-none">
              <QuestionCollapsible
                content={currentInstance.content}
                proseSize={textSize.prose}
              />
            </div>
            <div className="min-h-0 flex-1">
              <CodeEvaluation evaluation={currentInstance} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ElementEvaluation
