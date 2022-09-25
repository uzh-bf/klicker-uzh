import { useMutation, useQuery } from '@apollo/client'
import Footer from '@components/common/Footer'
import EvaluationDisplay from '@components/EvaluationDisplay'
import Layout from '@components/Layout'
import OptionsDisplay from '@components/OptionsDisplay'
import {
  GetLearningElementDocument,
  ResponseToQuestionInstanceDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Markdown from '@klicker-uzh/markdown'
import { addApolloState, initializeApollo } from '@lib/apollo'
import { getParticipantToken } from '@lib/token'
import { QuestionType } from '@type/app'
import { H3, Progress } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { GetServerSideProps } from 'next'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'

interface Props {
  courseId: string
  id: string
}

// TODO: leaderboard and points screen after all questions have been completed?
// TODO: different question types (FREE and RANGE)
function LearningElement({ courseId, id }: Props) {
  const [response, setResponse] = useState<number[] | string | null>(null)
  const [currentIx, setCurrentIx] = useState(0)

  const router = useRouter()

  const { loading, error, data } = useQuery(GetLearningElementDocument, {
    variables: { id },
  })

  const currentInstance = data?.learningElement?.instances?.[currentIx]
  const questionData = currentInstance?.questionData

  useEffect(() => {
    if (questionData?.type) {
      if (
        questionData.type === QuestionType.SC ||
        questionData.type === QuestionType.MC ||
        questionData.type === QuestionType.KPRIM
      ) {
        setResponse([])
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
    return data.learningElement.instances.reduce(
      (acc, instance) => acc + instance.evaluation?.pointsAwarded,
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
        response:
          questionData?.type === QuestionType.SC ||
          questionData?.type === QuestionType.MC ||
          questionData?.type === QuestionType.KPRIM
            ? {
                choices: response as number[],
              }
            : { value: response as string },
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
      <div className="flex flex-col gap-6 md:max-w-5xl md:m-auto md:w-full md:mb-4 md:p-8 md:pt-6 md:border md:rounded">
        {!currentInstance && (
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
                <H3 className="flex flex-row justify-between">Auswertung</H3>
                <H3>Punkte (gesammelt/berechnet/möglich)</H3>
              </div>
              <div>
                {data.learningElement.instances.map((instance) => (
                  <div className="flex flex-row justify-between">
                    <div>{instance.questionData.name}</div>
                    <div>
                      {instance.evaluation.pointsAwarded} /{' '}
                      {instance.evaluation.score} / 10
                    </div>
                  </div>
                ))}
              </div>

              <H3 className="mt-4 text-right">
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
                  <div className="flex flex-row items-end justify-between mb-4 border-b">
                    <H3 className="mb-0">{questionData.name}</H3>
                    <div className="text-slate-500">{questionData.type}</div>
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
                    <div className="flex flex-row gap-8">
                      <div>
                        <div className="font-bold">Punkte (berechnet)</div>
                        <div className="text-xl">
                          {currentInstance.evaluation.score} Punkte
                        </div>
                      </div>

                      <div>
                        <div className="font-bold">Punkte (gesammelt)</div>
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
                        {dayjs(currentInstance.evaluation.newPointsFrom).format(
                          'DD.MM.YYYY HH:mm'
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {currentInstance && (
          <div className="order-1 md:order-2">
            <Progress
              isMaxVisible
              formatter={(v) => v}
              value={currentIx}
              max={data.learningElement?.instances?.length ?? 0}
            />
          </div>
        )}
      </div>

      <Footer
        browserLink={`https://pwa.klicker.uzh.ch/course/${courseId}/element/${id}`}
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
