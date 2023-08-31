import { useQuery } from '@apollo/client'
import {
  GetParticipationDocument,
  QuestionStack,
  SelfDocument,
  StackElement,
} from '@klicker-uzh/graphql/dist/ops'
import { levelFromXp } from '@klicker-uzh/graphql/dist/util'
import { H3, Progress, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

interface ElementSummaryProps {
  displayName: string
  stacks: QuestionStack[]
}

function ElementSummary({ displayName, stacks }: ElementSummaryProps) {
  const t = useTranslations()
  const router = useRouter()
  const courseId = router.query.courseId as string

  const { data: participation } = useQuery(GetParticipationDocument, {
    variables: {
      courseId,
    },
  })

  const { data: participant } = useQuery(SelfDocument)

  const { totalPointsAwarded, totalXpAwarded } = stacks.reduce<{
    totalPointsAwarded: number
    totalXpAwarded: number
  }>(
    (acc, stack) => {
      const temp = stack.elements?.reduce<{
        totalPointsAwarded: number
        totalXpAwarded: number
      }>(
        (acc, element) => {
          return {
            totalPointsAwarded:
              acc.totalPointsAwarded +
              (element.questionInstance?.evaluation?.pointsAwarded ?? 0),
            totalXpAwarded:
              acc.totalPointsAwarded +
              (element.questionInstance?.evaluation?.xpAwarded ?? 0),
          }
        },
        { totalPointsAwarded: 0, totalXpAwarded: 0 }
      )

      return {
        totalPointsAwarded:
          acc.totalPointsAwarded + (temp?.totalPointsAwarded || 0),
        totalXpAwarded: acc.totalXpAwarded + (temp?.totalXpAwarded || 0),
      }
    },
    { totalPointsAwarded: 0, totalXpAwarded: 0 }
  )

  const gradedStacks = useMemo(
    () =>
      stacks
        .filter((stack) => {
          return stack.elements?.some((element) => {
            return element.questionInstance
          })
        })
        .map((stack) => {
          return {
            ...stack,
            ...stack.elements
              ?.filter((element) => {
                if (element.mdContent) return
                return element
              })
              .reduce<{
                elements: StackElement[]
                pointsAwarded: number
                xpAwarded: number
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
                        (element.questionInstance.evaluation?.pointsAwarded ??
                          0),
                      xpAwarded:
                        acc.xpAwarded +
                        (element.questionInstance.evaluation?.xpAwarded ?? 0),
                      score:
                        acc.score +
                        (element.questionInstance.evaluation?.score ?? 0),
                      pointsPossible:
                        acc.pointsPossible +
                        (element.questionInstance.questionData
                          .pointsMultiplier ?? 1) *
                          10,
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
                  elements: [],
                  pointsAwarded: 0,
                  xpAwarded: 0,
                  score: 0,
                  pointsPossible: 0,
                  solved: false,
                }
              ),
          }
        }),
    [stacks]
  )

  const levelUp = useMemo(
    () =>
      levelFromXp(participant?.self?.xp ?? 0) <
      levelFromXp((participant?.self?.xp ?? 0) + totalXpAwarded),
    [participant?.self, totalXpAwarded]
  )

  return (
    <div className={twMerge('space-y-3', participant?.self && 'space-y-8')}>
      <div>
        <H3>{t('shared.generic.congrats')}</H3>
        <p>
          {t.rich('pwa.learningElement.solvedLearningElement', {
            name: displayName,
            it: (text) => <span className="italic">{text}</span>,
          })}
        </p>
      </div>
      <div className="mx-auto space-y-2">
        <div className="flex flex-row items-center justify-center">
          {participant?.self && (
            <>
              <Image
                src={participant?.self?.levelData?.avatar ?? ''}
                alt="Old Level"
                width={50}
                height={50}
              />

              <Image
                src="/eating_bubbel.svg"
                alt="Eating Bubble"
                width={300}
                height={200}
                className="mx-2"
              />

              <Image
                src={
                  (levelUp
                    ? participant?.self?.levelData?.nextLevel?.avatar
                    : participant?.self?.levelData?.avatar) ?? ''
                }
                alt="New Level"
                width={50}
                height={50}
              />
            </>
          )}
        </div>
        {participant?.self?.levelData?.nextLevel?.requiredXp && (
          <Progress
            value={participant?.self?.xp + totalXpAwarded}
            max={participant?.self?.levelData.nextLevel.requiredXp}
            formatter={Number}
          />
        )}
        {participant?.self && (
          <div className="text-center">
            {t('pwa.learningElement.totalXp', {
              xp: totalXpAwarded,
            })}
          </div>
        )}
      </div>
      <div>
        <div className="flex flex-row items-center justify-between">
          <H3>{t('shared.generic.evaluation')}</H3>
          <H3 className={{ root: 'text-base' }}>
            {typeof participation?.getParticipation?.isActive === 'boolean' &&
            participation?.getParticipation?.isActive
              ? t('pwa.learningElement.pointsCollectedPossible')
              : t('pwa.learningElement.pointsComputedAvailable')}
          </H3>
        </div>
        <div>
          {gradedStacks.map((stack) => (
            <div className="flex flex-row justify-between" key={stack?.id}>
              <div>
                {stack.displayName ??
                  ((stack?.elements?.length || 1) > 1
                    ? `${stack?.elements?.[0].questionInstance?.questionData.name}, ...`
                    : `${stack?.elements?.[0].questionInstance?.questionData.name}`)}
              </div>
              {stack?.solved ? (
                <div>
                  {participation?.getParticipation?.isActive
                    ? `${stack.pointsAwarded} / `
                    : ''}{' '}
                  {stack.score} / {stack.pointsPossible}
                </div>
              ) : (
                <div>{t('pwa.learningElement.notAttempted')}</div>
              )}
            </div>
          ))}
        </div>

        {typeof participation?.getParticipation?.isActive === 'boolean' &&
          participation?.getParticipation?.isActive && (
            <H3 className={{ root: 'mt-4 text-right text-base' }}>
              {t('pwa.learningElement.totalPoints', {
                points: totalPointsAwarded,
              })}
            </H3>
          )}
        {typeof participation?.getParticipation?.isActive === 'boolean' &&
          !participation?.getParticipation?.isActive && (
            <UserNotification className={{ root: 'mt-5' }} type="info">
              {t.rich('pwa.learningElement.inactiveParticipation', {
                it: (text) => <span className="italic">{text}</span>,
                name: displayName,
              })}
            </UserNotification>
          )}
      </div>
    </div>
  )
}

export default ElementSummary
