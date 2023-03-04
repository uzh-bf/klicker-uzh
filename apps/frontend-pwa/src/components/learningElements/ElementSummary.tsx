import { QuestionStack, StackElement } from '@klicker-uzh/graphql/dist/ops'
import { H3 } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useMemo } from 'react'

interface ElementSummaryProps {
  displayName: string
  stacks: QuestionStack[]
}

function ElementSummary({ displayName, stacks }: ElementSummaryProps) {
  const t = useTranslations()

  const totalPointsAwarded = stacks.reduce((acc, stack) => {
    return (
      acc +
      (stack.elements?.reduce((acc, element) => {
        return acc + (element.questionInstance?.evaluation?.pointsAwarded ?? 0)
      }, 0) || 0)
    )
  }, 0)

  const gradedStacks = useMemo(
    () =>
      stacks
        .filter((stack) => {
          return stack.elements?.some((element) => {
            return element.questionInstance
          })
        })
        .map((stack) =>
          stack.elements
            ?.filter((element) => {
              if (element.mdContent) return
              return element
            })
            .reduce<{
              id: number
              name?: string
              elements: StackElement[]
              pointsAwarded: number
              score: number
              pointsPossible: number
              solved: boolean
            }>(
              (acc, element) => {
                if (element.questionInstance) {
                  return {
                    ...acc,
                    elements: [...acc.elements, element],
                    pointsAwarded:
                      acc.pointsAwarded +
                      (element.questionInstance.evaluation?.pointsAwarded ?? 0),
                    score:
                      acc.score +
                      (element.questionInstance.evaluation?.score ?? 0),
                    pointsPossible:
                      acc.pointsPossible +
                      element.questionInstance.pointsMultiplier * 10,
                    solved:
                      acc.solved ||
                      (typeof element.questionInstance.evaluation !==
                        'undefined' &&
                        element.questionInstance.evaluation !== null),
                  }
                }
                return acc
              },
              {
                id: stack.id,
                name: undefined,
                elements: [],
                pointsAwarded: 0,
                score: 0,
                pointsPossible: 0,
                solved: false,
              }
            )
        ),
    [stacks]
  )

  return (
    <div className="space-y-3">
      <div>
        <H3>{t('shared.generic.congrats')}</H3>
        <p>
          {t.rich('pwa.learningElement.solvedLearningElement', {
            name: displayName,
            it: (text) => <span className="italic">{text}</span>,
          })}
        </p>
      </div>
      <div>
        <div className="flex flex-row items-center justify-between">
          <H3
            className={{
              root: 'flex flex-row justify-between text-sm',
            }}
          >
            {t('shared.generic.evaluation')}
          </H3>
          <H3 className={{ root: 'text-sm' }}>
            {t('pwa.learningElement.pointsCollectedPossible')}
          </H3>
        </div>
        <div>
          {/* // TODO: add optional name on questionStack, which is shown here (and possibly on the stack page) - if no name is specified, just use the first question and ,... if multiple are part of the definition */}

          {gradedStacks.map((stack) => (
            <div className="flex flex-row justify-between" key={stack?.id}>
              <div>
                {stack?.name || (stack?.elements.length || 1) > 1
                  ? `${stack?.elements[0].questionInstance?.questionData.name}, ...`
                  : `${stack?.elements[0].questionInstance?.questionData.name}`}
              </div>
              {stack?.solved ? (
                <div>
                  {stack.pointsAwarded} / {stack.score} / {stack.pointsPossible}
                </div>
              ) : (
                <div>{t('pwa.learningElement.notAttempted')}</div>
              )}
            </div>
          ))}
        </div>

        <H3 className={{ root: 'mt-4 text-right text-base' }}>
          {t('pwa.learningElement.totalPoints', {
            points: totalPointsAwarded,
          })}
        </H3>
      </div>
    </div>
  )
}

export default ElementSummary
