import { extractLtiData } from '@klicker-uzh/lti'
import { GetServerSideProps } from 'next'

function CourseOverview({ context }: any) {
  return (
    <div className="flex flex-row p-4">
      <pre>
        <code>{JSON.stringify(context, null, 2)}</code>
      </pre>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const ltiContext = await extractLtiData({
    ctx,
    key: 'key',
    secret: 'secret',
  })
  console.warn(ltiContext)
  return {
    props: {
      context: {},
    },
  }
}

export default CourseOverview
