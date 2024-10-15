import { useQuery } from '@apollo/client'
import { GetBasicCourseInformationDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Navigation } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { twMerge } from 'tailwind-merge'
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

  const menuClassName = (active: boolean) => {
    return {
      label: twMerge(
        'text-sm bg-left-bottom bg-gradient-to-r from-white to-white bg-[length:0%_2px] bg-no-repeat group-hover:bg-[length:100%_2px] transition-all duration-500 ease-out',
        active && 'text-red underline underline-offset-[0.25rem] decoration-2'
      ),
      root: 'group text-white hover:bg-inherit transition-all duration-300 ease-in-out',
    }
  }

  return (
    <Layout
      course={data.basicCourseInformation}
      displayName={t('shared.generic.documentation')}
    >
      <div className="mx-auto w-full max-w-4xl">
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
            className={menuClassName(
              router.pathname === '/course/[courseId]/docs'
            )}
            onClick={() =>
              router.push(`/course/${data.basicCourseInformation!.id}/docs`)
            }
          />
          <Navigation.ButtonItem
            label={t('pwa.studentDocs.featuresTitle')}
            className={menuClassName(
              router.pathname === '/course/[courseId]/docs/features'
            )}
            onClick={() =>
              router.push(
                `/course/${data.basicCourseInformation!.id}/docs/features`
              )
            }
          />
          <Navigation.ButtonItem
            label={t('pwa.studentDocs.firstLoginTitle')}
            className={menuClassName(
              router.pathname === '/course/[courseId]/docs/login'
            )}
            onClick={() =>
              router.push(
                `/course/${data.basicCourseInformation!.id}/docs/login`
              )
            }
          />
          <Navigation.ButtonItem
            label={t('pwa.studentDocs.appSetupTitle')}
            className={menuClassName(
              router.pathname === '/course/[courseId]/docs/appSetup'
            )}
            onClick={() =>
              router.push(
                `/course/${data.basicCourseInformation!.id}/docs/appSetup`
              )
            }
          />
        </Navigation>
        <div className="prose prose-img:m-0 max-w-none rounded-b border p-4">
          {typeof children === 'function'
            ? children(data.basicCourseInformation!)
            : children}
        </div>
      </div>
    </Layout>
  )
}
export default DocsLayout
