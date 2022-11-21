import { useQuery } from '@apollo/client'
import { faPeopleGroup } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { GetUserCoursesDocument } from '@klicker-uzh/graphql/dist/ops'
import { Button, H3 } from '@uzh-bf/design-system'
import { useRouter } from 'next/router'

import Layout from '../../components/Layout'

function CourseSelectionPage() {
  const router = useRouter()
  const {
    loading: loadingCourses,
    error: errorCourses,
    data: dataCourses,
  } = useQuery(GetUserCoursesDocument)

  return (
    <Layout>
      <div className="flex items-center justify-center w-full">
        {dataCourses?.userCourses ? (
          <div className="md:w-[30rem] w-[20rem]">
            <H3>Bitte wählen Sie einen Kurs aus:</H3>
            <div className="flex flex-col gap-2">
              {dataCourses.userCourses.map((course) => (
                <Button
                  key={course.id}
                  className="p-2 border border-solid rounded-md bg-uzh-grey-40 border-uzh-grey-100"
                  onClick={() => router.push(`/courses/${course.id}`)}
                >
                  <Button.Icon className="ml-1 mr-3">
                    <FontAwesomeIcon icon={faPeopleGroup} />
                  </Button.Icon>
                  <Button.Label>{course.displayName}</Button.Label>
                </Button>
              ))}
              {/* // TODO: Create course */}
            </div>
          </div>
        ) : (
          <div>
            <H3>Keine Kurse gefunden...</H3>
            {/* // TODO: Create course */}
            <div>Jetzt einen Kurs erstellen!</div>
          </div>
        )}
      </div>
    </Layout>
  )
}

export default CourseSelectionPage
