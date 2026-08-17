import { useMutation, useQuery } from '@apollo/client'
import { faCheckCircle } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  GetMicroLearningDocument,
  GetParticipationDocument,
  MarkMicroLearningCompletedDocument,
  SelfDocument,
  UserRole,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { parseEmbedParam } from '@klicker-uzh/shared-components/src/utils/parseEmbedParam'
import { Button, H3, UserNotification } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useMemo } from 'react'
import Layout from '../../../../../components/Layout'
import { CourseChatDrawer } from '../../../../../components/chatbot/CourseChatDrawer'
import PreviewMessage from '../../../../../components/common/PreviewMessage'
import useStackEvaluationAggregation from '../../../../../components/hooks/useStackEvaluationAggregation'
import { buildMicroLearningChatContext } from '../../../../../lib/chatbot/chatContext'

function MicrolearningEvaluation() {
  const t = useTranslations()
  const router = useRouter()
  const id = router.query.id as string
  const embedded = parseEmbedParam(router.query.embed)

  const { loading, data } = useQuery(GetMicroLearningDocument, {
    variables: { id },
    skip: !id,
  })
  const { data: participant } = useQuery(SelfDocument)
  const { data: participation } = useQuery(GetParticipationDocument, {
    variables: { courseId: data?.microLearning?.course?.id ?? '' },
    skip: !data?.microLearning?.course?.id,
  })

  const [markMicrolearningCompleted, { loading: markingAsCompleted }] =
    useMutation(MarkMicroLearningCompletedDocument)

  const microlearning = data?.microLearning
  const courseId = microlearning?.course?.id
  const aggregatedResults = useStackEvaluationAggregation({
    microlearning: microlearning,
  })
  const chatContext = useMemo(
    () =>
      courseId
        ? buildMicroLearningChatContext({
            courseId,
            locale: router.locale ?? 'en',
            microLearning: microlearning ?? null,
            totalSteps: microlearning?.stacks?.length ?? 0,
          })
        : null,
    [courseId, microlearning, router.locale]
  )

  if (loading || !microlearning) {
    return (
      <Layout embedded={embedded}>
        <Loader />
      </Layout>
    )
  }

  return (
    <Layout
      embedded={embedded}
      displayName={microlearning.displayName}
      course={microlearning.course ?? undefined}
    >
      <div className="flex flex-col gap-3 md:mx-auto md:mb-4 md:w-full md:max-w-6xl md:rounded md:border md:p-8 md:pt-6">
        {microlearning.isOwner ? (
          <PreviewMessage
            activityType={t('shared.generic.microlearning')}
            name={microlearning.name}
            displayName={microlearning.displayName}
            className="mb-2"
          />
        ) : null}
        <div className="flex flex-row items-center gap-4">
          <FontAwesomeIcon
            icon={faCheckCircle}
            className="text-green-700"
            size="3x"
          />
          <div>
            <H3>{t('shared.generic.congrats')}</H3>
            <p>
              {t.rich('pwa.microLearning.solvedMicrolearning', {
                name: microlearning.displayName,
                it: (text) => <span className="italic">{text}</span>,
              })}
            </p>
          </div>
        </div>
        <div>
          <div className="mt-3 flex flex-col items-center justify-between md:mt-0 md:flex-row">
            <H3 className={{ root: 'flex flex-row justify-between' }}>
              {t('shared.generic.evaluation')}
            </H3>
            <H3 className={{ root: 'self-end text-base md:text-lg' }}>
              {participation?.getParticipation?.isActive
                ? t('pwa.practiceQuiz.pointsCollectedPossible')
                : t('pwa.practiceQuiz.pointsComputedAvailable')}
            </H3>
          </div>
          <div>
            {aggregatedResults &&
              aggregatedResults.evaluation &&
              data.microLearning?.stacks?.map((stack, ix) => (
                <div className="flex flex-row justify-between" key={stack.id}>
                  <div>
                    {stack.displayName ||
                      t('pwa.microLearning.questionSetN', { number: ix + 1 })}
                  </div>
                  <div>
                    {typeof aggregatedResults.evaluation[stack.id]
                      ?.pointsAwarded !== 'undefined' &&
                      aggregatedResults.evaluation[stack.id]?.pointsAwarded !==
                        null &&
                      participation?.getParticipation?.isActive &&
                      `${
                        aggregatedResults.evaluation[stack.id]?.pointsAwarded
                      }/`}
                    {aggregatedResults.evaluation[stack.id]?.score}
                    {`/${aggregatedResults.evaluation[stack.id]?.maxPoints}`}
                  </div>
                </div>
              ))}
          </div>

          {participation?.getParticipation?.isActive && (
            <H3 className={{ root: 'mt-4 text-right' }}>
              {t('pwa.practiceQuiz.totalPoints', {
                points: aggregatedResults?.totalPointsAwarded ?? 0,
              })}
            </H3>
          )}
        </div>

        {typeof participation?.getParticipation?.isActive === 'boolean' &&
          participation?.getParticipation?.isActive === false && (
            <UserNotification type="info">
              {t.rich('pwa.microLearning.inactiveParticipation', {
                it: (text) => <span className="italic">{text}</span>,
                name: microlearning.displayName,
              })}
            </UserNotification>
          )}
        {participant?.self &&
          participant.self.role === UserRole.Participant &&
          !participation?.getParticipation && (
            <UserNotification className={{ root: 'mt-5' }} type="info">
              {t.rich('pwa.microLearning.missingParticipation', {
                it: (text) => <span className="italic">{text}</span>,
                name: microlearning.displayName,
              })}
            </UserNotification>
          )}
        {participation?.getParticipation && (
          <div className="text-right">
            <Button
              primary
              loading={markingAsCompleted}
              onClick={async () => {
                await markMicrolearningCompleted({
                  variables: { courseId: microlearning.course!.id, id },
                })
                router.replace('/')
              }}
              data={{ cy: 'finish-microlearning' }}
            >
              <Button.Label>{t('shared.generic.finish')}</Button.Label>
            </Button>
          </div>
        )}
      </div>
      {courseId && chatContext && (
        <CourseChatDrawer
          courseId={courseId}
          context={chatContext}
          embedded={embedded}
          enabled={
            participant?.self?.role === UserRole.Participant &&
            Boolean(participation?.getParticipation)
          }
        />
      )}
    </Layout>
  )
}

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
    },
    revalidate: 600,
  }
}

export function getStaticPaths() {
  return {
    paths: [],
    fallback: 'blocking',
  }
}

export default MicrolearningEvaluation
