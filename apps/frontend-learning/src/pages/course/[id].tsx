import getLtiContext from '@klicker-uzh/lti'

function CourseOverview({ context }: any) {
  return (
    <div className="flex flex-row p-4">
      <pre>
        <code>{JSON.stringify(context, null, 2)}</code>
      </pre>
    </div>
  )
}

export const getServerSideProps = async (ctx: any) => {
  const ltiContext = await getLtiContext({
    ctx,
    key: 'key',
    secret: 'secret',
    persist: false,
    cookieOptions: {
      path: '/',
    },
  })
  console.warn(ltiContext)
  return {
    props: {
      context: ltiContext,
    },
  }
}

export default CourseOverview
