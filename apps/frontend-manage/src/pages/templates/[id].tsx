import Loader from '@klicker-uzh/shared-components/src/Loader'
import { ActivityType } from '@klicker-uzh/types'
import { H2, UserNotification } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Layout from '../../components/Layout'
import GroupActivityTemplate from '../../components/activities/templates/GroupActivityTemplate'
import LiveQuizTemplate from '../../components/activities/templates/LiveQuizTemplate'
import MicroLearningTemplate from '../../components/activities/templates/MicroLearningTemplate'
import PracticeQuizTemplate from '../../components/activities/templates/PracticeQuizTemplate'
import type { ActivityTemplate } from '../../lib/constants/elementTypes'
import { trpc } from '../../lib/trpc'

function Template({ templateId }: { templateId: string }) {
  const t = useTranslations()

  const { data, isLoading } = trpc.activity.template.useQuery(
    { templateId },
    { enabled: Boolean(templateId) }
  )

  if (isLoading) {
    return (
      <Layout displayName={t('manage.template.activityFromTemplate')}>
        <H2>{t('manage.template.activityFromTemplate')}</H2>
        <Loader />
      </Layout>
    )
  }

  if (!data?.activityTemplate) {
    return (
      <Layout displayName={t('manage.template.activityFromTemplate')}>
        <UserNotification
          type="error"
          message={t('manage.template.notFoundNotAccessible')}
          className={{ root: 'text-base' }}
        />
      </Layout>
    )
  }

  const template = data.activityTemplate
  return (
    <Layout displayName={t('manage.template.activityFromTemplate')}>
      <H2>{t('manage.template.activityFromTemplate')}</H2>
      {template.activityType === ActivityType.LIVE_QUIZ ? (
        <LiveQuizTemplate template={template as unknown as ActivityTemplate} />
      ) : null}
      {template.activityType === ActivityType.PRACTICE_QUIZ ? (
        <PracticeQuizTemplate
          template={template as unknown as ActivityTemplate}
        />
      ) : null}
      {template.activityType === ActivityType.MICRO_LEARNING ? (
        <MicroLearningTemplate
          template={template as unknown as ActivityTemplate}
        />
      ) : null}
      {template.activityType === ActivityType.GROUP_ACTIVITY ? (
        <GroupActivityTemplate
          template={template as unknown as ActivityTemplate}
        />
      ) : null}
    </Layout>
  )
}

export async function getStaticProps({
  locale,
  params,
}: GetStaticPropsContext) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
      templateId: params?.id,
    },
  }
}

export function getStaticPaths() {
  return {
    paths: [],
    fallback: 'blocking',
  }
}

export default Template
