import { useQuery } from '@apollo/client'
import { faPeopleGroup, faPlusCircle } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { GetUserCoursesDocument } from '@klicker-uzh/graphql/dist/ops'
import { Button, H3 } from '@uzh-bf/design-system'
import { useRouter } from 'next/router'

import { useState } from 'react'
import Layout from '../../components/Layout'
import CourseCreationModal from '../../components/courses/modals/CourseCreationModal'

function CourseSelectionPage() {
  const router = useRouter()
  const [createCourseModal, showCreateCourseModal] = useState(false)
  const {
    loading: loadingCourses,
    error: errorCourses,
    data: dataCourses,
  } = useQuery(GetUserCoursesDocument)

  if (loadingCourses) {
    return <Layout>Loading...</Layout>
  }

  // TODO: refactor buttons to use identical component with custom text / icon / onClick function

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
                  className={{
                    root: 'p-2 border border-solid rounded-md bg-uzh-grey-40 border-uzh-grey-100',
                  }}
                  onClick={() => router.push(`/courses/${course.id}`)}
                >
                  <Button.Icon className={{ root: 'ml-1 mr-3' }}>
                    <FontAwesomeIcon icon={faPeopleGroup} />
                  </Button.Icon>
                  <Button.Label>{course.displayName}</Button.Label>
                </Button>
              ))}
              <Button
                className={{
                  root: 'p-2 border border-solid rounded-md bg-uzh-grey-40 border-uzh-grey-100',
                }}
                onClick={() => showCreateCourseModal(true)}
              >
                <Button.Icon className={{ root: 'ml-1 mr-3' }}>
                  <FontAwesomeIcon icon={faPlusCircle} />
                </Button.Icon>
                <Button.Label>Neuen Kurs erstellen</Button.Label>
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <H3>Keine Kurse gefunden...</H3>
            {/* // TODO: Create course */}
            <Button
              className={{
                root: 'p-2 border border-solid rounded-md bg-uzh-grey-40 border-uzh-grey-100',
              }}
              onClick={() => showCreateCourseModal(true)}
            >
              <Button.Icon className={{ root: 'ml-1 mr-3' }}>
                <FontAwesomeIcon icon={faPlusCircle} />
              </Button.Icon>
              <Button.Label>Jetzt einen Kurs erstellen!</Button.Label>
            </Button>
          </div>
        )}
        <CourseCreationModal
          modalOpen={createCourseModal}
          onModalClose={() => showCreateCourseModal(false)}
        />
      </div>
    </Layout>
  )
}

export default CourseSelectionPage
