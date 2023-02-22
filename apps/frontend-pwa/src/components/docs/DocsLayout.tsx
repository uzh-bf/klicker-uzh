import { useQuery } from '@apollo/client'
import { GetBasicCourseInformationDocument } from '@klicker-uzh/graphql/dist/ops'
import { Navigation } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import Layout from '../Layout'

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
  const t = useTranslations()
  const router = useRouter()

  const { data } = useQuery(GetBasicCourseInformationDocument, {
    variables: { courseId: router.query.courseId as string },
    skip: !router.query?.courseId,
  })

  if (!data?.basicCourseInformation) {
    return <div>{t('shared.generic.loading')}</div>
  }

  return (
    <Layout
      course={data.basicCourseInformation}
      displayName={t('shared.generic.documentation')}
    >
      <div className="w-full max-w-4xl mx-auto">
        <Navigation
          style={{
            root: {
              backgroundColor: `${data.basicCourseInformation.color}`,
            },
          }}
          className={{ root: `w-full rounded-b-none` }}
        >
          <Navigation.ButtonItem
            label={t('pwa.courses.courseInformation')}
            className={{ root: `text-white` }}
            onClick={() =>
              router.push(`/course/${data.basicCourseInformation?.id}/docs`)
            }
          />
          <Navigation.TriggerItem
            label={t('pwa.general.setup')}
            className={{ root: `text-white` }}
            dropdownWidth="w-[20rem]"
          >
            <Navigation.DropdownItem
              title={t('pwa.general.appSetup')}
              onClick={() =>
                router.push(
                  `/course/${data.basicCourseInformation?.id}/docs/appSetup`
                )
              }
            />
            <Navigation.DropdownItem
              title={t('pwa.general.firstLogin')}
              onClick={() =>
                router.push(
                  `/course/${data.basicCourseInformation?.id}/docs/login`
                )
              }
            />
          </Navigation.TriggerItem>
          <Navigation.TriggerItem
            label={t('shared.generic.features')}
            className={{ root: `text-white` }}
            dropdownWidth="w-[20rem]"
          >
            <Navigation.DropdownItem
              title={t('pwa.general.polls')}
              onClick={() =>
                router.push(
                  `/course/${data.basicCourseInformation?.id}/docs/polls`
                )
              }
              className={{ root: 'text-center' }}
            />
            <Navigation.DropdownItem
              title={t('pwa.general.liveQA')}
              onClick={() =>
                router.push(
                  `/course/${data.basicCourseInformation?.id}/docs/liveQA`
                )
              }
            />
            <Navigation.DropdownItem
              title={t('shared.generic.groupActivities')}
              onClick={() =>
                router.push(
                  `/course/${data.basicCourseInformation?.id}/docs/groupActivities`
                )
              }
            />
            <Navigation.DropdownItem
              title={t('shared.generic.microlearning')}
              onClick={() =>
                router.push(
                  `/course/${data.basicCourseInformation?.id}/docs/microSessions`
                )
              }
            />
            <Navigation.DropdownItem
              title={t('shared.generic.learningElements')}
              onClick={() =>
                router.push(
                  `/course/${data.basicCourseInformation?.id}/docs/learningElements`
                )
              }
            />
          </Navigation.TriggerItem>
        </Navigation>
        <div className="p-4 prose border rounded-b max-w-none prose-img:m-0">
          {typeof children === 'function'
            ? children(data.basicCourseInformation)
            : children}
        </div>
      </div>
    </Layout>
  )
}
export default DocsLayout
