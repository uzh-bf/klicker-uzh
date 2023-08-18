import { useQuery } from '@apollo/client'
import { GetBasicCourseInformationDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
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

  const { data, loading } = useQuery(GetBasicCourseInformationDocument, {
    variables: { courseId: router.query.courseId as string },
    skip: !router.query?.courseId,
  })

  if (loading)
    return (
      <Layout displayName={t('shared.generic.documentation')}>
        <Loader />
      </Layout>
    )

  if (!data?.basicCourseInformation?.id) {
    return <div>{t('shared.generic.systemError')}</div>
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
          className={{ root: `w-full !rounded-b-none` }}
        >
          <Navigation.ButtonItem
            label={t('pwa.courses.courseInformation')}
            className={{ root: `text-white` }}
            onClick={() =>
              router.push(`/course/${data.basicCourseInformation!.id}/docs`)
            }
          />
          <Navigation.TriggerItem
            label={t('pwa.general.setup')}
            className={{ root: `text-white` }}
            dropdownWidth="w-[20rem]"
          >
            <Navigation.DropdownItem
              title={t('pwa.general.firstLogin')}
              onClick={() =>
                router.push(
                  `/course/${data.basicCourseInformation!.id}/docs/login`
                )
              }
            />
            <Navigation.DropdownItem
              title={t('pwa.general.appSetup')}
              onClick={() =>
                router.push(
                  `/course/${data.basicCourseInformation!.id}/docs/appSetup`
                )
              }
            />
          </Navigation.TriggerItem>
          <Navigation.ButtonItem
            label={t('shared.generic.features')}
            className={{ root: `text-white` }}
            onClick={() =>
              router.push(
                `/course/${data.basicCourseInformation!.id}/docs/features`
              )
            }
          />
        </Navigation>
        <div className="p-4 prose border rounded-b max-w-none prose-img:m-0">
          {typeof children === 'function'
            ? children(data.basicCourseInformation!)
            : children}
        </div>
      </div>
    </Layout>
  )
}
export default DocsLayout
