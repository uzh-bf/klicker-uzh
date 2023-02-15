import { useMutation, useQuery } from '@apollo/client'
import {
  faQuestionCircle,
  faTimesCircle,
} from '@fortawesome/free-regular-svg-icons'
import { faCheck, faRepeat, faShuffle } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  GetLearningElementDocument,
  QuestionType,
  ResponseToQuestionInstanceDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Markdown from '@klicker-uzh/markdown'
import { addApolloState, initializeApollo } from '@lib/apollo'
import { getParticipantToken } from '@lib/token'
import { Button, H3, Progress } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { GetServerSideProps } from 'next'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import Footer from '../../../../components/common/Footer'
import EvaluationDisplay from '../../../../components/EvaluationDisplay'
import Layout from '../../../../components/Layout'
import OptionsDisplay from '../../../../components/OptionsDisplay'
import formatResponse from '../../../../lib/formatResponse'

const ORDER_TYPE_LABEL = {
  LAST_RESPONSE: 'zuletzt beantwortete Fragen am Ende',
  SHUFFLED: 'zufällige Reihenfolge',
  SEQUENTIAL: 'geordnet in Sequenz',
}

interface Props {
  courseId: string
  id: string
}

// TODO: leaderboard and points screen after all questions have been completed?
// TODO: different question types (FREE and RANGE)
function LearningElement({ courseId, id }: Props) {
  const [response, setResponse] = useState<{} | number[] | string | null>(null)
  const [currentIx, setCurrentIx] = useState(-1)

  const router = useRouter()

  const { loading, error, data } = useQuery(GetLearningElementDocument, {
    variables: { id },
  })

  const currentInstance = data?.learningElement?.instances?.[currentIx]
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

  if (loading || !data?.learningElement) return <p>Loading...</p>
  if (error) return <p>Oh no... {error.message}</p>

  const isEvaluation = !!currentInstance?.evaluation

  const handleSubmitResponse = () => {
    if (!response) return

    respondToQuestionInstance({
      variables: {
        courseId: router.query.courseId as string,
        id: currentInstance?.id as number,
        response: formatResponse(questionData, response),
      },
    })
  }

  const handleNextQuestion = () => {
    setCurrentIx((ix) => ix + 1)
    setResponse(null)
  }

  return (
    <Layout
      displayName={data.learningElement.displayName}
      courseName={data.learningElement.course.displayName}
      courseColor={data.learningElement.course.color}
    >
      <div className="flex-1">
        <div className="flex flex-col gap-6 md:max-w-5xl md:mx-auto md:w-full md:mb-4 md:p-8 md:pt-6 md:border md:rounded">
          {currentIx === -1 && (
            <div className="flex flex-col space-y-4">
              <div className="border-b">
                <H3 className={{ root: 'mb-0' }}>
                  {data.learningElement.displayName}
                </H3>
              </div>

              {data.learningElement.description && (
                <Markdown content={data.learningElement.description} />
              )}

              <div className="flex flex-col gap-4 text-sm md:gap-16 md:flex-row">
                <div className="flex-1 space-y-2">
                  <div className="flex flex-row items-center gap-2">
                    <FontAwesomeIcon icon={faQuestionCircle} />
                    <div>
                      Anzahl Fragen: {data.learningElement.instances?.length}
                    </div>
                  </div>
                  <div className="flex flex-row items-center gap-2">
                    <FontAwesomeIcon icon={faShuffle} /> Reihenfolge:{' '}
                    <div>
                      {ORDER_TYPE_LABEL[data.learningElement.orderType]}
                    </div>
                  </div>
                  <div className="flex flex-row items-center gap-2">
                    <FontAwesomeIcon icon={faRepeat} /> Wiederholung:{' '}
                    <div>
                      {data.learningElement.resetTimeDays === 1 ? (
                        <>täglich</>
                      ) : (
                        <>alle {data.learningElement.resetTimeDays} Tage</>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex-1 space-y-2">
                  {/* <div className="flex flex-row items-center gap-2">
                  <div>
                    Punkte (berechnet): {data.learningElement.previousScore}
                  </div>
                </div>
                <div className="flex flex-row items-center gap-2">
                  <div>
                    Punkte (gesammelt):{' '}
                    {data.learningElement.previousPointsAwarded}
                  </div>
                </div> */}
                  <div className="flex flex-row items-center gap-2">
                    <FontAwesomeIcon icon={faCheck} />
                    <div>
                      Min. 1x beantwortet:{' '}
                      {data.learningElement.previouslyAnswered}/
                      {data.learningElement.instances.length}
                    </div>
                  </div>
                  {/* <div className="flex flex-row items-center gap-2">
                  Anzahl Antworten:{' '}
                  <div>{data.learningElement.totalTrials}</div>
                </div> */}
                  <div className="flex flex-row items-center gap-2">
                    <FontAwesomeIcon icon={faTimesCircle} />
                    <div>
                      Multiplikator: {data.learningElement.pointsMultiplier}x
                      Punkte
                    </div>
                  </div>
                </div>
              </div>

              <Button
                className={{ root: 'self-end text-lg' }}
                onClick={() => setCurrentIx(0)}
              >
                Starten
              </Button>
            </div>
          )}

          {currentIx >= 0 && !currentInstance && (
            <div className="space-y-3">
              <div>
                <H3>Gratulation!</H3>
                <p>
                  Du hast das Lernelement{' '}
                  <span className="italic">
                    {data.learningElement.displayName}
                  </span>{' '}
                  erfolgreich absolviert.
                </p>
              </div>
              <div>
                <div className="flex flex-row items-center justify-between">
                  <H3 className={{ root: 'flex flex-row justify-between' }}>
                    Auswertung
                  </H3>
                  <H3>Punkte (gesammelt/berechnet/möglich)</H3>
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
                        <div>Not attempted</div>
                      )}
                    </div>
                  ))}
                </div>

                <H3 className={{ root: 'mt-4 text-right' }}>
                  Total Punkte (gesammelt): {totalPointsAwarded}
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
                      <div className="text-sm md:text-base text-slate-500">
                        Frage {currentIx + 1}/
                        {data.learningElement?.instances?.length}
                      </div>
                    </div>

                    <div className="pb-2">
                      <Markdown content={questionData.content} />
                    </div>
                    <OptionsDisplay
                      isEvaluation={isEvaluation}
                      evaluation={currentInstance.evaluation}
                      response={response}
                      onChangeResponse={setResponse}
                      onSubmitResponse={
                        isEvaluation ? handleNextQuestion : handleSubmitResponse
                      }
                      questionType={questionData.type}
                      options={questionData.options}
                    />
                  </div>

                  {currentInstance.evaluation && (
                    <div className="flex-1 p-4 space-y-4 border rounded bg-gray-50 basis-1/3">
                      <div className="flex flex-row gap-2">
                        <div className="font-bold">Multiplikator</div>
                        <div>{currentInstance.pointsMultiplier}x</div>
                      </div>
                      <div className="flex flex-row gap-8">
                        <div>
                          <div className="font-bold">Berechnet</div>
                          <div className="text-xl">
                            {currentInstance.evaluation.score} Punkte
                          </div>
                        </div>

                        <div>
                          <div className="font-bold">Gesammelt</div>
                          <div className="text-xl">
                            {currentInstance.evaluation.pointsAwarded} Punkte
                          </div>
                        </div>
                      </div>

                      <EvaluationDisplay
                        options={questionData.options}
                        questionType={questionData.type}
                        evaluation={currentInstance.evaluation}
                      />

                      <div>
                        <div className="font-bold">Erneute Punkte ab:</div>
                        <div>
                          {dayjs(
                            currentInstance.evaluation.newPointsFrom
                          ).format('DD.MM.YYYY HH:mm')}
                        </div>
                      </div>
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
                  (data.learningElement?.instances?.length ?? 0) > 15
                    ? 3
                    : undefined
                }
                formatter={(v) => v}
                value={currentIx}
                max={data.learningElement?.instances?.length ?? 0}
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

  if (!result.data.learningElement) {
    return {
      redirect: {
        destination: '/404',
        statusCode: 302,
      },
    }
  }

  return addApolloState(apolloClient, {
    props: {
      id: ctx.params.id,
      courseId: ctx.params.courseId,
    },
  })
}

export default LearningElement
