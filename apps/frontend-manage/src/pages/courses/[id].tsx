import { useQuery } from '@apollo/client'
import CourseDescription from '@components/courses/CourseDescription'
import { faPencil } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { GetSingleCourseDocument } from '@klicker-uzh/graphql/dist/ops'
import Markdown from '@klicker-uzh/markdown'
import { Button, H2 } from '@uzh-bf/design-system'
import { useRouter } from 'next/router'
import { useState } from 'react'
import Layout from '../../components/Layout'

function CourseOverviewPage() {
  const router = useRouter()
  const [descriptionEditMode, setDescriptionEditMode] = useState(false)

  const {
    loading: loadingCourse,
    error: errorCourse,
    data: dataCourse,
  } = useQuery(GetSingleCourseDocument, {
    variables: { courseId: router.query.id as string },
  })

  console.log(dataCourse)

  if (loadingCourse) return <div>Loading...</div>
  if ((!dataCourse && !loadingCourse) || errorCourse) {
    router.push('/404')
  }

  return (
    <Layout>
      <div className="w-full">
        <H2>Kurs: {dataCourse?.course?.displayName}</H2>
        {dataCourse?.course?.description ? (
          descriptionEditMode ? (
            <CourseDescription
              description={dataCourse?.course?.description}
              courseId={router.query.id as string}
              submitText="Beschreibung speichern"
              setDescriptionEditMode={setDescriptionEditMode}
            />
          ) : (
            <div className="flex flex-row gap-2 border border-solid rounded border-uzh-grey-80">
              <Markdown
                content={dataCourse.course.description}
                className="w-full p-2 rounded"
              />
              <Button onClick={() => setDescriptionEditMode(true)}>
                <Button.Icon>
                  <FontAwesomeIcon icon={faPencil} />
                </Button.Icon>
                <Button.Label>Beschreibung bearbeiten</Button.Label>
              </Button>
            </div>
          )
        ) : (
          <CourseDescription
            description={dataCourse?.course?.description ?? '<br>'}
            courseId={router.query.id as string}
            submitText="Beschreibung hinzufügen"
            setDescriptionEditMode={setDescriptionEditMode}
          />
        )}
      </div>
    </Layout>
  )
}

export default CourseOverviewPage
