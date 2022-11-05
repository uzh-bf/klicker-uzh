import { useQuery } from '@apollo/client'
import Layout from '@components/Layout'
import { Options } from '@components/OptionsDisplay'
import { GroupActivityDetailsDocument } from '@klicker-uzh/graphql/dist/ops'
import Markdown from '@klicker-uzh/markdown'
import { H2 } from '@uzh-bf/design-system'
import { useRouter } from 'next/router'

function GroupActivityDetails() {
  const router = useRouter()

  const { data } = useQuery(GroupActivityDetailsDocument, {
    variables: {
      groupId: router.query.groupId,
      activityId: router.query.activityId,
    },
  })

  return (
    <Layout displayName={data?.groupActivityDetails?.displayName}>
      <div className="max-w-5xl mx-auto">
        <H2>Ausgangslage</H2>
        <Markdown
          className="prose max-w-none prose-img:max-w-lg prose-img:mx-auto"
          content={data?.groupActivityDetails?.description}
        />

        <H2>Deine Hinweise</H2>
        <div className="space-y-1">
          {data?.groupActivityDetails?.clues.map((clue) => (
            <div key={clue.id} className="border-b last:border-b-0">
              <span className="font-bold">{clue.displayName}:</span>{' '}
              {clue.type === 'NUMBER'
                ? Number(clue.value).toLocaleString()
                : clue.value}{' '}
              {clue.unit}
            </div>
          ))}
        </div>

        <H2 className="mt-4">Aufgaben</H2>
        <div className="">
          {data?.groupActivityDetails?.instances.map((instance) => (
            <div key={instance.id} className="py-4 border-b last:border-b-0">
              <Markdown content={instance.questionData.content} />
              <Options
              isCompact
                questionType={instance.questionData.type}
                options={instance.questionData.options}
              />
            </div>
          ))}
        </div>
      </div>
    </Layout>
  )
}

export default GroupActivityDetails
