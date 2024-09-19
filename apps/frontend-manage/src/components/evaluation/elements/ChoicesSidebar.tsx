import { ChoicesElementInstanceEvaluation } from '@klicker-uzh/graphql/dist/ops'
import { Ellipsis } from '@klicker-uzh/markdown'
import { CHART_COLORS } from '@klicker-uzh/shared-components/src/constants'
import { twMerge } from 'tailwind-merge'
import { TextSizeType } from '../textSizes'

interface ChoicesSidebarProps {
  instance: ChoicesElementInstanceEvaluation
  textSize: TextSizeType
  showSolution: boolean
}

function ChoicesSidebar({
  instance,
  textSize,
  showSolution,
}: ChoicesSidebarProps) {
  return (
    <div className="mt-2 flex min-h-0 flex-1 flex-col gap-2">
      <div
        className={twMerge(
          'flex flex-1 flex-col gap-2.5 overflow-y-auto',
          textSize.text
        )}
      >
        {instance.results.choices.map((choice, innerIndex) => {
          const correctFraction = choice.count / instance.results.totalAnswers

          return (
            <div key={`${instance.id}-${innerIndex}`}>
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
                    tooltip: 'z-20 float-right min-w-[25rem] !text-white',
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
  )
}

export default ChoicesSidebar
