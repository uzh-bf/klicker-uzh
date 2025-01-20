import { useQuery } from '@apollo/client'
import { GetBasicCourseInformationDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Navigation } from '@uzh-bf/design-system'
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
      <div className="mx-auto w-full max-w-4xl">
        <Navigation
          className={{ root: 'w-full !rounded-b-none bg-slate-200' }}
          items={[
            {
              type: 'button',
              key: 'course-information',
              label: t('pwa.courses.courseInformation'),
              onClick: () =>
                router.push(`/course/${data.basicCourseInformation!.id}/docs`),
              active: router.pathname === '/course/[courseId]/docs',
            },
            {
              type: 'button',
              key: 'features-overview',
              label: t('pwa.studentDocs.featuresTitle'),
              onClick: () =>
                router.push(
                  `/course/${data.basicCourseInformation!.id}/docs/features`
                ),
              active: router.pathname === '/course/[courseId]/docs/features',
            },
            {
              type: 'button',
              key: 'first-login-account',
              label: t('pwa.studentDocs.firstLoginTitle'),
              onClick: () =>
                router.push(
                  `/course/${data.basicCourseInformation!.id}/docs/login`
                ),
              active: router.pathname === '/course/[courseId]/docs/login',
            },
            {
              type: 'button',
              key: 'app-setup',
              label: t('pwa.studentDocs.appSetupTitle'),
              onClick: () =>
                router.push(
                  `/course/${data.basicCourseInformation!.id}/docs/appSetup`
                ),
              active: router.pathname === '/course/[courseId]/docs/appSetup',
            },
          ]}
        />
        <div className="prose prose-img:m-0 max-w-none rounded-b border border-slate-200 p-4">
          {typeof children === 'function'
            ? children(data.basicCourseInformation!)
            : children}
        </div>
      </div>
    </Layout>
  )
}
export default DocsLayout
