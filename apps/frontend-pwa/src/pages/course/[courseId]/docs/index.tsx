import { useQuery } from '@apollo/client'
import { GetBasicCourseInformationDocument } from '@klicker-uzh/graphql/dist/ops'
import Markdown from '@klicker-uzh/markdown'
import { useRouter } from 'next/router'
import CommonDocs from 'src/components/CommonDocs'
import Layout from 'src/components/Layout'

function Landing() {
  const router = useRouter()

  const { data } = useQuery(GetBasicCourseInformationDocument, {
    variables: { courseId: router.query.courseId as string },
    skip: !router.query?.courseId,
  })

  if (!data?.basicCourseInformation) {
    return <div>Loading...</div>
  }

  return (
    <Layout
      courseName={data.basicCourseInformation.name}
      displayName="Dokumentation"
      courseColor={data.basicCourseInformation.color}
    >
      <CommonDocs />
      <Markdown content={data.basicCourseInformation.description} />
    </Layout>
  )
}

export default Landing
