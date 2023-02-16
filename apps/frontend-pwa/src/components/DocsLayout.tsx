import { useQuery } from '@apollo/client'
import { GetBasicCourseInformationDocument } from '@klicker-uzh/graphql/dist/ops'
import { Navigation } from '@uzh-bf/design-system'
import { useRouter } from 'next/router'
import Layout from './Layout'

interface BasicCourseData {
  id: string
  name: string
  displayName: string
  description: string
  color: string
  owner: {
    shortname: string
  }
}

function DocsLayout({
  children,
}: {
  children: React.ReactNode | ((course: BasicCourseData) => React.ReactNode)
}) {
  const router = useRouter()

  const { data } = useQuery(GetBasicCourseInformationDocument, {
    variables: { courseId: router.query.courseId as string },
    skip: !router.query?.courseId,
  })

  if (!data?.basicCourseInformation) {
    return <div>Loading...</div>
  }

  return (
    <Layout
      courseName={data.basicCourseInformation.name}
      displayName="Dokumentation"
      courseColor={data.basicCourseInformation.color}
    >
      <div className="w-full max-w-4xl mx-auto">
        <div>
          <Navigation
            style={{
              root: {
                backgroundColor: `${data.basicCourseInformation.color}`,
              },
            }}
            className={{ root: `w-full rounded-b-none` }}
          >
            <Navigation.ButtonItem
              label="Kursinformationen"
              className={{ root: `text-white` }}
              onClick={() =>
                router.push(`/course/${data.basicCourseInformation.id}/docs`)
              }
            ></Navigation.ButtonItem>
            <Navigation.TriggerItem
              label="Einrichtung"
              className={{ root: `text-white` }}
              dropdownWidth="w-[20rem]"
            >
              <Navigation.DropdownItem
                title="App einrichten"
                onClick={() =>
                  router.push(
                    `/course/${data.basicCourseInformation.id}/docs/appSetup`
                  )
                }
              />
              <Navigation.DropdownItem
                title="Erstmaliges Login"
                onClick={() =>
                  router.push(
                    `/course/${data.basicCourseInformation.id}/docs/login`
                  )
                }
              />
            </Navigation.TriggerItem>
            <Navigation.TriggerItem
              label="Features"
              className={{ root: `text-white` }}
              dropdownWidth="w-[20rem]"
            >
              <Navigation.DropdownItem
                title="Umfragen"
                onClick={() =>
                  router.push(
                    `/course/${data.basicCourseInformation.id}/docs/polls`
                  )
                }
                className={{ root: 'text-center' }}
              />
              <Navigation.DropdownItem
                title="Live Q&A"
                onClick={() =>
                  router.push(
                    `/course/${data.basicCourseInformation.id}/docs/liveQA`
                  )
                }
              />
              <Navigation.DropdownItem
                title="Gruppenaktivitäten"
                onClick={() =>
                  router.push(
                    `/course/${data.basicCourseInformation.id}/docs/groupActivities`
                  )
                }
              />
              <Navigation.DropdownItem
                title="Microlearning"
                onClick={() =>
                  router.push(
                    `/course/${data.basicCourseInformation.id}/docs/microSessions`
                  )
                }
              />
              <Navigation.DropdownItem
                title="Selbsttests"
                onClick={() =>
                  router.push(
                    `/course/${data.basicCourseInformation.id}/docs/learningElements`
                  )
                }
              />
            </Navigation.TriggerItem>
          </Navigation>
        </div>
        <div className="p-4 prose border rounded-b max-w-none">
          {typeof children === 'function'
            ? children(data.basicCourseInformation)
            : children}
        </div>
      </div>
    </Layout>
  )
}
export default DocsLayout
