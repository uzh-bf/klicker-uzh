import { useQuery } from '@apollo/client'
import Layout from '@components/Layout'
import {
  MicroSession,
  ParticipationsDocument,
  Session,
} from '@klicker-uzh/graphql/dist/ops'
import { H1 } from '@uzh-bf/design-system'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useMemo } from 'react'

const Index = function () {
  const { data, loading, error } = useQuery(ParticipationsDocument)
  const router = useRouter()

  const {
    courses,
    activeSessions,
    activeMicrolearning,
  }: {
    courses: { id: string; displayName: string }[]
    activeSessions: Session[]
    activeMicrolearning: MicroSession[]
  } = useMemo(() => {
    const obj = { courses: [], activeSessions: [], activeMicrolearning: [] }
    if (!data?.participations) return obj
    return data.participations.reduce((acc, participation) => {
      return {
        courses: [
          ...acc.courses,
          {
            id: participation.course.id,
            displayName: participation.course.displayName,
          },
        ],
        activeSessions: [
          ...acc.activeSessions,
          ...participation.course?.sessions,
        ],
        activeMicrolearning: [
          ...acc.activeMicrolearning,
          ...participation.course?.microSessions,
        ],
      }
    }, obj)
  }, [data])

  if (!loading && !data) {
    router.push('/login')
  }
  if (loading || !data) {
    return <div>loading</div>
  }

  return (
    <Layout>
      <div className="p-4">
        <H1>Aktive Sessions</H1>
        <div>
          {activeSessions.length === 0 && <div>Keine aktiven Sessions.</div>}
          {activeSessions.map((session) => (
            <div key={session.id}>
              <Link href={`/session/${session.id}`}>{session.displayName}</Link>
            </div>
          ))}
        </div>

        <H1>Verfügbares Microlearning</H1>
        <div>
          {activeMicrolearning.length === 0 && (
            <div>Kein aktives Microlearning.</div>
          )}
          {activeMicrolearning.map((micro: any) => (
            <div key={micro.id}>{micro.displayName}</div>
          ))}
        </div>

        <H1>Kurse</H1>
        <div>
          {courses.map((course: any) => (
            <div key={course.id}>{course.displayName}</div>
          ))}
        </div>
      </div>
    </Layout>
  )
}

export default Index
