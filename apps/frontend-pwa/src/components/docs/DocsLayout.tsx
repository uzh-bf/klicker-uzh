import { useQuery } from '@apollo/client'
import { GetBasicCourseInformationDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Tabs } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import Layout from '../Layout'

interface BasicCourseData {
  id: string
  displayName: string
  description?: string | null
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
      <Tabs
        defaultValue="course-information"
        tabs={[
          {
            id: 'tab-course-information',
            value: 'course-information',
            label: t('pwa.courses.courseInformation'),
            data: { cy: 'tab-course-information' },
          },
          {
            id: 'tab-features-overview',
            value: 'features-overview',
            label: t('pwa.studentDocs.featuresTitle'),
            data: { cy: 'tab-features-overview' },
          },
          {
            id: 'tab-first-login-account',
            value: 'first-login-account',
            label: t('pwa.studentDocs.firstLoginTitle'),
            data: { cy: 'tab-first-login-account' },
          },
          {
            id: 'tab-app-setup',
            value: 'app-setup',
            label: t('pwa.studentDocs.appSetupTitle'),
            data: { cy: 'tab-app-setup' },
          },
        ]}
        className={{ root: 'mx-auto w-full max-w-5xl' }}
        onValueChange={(value) => {
          const routes = {
            'course-information': `/course/${data.basicCourseInformation!.id}/docs`,
            'features-overview': `/course/${data.basicCourseInformation!.id}/docs/features`,
            'first-login-account': `/course/${data.basicCourseInformation!.id}/docs/login`,
            'app-setup': `/course/${data.basicCourseInformation!.id}/docs/appSetup`,
          }
          router.push(routes[value as keyof typeof routes] || '/404')
        }}
        value={
          router.pathname === '/course/[courseId]/docs'
            ? 'course-information'
            : router.pathname === '/course/[courseId]/docs/features'
              ? 'features-overview'
              : router.pathname === '/course/[courseId]/docs/login'
                ? 'first-login-account'
                : 'app-setup'
        }
      >
        <div className="prose prose-img:m-0 max-w-none rounded-b-lg border border-slate-200 p-4">
          {typeof children === 'function'
            ? children(data.basicCourseInformation!)
            : children}
        </div>
      </Tabs>
    </Layout>
  )
}
export default DocsLayout
