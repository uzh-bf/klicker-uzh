import { useQuery } from '@apollo/client'
import {
  GetBasicCourseInformationDocument,
  SelfDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { GetServerSideProps } from 'next'
import Layout from '../../../components/Layout'

function JoinCourse({ courseId }: { courseId: string }) {
  const { loading: loadingParticipant, data: dataParticipant } =
    useQuery(SelfDocument)
  const { loading: loadingCourse, data: dataCourse } = useQuery(
    GetBasicCourseInformationDocument,
    {
      variables: {
        courseId: courseId,
      },
      pollInterval: 10000,
      skip: !courseId,
    }
  )

  console.log(dataCourse)

  // TODO: implement join course and register at the same time query

  // TODO: detect if the user is logged in already and if so, reuse the join course query to join the course or create new join course query

  if (loadingParticipant || loadingCourse) {
    return <div>Loading...</div>
  }

  // TODO: replace this by a corresponding redirect to 404 in the getServerSideProps function
  if (!dataCourse) {
    return <div>COURSE NOT AVAILABLE</div>
  }

  return (
    <Layout
      displayName="Kurs beitreten"
      courseName={dataCourse?.basicCourseInformation.displayName} // course.displayName
      courseColor={'red'} // course.color
    >
      {dataParticipant?.self ? (
        <div>Join Course with existing account</div>
      ) : (
        <div>Join course while creating a new account</div>
      )}
    </Layout>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  if (typeof ctx.params?.courseId !== 'string') {
    return {
      redirect: {
        destination: '/404',
        statusCode: 302,
      },
    }
  }

  return {
    props: {
      courseId: ctx.params.courseId,
    },
  }
}

export default JoinCourse

// ! TEST CASES
// 1. Course does not exist
// 2. Course exists, user is not logged in
// 3. Course exists, user is logged in
// 4. Course exists, user is logged in and already joined the course
