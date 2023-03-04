import { useMutation, useQuery } from '@apollo/client'
import QuestionStack from '@components/learningElements/QuestionStack'
import {
  BookmarkQuestionDocument,
  GetBookmarkedQuestionsDocument,
  GetLearningElementDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { addApolloState, initializeApollo } from '@lib/apollo'
import { getParticipantToken } from '@lib/token'
import { H3, Progress, UserNotification } from '@uzh-bf/design-system'
import { GetServerSideProps } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useMemo, useState } from 'react'
import Footer from '../../../../components/common/Footer'
import Layout from '../../../../components/Layout'
import ElementOverview from '../../../../components/learningElements/ElementOverview'

interface Props {
  courseId: string
  id: string
}

// TODO: leaderboard and points screen after all questions have been completed?
// TODO: complete implementation of free text questions
function LearningElement({ courseId, id }: Props) {
  const t = useTranslations()
  const router = useRouter()

  const [currentIx, setCurrentIx] = useState(-1)

  const [bookmarkQuestion] = useMutation(BookmarkQuestionDocument, {
    refetchQueries: [
      // TODO: replace with more efficient UPDATE instead of refetching everything
      { query: GetBookmarkedQuestionsDocument, variables: { courseId } },
    ],
  })
  const { data: bookmarks } = useQuery(GetBookmarkedQuestionsDocument, {
    variables: { courseId: router.query.courseId as string },
    skip: !router.query.courseId,
  })

  const { loading, error, data } = useQuery(GetLearningElementDocument, {
    variables: { id },
  })

  const currentStack = data?.learningElement?.stacks?.[currentIx] && {
    ...data.learningElement.stacks[currentIx],
    // TODO: fix bookmarking
    isBookmarked: false,
    // isBookmarked: bookmarks?.getBookmarkedQuestions?.find(
    //   (question) =>
    //     question.id === data?.learningElement?.instances?.[currentIx]?.id
    // )
    //   ? true
    //   : false,
  }

  const totalPointsAwarded = useMemo(() => {
    if (!data?.learningElement) return 0
    return data.learningElement.instances?.reduce(
      (acc, instance) => acc + (instance?.evaluation?.pointsAwarded ?? 0),
      0
    )
  }, [data?.learningElement?.instances])

  if (loading) return <p>{t('shared.generic.loading')}</p>

  if (!data?.learningElement) {
    return (
      <Layout>
        <UserNotification
          notificationType="error"
          message={t('pwa.learningElement.notFound')}
        />
      </Layout>
    )
  }
  if (error) return <p>Oh no... {error.message}</p>

  const handleNextQuestion = () => {
    scrollTo(0, 0)
    setCurrentIx((ix) => ix + 1)
  }

  return (
    <Layout
      displayName={data.learningElement.displayName}
      course={data.learningElement.course ?? undefined}
    >
      <div className="flex-1">
        <div className="flex flex-col gap-6 md:max-w-5xl md:mx-auto md:w-full md:mb-4 md:p-8 md:pt-6 md:border md:rounded">
          {currentIx === -1 && (
            <ElementOverview
              displayName={data.learningElement.displayName}
              description={data.learningElement.description ?? undefined}
              numOfQuestions={data.learningElement.numOfQuestions ?? undefined}
              orderType={data.learningElement.orderType}
              resetTimeDays={data.learningElement.resetTimeDays ?? undefined}
              previouslyAnswered={
                data.learningElement.previouslyAnswered ?? undefined
              }
              stacksWithQuestions={
                data.learningElement.stacksWithQuestions ?? undefined
              }
              pointsMultiplier={data.learningElement.pointsMultiplier}
              setCurrentIx={setCurrentIx}
            />
          )}

          {currentStack && (
            <QuestionStack
              stack={currentStack}
              currentStep={currentIx + 1}
              totalSteps={data.learningElement.stacksWithQuestions ?? 0}
              handleNextQuestion={handleNextQuestion}
            />
          )}

          {currentIx >= 0 && !currentStack && (
            <div className="space-y-3">
              <div>
                <H3>{t('shared.generic.congrats')}</H3>
                <p>
                  {t.rich('pwa.learningElement.solvedLearningElement', {
                    name: data.learningElement.displayName,
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
                  {data.learningElement.instances?.map((instance) => (
                    <div
                      className="flex flex-row justify-between"
                      key={instance.id}
                    >
                      <div>{instance.questionData.name}</div>
                      {instance.evaluation ? (
                        <div>
                          {instance.evaluation.pointsAwarded} /{' '}
                          {instance.evaluation.score} /{' '}
                          {instance.pointsMultiplier * 10}
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
          )}

          {(currentIx === -1 || currentStack) && (
            <div className="order-1 md:order-2">
              <Progress
                nonLinear
                isMaxVisible
                displayOffset={
                  (data.learningElement?.stacksWithQuestions ?? 0) > 15
                    ? 3
                    : undefined
                }
                formatter={(v) => v}
                value={currentIx}
                max={data.learningElement?.stacksWithQuestions ?? 0}
                onItemClick={(ix: number) => setCurrentIx(ix)}
              />
            </div>
          )}
        </div>
      </div>

      <Footer
        browserLink={`${process.env.NEXT_PUBLIC_PWA_URL}/course/${courseId}/element/${id}`}
      />
    </Layout>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  if (
    typeof ctx.params?.courseId !== 'string' ||
    typeof ctx.params?.id !== 'string'
  ) {
    return {
      redirect: {
        destination: '/404',
        statusCode: 302,
      },
    }
  }

  const apolloClient = initializeApollo()

  const { participantToken, participant } = await getParticipantToken({
    apolloClient,
    ctx,
  })

  if (participant && !participant.avatar) {
    return {
      redirect: {
        destination: `/editProfile?redirect_to=${encodeURIComponent(
          `/course/${ctx.params.courseId}/element/${ctx.params.id}`
        )}`,
        statusCode: 302,
      },
    }
  }

  const result = await apolloClient.query({
    query: GetLearningElementDocument,
    variables: { id: ctx.params.id },
    context: participantToken
      ? {
          headers: {
            authorization: `Bearer ${participantToken}`,
          },
        }
      : undefined,
  })

  return addApolloState(apolloClient, {
    props: {
      id: ctx.params.id,
      courseId: ctx.params.courseId,
      messages: {
        ...require(`shared-components/src/intl-messages/${ctx.locale}.json`),
      },
    },
  })
}

export default LearningElement
