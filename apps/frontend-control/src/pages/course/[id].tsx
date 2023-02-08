import { useQuery } from '@apollo/client'
import {
  GetControlCourseDocument,
  SessionStatus,
} from '@klicker-uzh/graphql/dist/ops'
import { UserNotification } from '@uzh-bf/design-system'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import Layout from '../../components/Layout'
import SessionLists from '../../components/sessions/SessionLists'

function Course() {
  const router = useRouter()

  const { loading, error, data } = useQuery(GetControlCourseDocument, {
    variables: { courseId: router.query.id as string },
    skip: !router.query.id,
  })

  useEffect(() => {
    if (data && !data.controlCourse) {
      router.push('/404')
    }
  }, [data, router])

  if (loading) {
    return <Layout title="Kursübersicht">Loading...</Layout>
  }
  if (!data?.controlCourse || error) {
    return (
      <Layout title="Kursübersicht">
        <UserNotification
          notificationType="error"
          className={{ root: 'text-base' }}
          message="Es ist ein Fehler aufgetreten beim Laden Ihrer Kurse. Bitte versuchen
        Sie es später erneut."
        />
      </Layout>
    )
  }

  const { controlCourse } = data

  const runningSessions = controlCourse.sessions.filter(
    (session) => session.status === SessionStatus.Running
  )
  const plannedSessions = controlCourse.sessions.filter(
    (session) =>
      session.status === SessionStatus.Prepared ||
      session.status === SessionStatus.Scheduled
  )

  return (
    <Layout title={controlCourse.name}>
      <SessionLists
        runningSessions={runningSessions}
        plannedSessions={plannedSessions}
      />

      <div className="mt-4 text-base italic">
        Abgeschlossene Sessionen können auf der entsprechenden Seite in der
        Management-App mit Resultaten betrachtet werden.
      </div>
    </Layout>
  )
}

export default Course
