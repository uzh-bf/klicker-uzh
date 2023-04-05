import { useQuery } from '@apollo/client'
import { faList, faPeopleGroup } from '@fortawesome/free-solid-svg-icons'
import { GetControlCoursesDocument } from '@klicker-uzh/graphql/dist/ops'
import { H4, UserNotification } from '@uzh-bf/design-system'
import ListButton from '../components/common/ListButton'
import Layout from '../components/Layout'

function Index() {
  const {
    loading: loadingCourses,
    error: errorCourses,
    data: dataCourses,
  } = useQuery(GetControlCoursesDocument)

  if (loadingCourses) {
    return <Layout title="Kursübersicht">Loading...</Layout>
  }
  if ((!loadingCourses && !dataCourses) || errorCourses) {
    return (
      <Layout title="Kursübersicht">
        <UserNotification
          type="error"
          className={{ root: 'text-base' }}
          message="Es ist ein Fehler aufgetreten beim Laden Ihrer Kurse. Bitte versuchen
        Sie es später erneut."
        />
      </Layout>
    )
  }

  return (
    <Layout title="Kursübersicht">
      <div className="flex flex-col w-full gap-4">
        {dataCourses?.controlCourses && (
          <div>
            <H4>Bitte wählen Sie einen Kurs aus:</H4>
            <div className="flex flex-col gap-2">
              {dataCourses.controlCourses
                .sort((a, b) => (a.isArchived ? 1 : -1))
                .map((course) => (
                  <ListButton
                    key={course.id}
                    link={`/course/${course.id}`}
                    icon={faPeopleGroup}
                    label={
                      !course.isArchived
                        ? course.name
                        : `${course.name} (Archiviert)`
                    }
                  />
                ))}
            </div>
          </div>
        )}

        <div>
          <H4>Sessionen ohne Kurs</H4>
          <div className="flex flex-col gap-2">
            <ListButton
              link="/course/unassigned"
              icon={faList}
              label="Liste aller Sessionen ohne Kurs"
            />
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default Index
