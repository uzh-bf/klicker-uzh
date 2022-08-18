import bodyParser from 'body-parser'
import { GetServerSideProps } from 'next'

function CourseOverview({ context }: any) {
  return <div className="flex flex-row p-4"></div>
}

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  const { request, response } = await new Promise((resolve) => {
    bodyParser.urlencoded({ extended: true })(req, res, () => {
      bodyParser.json()(req, res, () => {
        resolve({ request: req, response: res })
      })
    })
  })

  // TODO: ...

  return {
    props: {
      context: {},
    },
  }
}

export default CourseOverview
