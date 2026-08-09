import {
  ChoicesActivityEvaluationData,
  LocaleType,
} from '@klicker-uzh/graphql/dist/ops'
import { Ellipsis } from '@klicker-uzh/markdown'
import { CHART_COLORS } from '@klicker-uzh/shared-components/src/constants'
import { useRouter } from 'next/router'
import { twMerge } from 'tailwind-merge'
import { ActivityEvaluationType } from '../ActivityEvaluation'
import { TextSizeType } from '../textSizes'
import LiveQuizEvaluationQRCode from './LiveQuizEvaluationQRCode'

interface ChoicesSidebarProps {
  instance: ChoicesActivityEvaluationData
  courseLanguage?: LocaleType | null
  isAssessmentEnabled: boolean
  pinCode?: string | null
  textSize: TextSizeType
  showSolution: boolean
  type: ActivityEvaluationType
}

function ChoicesSidebar({
  instance,
  courseLanguage,
  isAssessmentEnabled,
  pinCode,
  textSize,
  showSolution,
  type,
}: ChoicesSidebarProps) {
  const router = useRouter()

  return (
    <div
      className={twMerge(
        'order-1 flex h-full w-full flex-col justify-between overflow-hidden pb-1 pt-2 md:order-2',
        textSize.text
      )}
    >
      <div className="flex h-max max-h-full flex-col gap-2 overflow-y-auto px-2">
        <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto">
          {instance.results.choices.map((choice, innerIndex) => {
            const correctFraction =
              instance.results.totalAnswers > 0
                ? choice.count / instance.results.totalAnswers
                : 0

            return (
              <div key={`${instance.id}-${choice.value}`}>
                <div className="flex flex-row items-center justify-between leading-5">
                  <div
                    style={{
                      backgroundColor: showSolution
                        ? choice.correct
                          ? '#00de0d'
                          : '#ff0000'
                        : CHART_COLORS[innerIndex % 12],
                      minWidth: '1.75rem',
                      width: `calc(${correctFraction * 100}%)`,
                    }}
                    className={twMerge(
                      'mr-2 flex h-5 items-center justify-center rounded-md font-bold text-white',
                      choice.correct && showSolution && 'text-black'
                    )}
                  >
                    {String.fromCharCode(65 + innerIndex)}
                  </div>
                  <div className="whitespace-nowrap text-right">
                    {Math.round(100 * correctFraction)} %
                  </div>
                </div>

                <div className="line-clamp-3 w-full">
                  <Ellipsis
                    maxLines={3}
                    // maxLength={60}
                    className={{
                      tooltip: 'min-w-100 z-20 float-right',
                      markdown: textSize.text,
                    }}
                  >
                    {choice.value}
                  </Ellipsis>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      {type === 'LiveQuiz' && !router.query.hmac && (
        <LiveQuizEvaluationQRCode
          language={courseLanguage}
          isAssessmentEnabled={isAssessmentEnabled}
          pinCode={pinCode}
        />
      )}
    </div>
  )
}

export default ChoicesSidebar
