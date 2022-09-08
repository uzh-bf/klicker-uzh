import { useQuery } from '@apollo/client'
import Layout from '@components/Layout'
import { ParticipationsDocument } from '@klicker-uzh/graphql/dist/ops'
import { NextPageWithLayout } from '@pages/_app'
import { H1 } from '@uzh-bf/design-system'
import { useMemo } from 'react'

const Index: NextPageWithLayout = function () {
  const { data, loading, error } = useQuery(ParticipationsDocument)

  const { courses, activeSessions, activeMicrolearning } = useMemo(() => {
    const obj = { courses: [], activeSessions: [], activeMicrolearning: [] }
    if (!data?.participations) return obj
    return data.participations?.reduce((acc: any, participation) => {
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
          ...acc.activeSessions,
          ...participation.course?.microSessions,
        ],
      }
    }, obj)
  }, [data])

  if (loading || !data) {
    return <div>loading</div>
  }

  return (
    <div className="p-4 mt-20">
      <div>
        <H1>Aktive Sessions</H1>
        <div>
          {activeSessions.length === 0 && <div>Keine aktiven Sessions.</div>}
          {activeSessions.map((session: any) => (
            <div key={session.id}>{session.displayName}</div>
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
    </div>
  )
}

Index.getLayout = function getLayout(page) {
  return <Layout>{page}</Layout>
}

export default Index
