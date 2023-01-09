import { useQuery } from '@apollo/client'
import { faPeopleGroup } from '@fortawesome/free-solid-svg-icons'
import { GetUserCoursesDocument } from '@klicker-uzh/graphql/dist/ops'
import { H3, H4, ThemeContext, UserNotification } from '@uzh-bf/design-system'
import Link from 'next/link'
import { useContext } from 'react'
import ListButton from '../components/common/ListButton'
import Layout from '../components/Layout'

function Index() {
  const theme = useContext(ThemeContext)
  const {
    loading: loadingCourses,
    error: errorCourses,
    data: dataCourses,
  } = useQuery(GetUserCoursesDocument)

  if (loadingCourses) {
    return <Layout title="Kursübersicht">Loading...</Layout>
  }
  if ((!loadingCourses && !dataCourses) || errorCourses) {
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

  return (
    <Layout title="Kursübersicht">
      {dataCourses?.userCourses ? (
        <div className="w-full">
          <H4>Bitte wählen Sie einen Kurs aus:</H4>
          <div className="flex flex-col gap-2">
            {dataCourses.userCourses
              .sort((a, b) => (a.isArchived ? 1 : -1))
              .map((course) => (
                <ListButton
                  key={course.id}
                  link={`/course/${course.id}`}
                  icon={faPeopleGroup}
                  label={
                    !course.isArchived
                      ? course.displayName
                      : `${course.displayName} (Archiviert)`
                  }
                />
              ))}
          </div>
          {/* // TODO: add button for sessions without a course attached to them... REMOVE check for courses - no courses need to exist */}
        </div>
      ) : (
        <div>
          <H3>Keine Kurse gefunden...</H3>
          <div>
            Erstellen Sie jetzt einen Kurs über die{' '}
            <Link
              href={process.env.NEXT_PUBLIC_MANAGE_URL || ''}
              className={theme.primaryText}
            >
              Management-App
            </Link>
            !
          </div>
        </div>
      )}
    </Layout>
  )
}

export default Index
