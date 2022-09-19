import { useMutation, useQuery } from '@apollo/client'
import EvaluationDisplay from '@components/EvaluationDisplay'
import Layout from '@components/Layout'
import OptionsDisplay from '@components/OptionsDisplay'
import {
  GetMicroSessionDocument,
  ResponseToQuestionInstanceDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Markdown from '@klicker-uzh/markdown'
import { addApolloState, initializeApollo } from '@lib/apollo'
import { QuestionType } from '@type/app'
import { Progress } from '@uzh-bf/design-system'
import { GetStaticPaths, GetStaticProps } from 'next'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'

interface Props {
  id: string
  ix: number
}

// TODO: leaderboard and points screen after all questions have been completed?
// TODO: different question types (FREE and RANGE)
function MicroSessionInstance({ id, ix }: Props) {
  const [response, setResponse] = useState<number[] | string | null>(null)

  const router = useRouter()

  const { loading, error, data } = useQuery(GetMicroSessionDocument, {
    variables: { id },
  })

  const currentInstance = data?.microSession?.instances?.[Number(ix)]
  const questionData = currentInstance?.questionData

  useEffect(() => {
    if (questionData?.type) {
      if (
        questionData.type === QuestionType.SC ||
        questionData.type === QuestionType.MC
      ) {
        setResponse([])
      } else {
        setResponse('')
      }
    } else {
      setResponse(null)
    }
  }, [questionData?.type, ix])

  const [respondToQuestionInstance] = useMutation(
    ResponseToQuestionInstanceDocument
  )

  if (loading || !data?.microSession) return <p>Loading...</p>
  if (error) return <p>Oh no... {error.message}</p>

  const isEvaluation = !!currentInstance?.evaluation

  const handleSubmitResponse = () => {
    if (!response) return
    respondToQuestionInstance({
      variables: {
        courseId: data.microSession!.course.id as string,
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
    const nextIx = Number(ix) + 1
    if (nextIx === data?.microSession?.instances?.length) {
      router.push(`/micro/${id}/evaluation`)
    } else {
      router.push(`/micro/${id}/${nextIx}`)
    }
  }

  return (
    <Layout
      displayName={data.microSession.displayName}
      courseName={data.microSession.course.displayName}
      courseColor={data.microSession.course.color}
    >
      <div className="flex flex-col md:max-w-5xl md:m-auto md:w-full">
        <div className="order-2 pt-0 md:p-8 md:border md:border-b-0 md:pt-8 md:order-2 md:rounded-t">
          {questionData && (
            <div className="flex flex-col gap-4 md:flex-row">
              <div className="flex-1 basis-2/3">
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
                  questionType={questionData.type as QuestionType}
                  options={questionData.options}
                />
              </div>

              {currentInstance.evaluation && (
                <div className="flex-1 p-4 border rounded basis-1/3 bg-gray-50">
                  <EvaluationDisplay
                    options={questionData.options}
                    questionType={questionData.type}
                    evaluation={currentInstance.evaluation}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="order-1 pb-4 md:p-8 md:pt-0 md:border md:border-t-0 md:order-3 md:rounded-b">
          <Progress
            isMaxVisible
            formatter={(v) => v}
            value={isEvaluation ? Number(ix) + 1 : Number(ix)}
            max={data.microSession?.instances?.length ?? 0}
          />
        </div>
      </div>
    </Layout>
  )
}

export const getStaticProps: GetStaticProps = async (ctx) => {
  if (typeof ctx.params?.id !== 'string') {
    return {
      redirect: {
        destination: '/404',
        permanent: false,
      },
    }
  }

  const apolloClient = initializeApollo()

  try {
    await apolloClient.query({
      query: GetMicroSessionDocument,
      variables: { id: ctx.params.id },
      fetchPolicy: 'cache-first',
    })
  } catch (e) {
    return {
      redirect: {
        destination: '/404',
        permanent: false,
      },
    }
  }

  return addApolloState(apolloClient, {
    props: {
      id: ctx.params.id,
      ix: ctx.params.ix,
    },
    revalidate: 60,
  })
}

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: [],
    fallback: 'blocking',
  }
}

export default MicroSessionInstance
