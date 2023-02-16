import { useQuery } from '@apollo/client'
import { GetBasicCourseInformationDocument } from '@klicker-uzh/graphql/dist/ops'
import { Navigation } from '@uzh-bf/design-system'
import { useRouter } from 'next/router'

function CommonDocs() {
  const router = useRouter()

  const { data } = useQuery(GetBasicCourseInformationDocument, {
    variables: { courseId: router.query.courseId as string },
    skip: !router.query?.courseId,
  })

  if (!data?.basicCourseInformation) {
    return <div>Loading...</div>
  }

  return (
    <div>
      <div className={'m-5 md:m-0 md:w-full md:max-w-xxl md:py-8 md:mx-auto'}>
        <Navigation
          style={{
            root: {
              backgroundColor: `${data.basicCourseInformation.color}`,
            },
          }}
          className={{ root: `w-full` }}
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
    </div>
  )
}
export default CommonDocs
