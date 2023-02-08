import { useQuery } from '@apollo/client'
import { GetCourseOverviewDataDocument } from '@klicker-uzh/graphql/dist/ops'
import { Navigation } from '@uzh-bf/design-system'
import { useRouter } from 'next/router'
// TODO add style to NavBar

function CommonDocs() {
  const router = useRouter()

  const { data } = useQuery(GetCourseOverviewDataDocument, {
    variables: { courseId: router.query.courseId as string },
    skip: !router.query?.courseId,
  })

  if (!data?.getCourseOverviewData) {
    return <div>Loading...</div>
  }
  return (
    <div>
      <div className="m-5 md:m-0 md:w-full md:max-w-xxl md:py-8 md:mx-auto">
        <Navigation
          // style={{
          //   backgroundColor: `${data.getCourseOverviewData?.course.color}`,
          // }}
          className={{
            root: `w-full`,
          }}
        >
          <Navigation.ButtonItem
            label="Info Page"
            onClick={() =>
              router.push(
                `/course/${data.getCourseOverviewData?.course.id}/docs`
              )
            }
          ></Navigation.ButtonItem>
          <Navigation.TriggerItem
            label="Getting Started"
            dropdownWidth="w-[20rem]"
          >
            <Navigation.DropdownItem
              title="Klicker App"
              onClick={() =>
                router.push(
                  `/course/${data.getCourseOverviewData?.course.id}/docs/klickerApp`
                )
              }
            />
            <Navigation.DropdownItem
              title="Erstmaliges Login"
              onClick={() =>
                router.push(
                  `/course/${data.getCourseOverviewData?.course.id}/docs/login`
                )
              }
            />
          </Navigation.TriggerItem>
          <Navigation.TriggerItem label="Features" dropdownWidth="w-[20rem]">
            <Navigation.DropdownItem
              title="Umfragen"
              onClick={() =>
                router.push(
                  `/course/${data.getCourseOverviewData?.course.id}/docs/umfragen`
                )
              }
              className={{ root: 'text-center' }}
            />
            <Navigation.DropdownItem
              title="Live Q&A"
              onClick={() =>
                router.push(
                  `/course/${data.getCourseOverviewData?.course.id}/docs/liveQA`
                )
              }
            />
            <Navigation.DropdownItem
              title="Gruppenaktivitäten"
              onClick={() =>
                router.push(
                  `/course/${data.getCourseOverviewData?.course.id}/docs/groupActivities`
                )
              }
            />
            <Navigation.DropdownItem
              title="Microlearning"
              onClick={() =>
                router.push(
                  `/course/${data.getCourseOverviewData?.course.id}/docs/microlearning`
                )
              }
            />
            <Navigation.DropdownItem
              title="Selbsttests"
              onClick={() =>
                router.push(
                  `/course/${data.getCourseOverviewData?.course.id}/docs/selbsttests`
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
