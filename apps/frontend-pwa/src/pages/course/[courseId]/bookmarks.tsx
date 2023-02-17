import { useQuery } from '@apollo/client'
import {
  GetBasicCourseInformationDocument,
  GetBookmarkedQuestionsDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { H1 } from '@uzh-bf/design-system'
import { useRouter } from 'next/router'
import Layout from '../../../components/Layout'

function Bookmarks() {
  const router = useRouter()
  const { data } = useQuery(GetBookmarkedQuestionsDocument, {
    variables: { courseId: router.query.courseId as string },
    skip: !router.query.courseId,
  })

  const { data: courseData } = useQuery(GetBasicCourseInformationDocument, {
    variables: { courseId: router.query.courseId as string },
  })

  // TODO: replace with learning element implementation including all questions
  // TODO: add navigation that is possible by name

  return (
    <Layout
      course={courseData?.basicCourseInformation ?? undefined}
      displayName="Bookmarks"
    >
      <div className="flex flex-col gap-2 md:w-full md:max-w-xl md:p-8 md:mx-auto md:border md:rounded">
        <H1 className={{ root: 'text-xl' }}>
          Bookmarks {courseData?.basicCourseInformation?.displayName}
        </H1>
        {data?.getBookmarkedQuestions?.map((question) => (
          <div key={question.id}>{question.questionData.name}</div>
        ))}
      </div>
    </Layout>
  )
}

export default Bookmarks
