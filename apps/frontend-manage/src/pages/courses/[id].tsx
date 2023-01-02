import { useQuery } from '@apollo/client'
import QRPopup from '@components/sessions/cockpit/QRPopup'
import { faPencil } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { GetSingleCourseDocument } from '@klicker-uzh/graphql/dist/ops'
import Markdown from '@klicker-uzh/markdown'
import { Button, H1, H2, H3, ThemeContext } from '@uzh-bf/design-system'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useContext, useEffect, useState } from 'react'
import { SESSION_STATUS } from 'shared-components/src/constants'
import Leaderboard from 'shared-components/src/Leaderboard'
import CourseDescription from '../../components/courses/CourseDescription'
import LearningElementTile from '../../components/courses/LearningElementTile'
import MicroSessionTile from '../../components/courses/MicroSession'
import SessionTile from '../../components/courses/SessionTile'
import Layout from '../../components/Layout'

function CourseOverviewPage() {
  const router = useRouter()
  const theme = useContext(ThemeContext)

  const [descriptionEditMode, setDescriptionEditMode] = useState(false)

  const { loading, error, data } = useQuery(GetSingleCourseDocument, {
    variables: { courseId: router.query.id as string },
    skip: !router.query.id,
  })

  useEffect(() => {
    if (data && !data.course) {
      router.push('/404')
    }
  }, [data, router])

  if (error) {
    return <div>{error.message}</div>
  }

  if (loading || !data?.course) return <div>Loading...</div>

  const { course } = data

  const sortingOrderSessions: Record<string, number> = {
    [SESSION_STATUS.RUNNING]: 0,
    [SESSION_STATUS.SCHEDULED]: 1,
    [SESSION_STATUS.PREPARED]: 2,
    [SESSION_STATUS.COMPLETED]: 3,
  }

  return (
    <Layout>
      <div className="w-full mb-4">
        <div className="flex flex-row items-center justify-between">
          <H1>
            Kurs: {course.name} (PIN:{' '}
            {String(course.pinCode)
              .match(/.{1,3}/g)
              ?.join(' ')}
            )
          </H1>
          <div className="flex flex-row items-center gap-4 mb-2">
            <QRPopup
              relativeLink={`/course/${course.id}/join?pin=${course.pinCode}`}
              triggerText="Kurs beitreten"
              className={{ modal: 'w-[40rem]' }}
            >
              <H2>Kurs beitreten</H2>
              <Link
                href={`${process.env.NEXT_PUBLIC_PWA_URL}/course/${course.id}/join?pin=${course.pinCode}`}
                target="_blank"
                className={theme.primaryText}
              >{`${process.env.NEXT_PUBLIC_PWA_URL}/course/${course.id}/join?pin=${course.pinCode}`}</Link>

              <div className="mt-4">
                Der für den Beitritt benötigte PIN lautet:{' '}
                <span className="font-bold">
                  {String(course.pinCode)
                    .match(/.{1,3}/g)
                    ?.join(' ')}
                </span>
              </div>
            </QRPopup>
            <div className="italic">
              {course.numOfParticipants} Teilnehmende
            </div>
          </div>
        </div>
        {course.description ? (
          descriptionEditMode ? (
            <CourseDescription
              description={course.description}
              courseId={router.query.id as string}
              submitText="Beschreibung speichern"
              setDescriptionEditMode={setDescriptionEditMode}
            />
          ) : (
            <div className="flex flex-row gap-2 border border-solid rounded border-uzh-grey-80">
              <Markdown
                content={course.description}
                className="w-full p-2 rounded"
              />
              <Button
                onClick={() => setDescriptionEditMode(true)}
                className={{ root: 'h-10' }}
              >
                <Button.Icon>
                  <FontAwesomeIcon icon={faPencil} />
                </Button.Icon>
              </Button>
            </div>
          )
        ) : (
          <CourseDescription
            description={course.description ?? '<br>'}
            courseId={router.query.id as string}
            submitText="Beschreibung hinzufügen"
            setDescriptionEditMode={setDescriptionEditMode}
          />
        )}
      </div>
      <div className="flex flex-col md:flex-row">
        <div className="w-full md:w-2/3 md:border-r-[0.1rem] md:border-solid md:border-uzh-grey-80">
          <div className="mb-4">
            <H3>Sessionen</H3>
            {course.sessions && course.sessions.length > 0 ? (
              <div className="flex flex-col gap-2 overflow-x-scroll sm:flex-row">
                {course.sessions
                  .sort((a, b) => {
                    return (
                      sortingOrderSessions[a.status] -
                      sortingOrderSessions[b.status]
                    )
                  })
                  .map((session) => (
                    <SessionTile session={session} key={session.id} />
                  ))}
              </div>
            ) : (
              <div>Keine Sessionen vorhanden</div>
            )}
          </div>
          <div className="mb-4">
            <H3>Lernelemente</H3>
            {course.learningElements && course.learningElements.length > 0 ? (
              <div className="flex flex-col gap-2 overflow-x-scroll sm:flex-row">
                {course.learningElements.map((learningElement) => (
                  <LearningElementTile
                    learningElement={learningElement}
                    key={learningElement.id}
                  />
                ))}
              </div>
            ) : (
              <div>Keine Lernelemente vorhanden</div>
            )}
          </div>
          <div className="mb-4">
            <H3>Micro-Sessions</H3>
            {course.microSessions && course.microSessions.length > 0 ? (
              <div className="flex flex-col gap-2 overflow-x-scroll sm:flex-row">
                {course.microSessions.map((microSession) => (
                  <MicroSessionTile
                    microSession={microSession}
                    key={microSession.id}
                  />
                ))}
              </div>
            ) : (
              <div>Keine Micro-Sessions vorhanden</div>
            )}
          </div>
        </div>
        <div className="w-full md:w-1/3 md:pl-2">
          <H3>Kurs Leaderboard</H3>
          <Leaderboard
            className={{ root: 'max-h-[31rem] overflow-y-scroll' }}
            leaderboard={course.leaderboard ?? []}
          />
          <div className="mt-2 text-sm italic text-right text-gray-500">
            <div>
              Teilnehmende Leaderboard: {course.numOfActiveParticipants}
            </div>
            <div>
              Durchschnittl. Punkte: {course.averageActiveScore?.toFixed(2)}
            </div>
            <div className="mt-1">
              Kursteilnehmende: {course.numOfParticipants}
            </div>
            <div>Durchschnittl. Punkte: {course.averageScore?.toFixed(2)}</div>
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default CourseOverviewPage
