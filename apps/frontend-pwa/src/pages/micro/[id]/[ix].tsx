import { useMutation, useQuery } from '@apollo/client'
import {
  GetMicroSessionDocument,
  QuestionType,
  ResponseToQuestionInstanceDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Markdown from '@klicker-uzh/markdown'
import formatResponse from '@lib/formatResponse'
import { H3, Progress } from '@uzh-bf/design-system'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import Footer from '../../../components/common/Footer'
import EvaluationDisplay from '../../../components/EvaluationDisplay'
import Layout from '../../../components/Layout'
import OptionsDisplay from '../../../components/OptionsDisplay'

// TODO: different question types (FREE and RANGE)
function MicroSessionInstance() {
  const [response, setResponse] = useState<{} | number[] | string | null>(null)

  const router = useRouter()

  const ix = router.query.ix as string
  const id = router.query.id as string

  const { loading, error, data } = useQuery(GetMicroSessionDocument, {
    variables: { id },
    skip: !id,
  })

  const currentInstance = data?.microSession?.instances?.[Number(ix)]
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
        response: formatResponse(questionData, response),
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
      course={data.microSession.course ?? undefined}
    >
      <div className="flex-1">
        <div className="flex flex-col gap-6 md:max-w-5xl md:mx-auto md:w-full md:mb-4 md:p-8 md:pt-6 md:border md:rounded">
          {questionData && (
            <div className="flex flex-col order-2 gap-4 md:gap-8 md:flex-row md:order-1">
              <div className="flex-1 basis-2/3">
                <div className="flex flex-row items-end justify-between mb-4 border-b">
                  <H3 className={{ root: 'mb-0' }}>{questionData.name}</H3>
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
                  questionType={questionData.type as QuestionType}
                  options={questionData.options}
                />
              </div>

              {currentInstance.evaluation && (
                <div className="flex-1 p-4 space-y-4 border rounded basis-1/3 bg-gray-50">
                  <div className="flex flex-row gap-8">
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
                </div>
              )}
            </div>
          )}

          {currentInstance && (
            <div className="order-1 md:order-2">
              <Progress
                isMaxVisible
                formatter={(v) => v}
                value={ix}
                max={data.microSession?.instances?.length ?? 0}
              />
            </div>
          )}
        </div>
      </div>
      <Footer />
    </Layout>
  )
}

export default MicroSessionInstance
