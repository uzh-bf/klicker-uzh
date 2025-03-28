import { useQuery } from '@apollo/client'
import {
  ActivityType,
  GetActivityTemplateDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { H2, UserNotification } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Layout from '../../components/Layout'
import GroupActivityTemplate from '../../components/activities/templates/GroupActivityTemplate'
import LiveQuizTemplate from '../../components/activities/templates/LiveQuizTemplate'
import MicroLearningTemplate from '../../components/activities/templates/MicroLearningTemplate'
import PracticeQuizTemplate from '../../components/activities/templates/PracticeQuizTemplate'

function Template({ templateId }: { templateId: string }) {
  const t = useTranslations()

  const { data, loading } = useQuery(GetActivityTemplateDocument, {
    variables: { templateId },
  })

  if (loading) {
    return (
      <Layout displayName={t('manage.template.activityFromTemplate')}>
        <H2>{t('manage.template.activityFromTemplate')}</H2>
        <Loader />
      </Layout>
    )
  }

  if (!data?.getActivityTemplate) {
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

  const template = data?.getActivityTemplate
  return (
    <Layout displayName={t('manage.template.activityFromTemplate')}>
      <H2>{t('manage.template.activityFromTemplate')}</H2>
      {template?.activityType === ActivityType.LiveQuiz ? (
        <LiveQuizTemplate template={template} />
      ) : null}
      {template?.activityType === ActivityType.PracticeQuiz ? (
        <PracticeQuizTemplate template={template} />
      ) : null}
      {template?.activityType === ActivityType.MicroLearning ? (
        <MicroLearningTemplate template={template} />
      ) : null}
      {template?.activityType === ActivityType.GroupActivity ? (
        <GroupActivityTemplate template={template} />
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
