import { useMutation, useQuery } from '@apollo/client'
import { faBookmark } from '@fortawesome/free-regular-svg-icons'
import { faBookmark as faBookmarkSolid } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  BookmarkQuestionDocument,
  GetBookmarkedQuestionsDocument,
  GetLearningElementDocument,
  QuestionType,
  ResponseToQuestionInstanceDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { addApolloState, initializeApollo } from '@lib/apollo'
import { getParticipantToken } from '@lib/token'
import { Button, H3, Progress, UserNotification } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { GetServerSideProps } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import Footer from '../../../../components/common/Footer'
import OptionsDisplay from '../../../../components/common/OptionsDisplay'
import EvaluationDisplay from '../../../../components/evaluation/EvaluationDisplay'
import FlagQuestionModal from '../../../../components/flags/FlagQuestionModal'
import Layout from '../../../../components/Layout'
import DynamicMarkdown from '../../../../components/learningElements/DynamicMarkdown'
import ElementOverview from '../../../../components/learningElements/ElementOverview'
import formatResponse from '../../../../lib/formatResponse'

interface Props {
  courseId: string
  id: string
}

// TODO: leaderboard and points screen after all questions have been completed?
// TODO: different question types (FREE and RANGE)
function LearningElement({ courseId, id }: Props) {
  const t = useTranslations()
  const router = useRouter()
  const [response, setResponse] = useState<{} | number[] | string | null>(null)
  const [currentIx, setCurrentIx] = useState(-1)
  const [modalOpen, setModalOpen] = useState(false)

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

  const currentInstance = data?.learningElement?.instances?.[currentIx] && {
    ...data.learningElement.instances[currentIx],
    isBookmarked: bookmarks?.getBookmarkedQuestions?.find(
      (question) =>
        question.id === data?.learningElement?.instances?.[currentIx]?.id
    )
      ? true
      : false,
  }
  const questionData = currentInstance?.questionData

  useEffect(() => {
    if (questionData?.type) {
      if (
        questionData.type === QuestionType.Sc ||
        questionData.type === QuestionType.Mc
      ) {
        setResponse([])
      } else if (questionData.type === QuestionType.Kprim) {
        setResponse({})
      } else {
        setResponse('')
      }
    } else {
      setResponse(null)
    }
  }, [questionData?.type, currentIx])

  const [respondToQuestionInstance] = useMutation(
    ResponseToQuestionInstanceDocument
  )

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

  const isEvaluation = !!currentInstance?.evaluation

  const handleSubmitResponse = () => {
    if (!response) return
    scrollTo(0, 0)

    respondToQuestionInstance({
      variables: {
        courseId: router.query.courseId as string,
        id: currentInstance?.id as number,
        response: formatResponse(questionData, response),
      },
    })
  }

  const handleNextQuestion = () => {
    scrollTo(0, 0)
    setCurrentIx((ix) => ix + 1)
    setResponse(null)
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

          {currentIx >= 0 && !currentInstance && (
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

          {currentInstance && (
            <div className="order-2 md:order-1">
              {questionData && (
                <div className="flex flex-col gap-4 md:gap-8 md:flex-row">
                  <div className="flex-1 basis-2/3">
                    <div className="flex flex-row items-center justify-between mb-4 border-b">
                      <H3 className={{ root: 'mb-0' }}>{questionData.name}</H3>
                      <div className="flex flex-row items-center gap-3">
                        <div className="text-sm md:text-base text-slate-500">
                          {t('pwa.learningElement.questionProgress', {
                            current: currentIx + 1,
                            total: data.learningElement?.instances?.length,
                          })}
                        </div>
                        <Button
                          basic
                          className={{ root: 'mb-1' }}
                          onClick={() => {
                            bookmarkQuestion({
                              variables: {
                                instanceId: currentInstance.id!,
                                courseId: courseId,
                                bookmarked: !currentInstance.isBookmarked,
                              },
                            })
                          }}
                        >
                          {currentInstance.isBookmarked ? (
                            <FontAwesomeIcon
                              className="text-red-600 hover:text-red-500"
                              icon={faBookmarkSolid}
                            />
                          ) : (
                            <FontAwesomeIcon
                              className="hover:text-red-400"
                              icon={faBookmark}
                            />
                          )}
                        </Button>
                        <FlagQuestionModal
                          open={modalOpen}
                          setOpen={setModalOpen}
                          instanceId={currentInstance.id!}
                        />
                      </div>
                    </div>

                    <div className="pb-2">
                      <DynamicMarkdown content={questionData.content} />
                    </div>
                    {currentInstance.evaluation && questionData.explanation && (
                      <UserNotification
                        notificationType="success"
                        message=""
                        className={{
                          root: 'flex flex-row items-center mb-2 md:mb-4 gap-3 px-3',
                          content: 'mt-0',
                        }}
                      >
                        <div className="font-bold">
                          {t('shared.generic.explanation')}
                        </div>
                        <DynamicMarkdown content={questionData.explanation} />
                      </UserNotification>
                    )}
                    <OptionsDisplay
                      key={currentInstance.id}
                      isEvaluation={isEvaluation}
                      evaluation={currentInstance.evaluation}
                      response={response}
                      onChangeResponse={setResponse}
                      onSubmitResponse={
                        isEvaluation ? handleNextQuestion : handleSubmitResponse
                      }
                      questionType={questionData.type}
                      options={questionData.options}
                      displayMode={questionData.displayMode}
                    />
                  </div>

                  {currentInstance.evaluation && (
                    <div className="flex-1 pt-4 space-y-4 border-t md:p-4 md:border md:rounded md:bg-gray-50 basis-1/3">
                      <div className="flex justify-between">
                        <div className="flex flex-row gap-2">
                          {t.rich('pwa.learningElement.multiplicatorEval', {
                            mult: currentInstance.pointsMultiplier,
                            b: (text) => (
                              <span className="font-bold">{text}</span>
                            ),
                          })}
                        </div>
                      </div>
                      <div className="flex flex-row gap-4 md:flex-wrap">
                        <div>
                          <div className="font-bold">
                            {t('shared.leaderboard.computed')}
                          </div>
                          <div className="text-lg">
                            {currentInstance.evaluation.score}{' '}
                            {t('shared.leaderboard.points')}
                          </div>
                        </div>
                        <div>
                          <div className="font-bold">
                            {t('shared.leaderboard.collected')}
                          </div>
                          <div className="text-lg">
                            {currentInstance.evaluation.pointsAwarded}{' '}
                            {t('shared.leaderboard.points')}
                          </div>
                          <div className="text-lg">
                            {currentInstance.evaluation.xpAwarded} XP
                          </div>
                        </div>
                        <div>
                          <div className="font-bold">
                            {t('pwa.learningElement.newPointsFrom')}
                          </div>
                          <div className="text-lg">
                            {dayjs(
                              currentInstance.evaluation.newPointsFrom
                            ).format('DD.MM.YYYY HH:mm')}
                          </div>
                          <div className="text-lg">
                            {dayjs(currentInstance.evaluation.newXpFrom).format(
                              'DD.MM.YYYY HH:mm'
                            )}
                          </div>
                        </div>
                      </div>

                      <EvaluationDisplay
                        options={questionData.options}
                        questionType={questionData.type}
                        evaluation={currentInstance.evaluation}
                        reference={String(response)}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {(currentIx === -1 || currentInstance) && (
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
