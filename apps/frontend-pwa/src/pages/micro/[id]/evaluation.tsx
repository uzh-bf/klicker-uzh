import { useMutation, useQuery } from '@apollo/client'
import Layout from '@components/Layout'
import {
  GetMicroSessionDocument,
  MarkMicroSessionCompletedDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, H3 } from '@uzh-bf/design-system'
import { useRouter } from 'next/router'
import { useMemo } from 'react'

function Evaluation() {
  const router = useRouter()

  const id = router.query.id as string
  const { loading, error, data } = useQuery(GetMicroSessionDocument, {
    variables: { id },
    skip: !id,
    fetchPolicy: 'cache-only',
  })

  const [markMicroSessionCompleted] = useMutation(
    MarkMicroSessionCompletedDocument
  )

  const totalPointsAwarded = useMemo(() => {
    if (!data?.microSession) return 0
    return data.microSession.instances.reduce(
      (acc, instance) => acc + instance.evaluation?.pointsAwarded,
      0
    )
  }, [data?.microSession?.instances])

  if (loading || !data?.microSession) {
    return <div>loading</div>
  }

  return (
    <Layout
      displayName={data.microSession.displayName}
      courseName={data.microSession.course.displayName}
      courseColor={data.microSession.course.color}
    >
      <div className="flex flex-col gap-3 md:max-w-5xl md:mx-auto md:w-full md:mb-4 md:p-8 md:pt-6 md:border md:rounded">
        <div>
          <H3>Gratulation!</H3>
          <p>
            Du hast das Microlearning{' '}
            <span className="italic">{data.microSession.displayName}</span>{' '}
            erfolgreich absolviert.
          </p>
        </div>
        <div>
          <div className="flex flex-row items-center justify-between">
            <H3 className="flex flex-row justify-between">Auswertung</H3>
            <H3>Punkte (gesammelt/berechnet/möglich)</H3>
          </div>
          <div>
            {data.microSession.instances.map((instance) => (
              <div className="flex flex-row justify-between">
                <div>{instance.questionData.name}</div>
                <div>
                  {instance.evaluation.pointsAwarded}/
                  {instance.evaluation.score}/10
                </div>
              </div>
            ))}
          </div>

          <H3 className="mt-4 text-right">
            Total Punkte (gesammelt): {totalPointsAwarded}
          </H3>
        </div>
        <div className="text-right">
          <Button
            onClick={async () => {
              await markMicroSessionCompleted({
                variables: {
                  courseId: data.microSession!.course.id,
                  id,
                },
              })
              router.replace('/')
            }}
          >
            Abschliessen
          </Button>
        </div>
      </div>
    </Layout>
  )
}

export default Evaluation
