import { useQuery } from '@apollo/client'
import CourseDescription from '@components/courses/CourseDescription'
import SessionTile from '@components/courses/SessionTile'
import { faPencil } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { GetSingleCourseDocument } from '@klicker-uzh/graphql/dist/ops'
import Markdown from '@klicker-uzh/markdown'
import { Button, H2, H3 } from '@uzh-bf/design-system'
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
      <div className="w-full mb-4">
        <H2>Kurs: {dataCourse?.course?.name}</H2>
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
      <div className="flex flex-col md:flex-row">
        <div className="w-full md:w-3/4">
          <div className="mb-4">
            <H3>Live Sessions</H3>
            {dataCourse?.course?.sessions &&
            dataCourse.course.sessions.length > 0 ? (
              <div className="flex flex-row gap-2 overflow-x-scroll">
                {dataCourse?.course?.sessions.map((session) => (
                  <SessionTile session={session} key={session.id} />
                ))}
              </div>
            ) : (
              <div>Keine Live Sessions vorhanden</div>
            )}
          </div>
          <div className="mb-4">
            <H3>Lernelemente</H3>
            {dataCourse?.course?.learningElements &&
            dataCourse.course.learningElements.length > 0 ? (
              <div className="flex flex-row gap-2 overflow-x-scroll">
                {dataCourse?.course?.learningElements.map((learningElement) => (
                  <div key={learningElement.id}>{learningElement.name}</div>
                ))}
              </div>
            ) : (
              <div>Keine Lernelemente vorhanden</div>
            )}
          </div>
          <div className="mb-4">
            <H3>Micro-Learnings</H3>
            {dataCourse?.course?.microSessions &&
            dataCourse.course.microSessions.length > 0 ? (
              <div className="flex flex-row gap-2 overflow-x-scroll">
                {dataCourse?.course?.microSessions.map((microSession) => (
                  <div key={microSession.id}>{microSession.name}</div>
                ))}
              </div>
            ) : (
              <div>Keine Micro-Learnings vorhanden</div>
            )}
          </div>
        </div>
        <div className="w-full md:w-1/4">
          <H3>Course Leaderboard</H3>
        </div>
      </div>
    </Layout>
  )
}

export default CourseOverviewPage
