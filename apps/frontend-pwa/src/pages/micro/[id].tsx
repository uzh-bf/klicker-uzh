import { useQuery } from '@apollo/client'
import EvaluationDisplay from '@components/EvaluationDisplay'
import OptionsDisplay from '@components/OptionsDisplay'
import { GetMicroSessionDocument } from '@klicker-uzh/graphql/dist/ops'
import Markdown from '@klicker-uzh/markdown'
import { Progress } from '@uzh-bf/design-system'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useState } from 'react'

const PLACEHOLDER_IMG =
  'https://sos-ch-dk-2.exo.io/klicker-uzh-dev/avatars/placeholder.png'

interface Props {
  courseId: string
  id: string
}

// TODO: leaderboard and points screen after all questions have been completed?
// TODO: different question types (FREE and RANGE)
function MicroSession({ courseId, id }: Props) {
  const [response, setResponse] = useState<number[] | string | null>(null)
  const [currentIx, setCurrentIx] = useState(0)

  const router = useRouter()

  const { loading, error, data } = useQuery(GetMicroSessionDocument, {
    variables: { id: router.query?.id as string },
    skip: !router.query?.id,
  })

  // const [respondToQuestionInstance] = useMutation(
  //   ResponseToQuestionInstanceDocument
  // )

  if (loading || !data?.microSession) return <p>Loading...</p>
  if (error) return <p>Oh no... {error.message}</p>

  const currentInstance = data.microSession?.instances?.[currentIx]
  const questionData = currentInstance?.questionData

  const isEvaluation = !!currentInstance?.evaluation

  const handleSubmitResponse = () => {
    if (!response) return

    // respondToQuestionInstance({
    //   variables: {
    //     courseId: router.query.courseId as string,
    //     id: currentInstance?.id as number,
    //     response:
    //       questionData?.type === QuestionType.SC ||
    //       questionData?.type === QuestionType.MC
    //         ? {
    //             choices: response as number[],
    //           }
    //         : { value: response as string },
    //   },
    // })
  }

  const handleNextQuestion = () => {
    setCurrentIx((ix) => ix + 1)
    setResponse(null)
  }

  return (
    <div className="flex flex-col max-w-6xl m-auto">
      <div
        className="flex flex-row items-center justify-between order-1 px-4 py-2 font-bold text-white border-b-8 bg-slate-800"
        style={{ borderColor: data.microSession.course.color ?? 'green' }}
      >
        <div className="">{data.microSession.course.displayName}</div>
        <div className="relative w-auto h-8 aspect-square">
          <Image
            className="rounded-full"
            src={PLACEHOLDER_IMG}
            alt="Participant Avatar"
            layout="fill"
          />
        </div>
      </div>

      <div className="order-3 p-4 pt-0 md:border-l md:border-r md:pt-4 md:order-2">
        {questionData && (
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="flex-1">
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
              <div className="flex-1 p-4 border rounded bg-gray-50">
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

      <div className="order-2 p-4 border-0 md:pt-0 md:border md:border-t-0 md:order-3">
        <Progress
          isMaxVisible
          formatter={(v) => v}
          value={currentIx}
          max={data.microSession?.instances?.length ?? 0}
        />
      </div>
    </div>
  )
}

// export const getStaticProps: GetStaticProps = async (ctx) => {
//   if (
//     typeof ctx.params?.courseId !== 'string' ||
//     typeof ctx.params?.id !== 'string'
//   ) {
//     return {
//       redirect: {
//         destination: '/404',
//         permanent: false,
//       },
//     }
//   }

//   const apolloClient = initializeApollo()

//   try {
//     await apolloClient.query({
//       query: GetLearningElementDocument,
//       variables: { id: ctx.params.id },
//     })
//   } catch (e) {
//     return {
//       redirect: {
//         destination: '/404',
//         permanent: false,
//       },
//     }
//   }

//   return addApolloState(apolloClient, {
//     props: {
//       id: ctx.params.id,
//       courseId: ctx.params.courseId,
//     },
//     revalidate: 60,
//   })
// }

// export const getStaticPaths: GetStaticPaths = async () => {
//   return {
//     paths: [],
//     fallback: 'blocking',
//   }
// }

export default MicroSession
