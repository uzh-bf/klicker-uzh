import { useQuery } from '@apollo/client'
import GroupActivitySubmission from '@components/courses/groupActivity/GroupActivitySubmission'
import Layout from '@components/Layout'
import { GetGradingGroupActivityDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { H2, H3, UserNotification } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useState } from 'react'

function GroupActivityGrading() {
  const router = useRouter()
  const t = useTranslations()
  const [selectedSubmission, setSelectedSubmission] = useState<
    number | undefined
  >(undefined)

  const { data, loading } = useQuery(GetGradingGroupActivityDocument, {
    variables: {
      id: router.query.id as string,
    },
    skip: !router.query.id,
  })

  if (loading)
    return (
      <Layout>
        <Loader />
      </Layout>
    )

  if (!data?.getGradingGroupActivity) {
    return (
      <Layout>{t('manage.groupActivity.activityMissingOrNotCompleted')}</Layout>
    )
  }

  const groupActivity = data.getGradingGroupActivity

  // sort invalid submissions last and graded ones to the back
  const submissions = [...(groupActivity.activityInstances || [])].sort(
    (a, b) => {
      if (a.decisions && !b.decisions) return -1
      if (!a.decisions && b.decisions) return 1
      if (a.results && !b.results) return 1
      if (!a.results && b.results) return -1
      if (a.decisionsSubmittedAt && b.decisionsSubmittedAt)
        return dayjs(a.decisionsSubmittedAt).diff(dayjs(b.decisionsSubmittedAt))
      return 1
    }
  )

  return (
    <Layout>
      <H2 className={{ root: 'mb-4' }}>
        {t('manage.groupActivity.gradingTitle', { name: groupActivity.name })}
      </H2>
      <div className="flex flex-row">
        <div className="w-1/2 pr-3">
          <H3>{t('manage.groupActivity.submissions')}</H3>
          <div className="flex flex-col gap-3">
            {!submissions || submissions.length === 0 ? (
              <UserNotification
                type="warning"
                message={t('manage.groupActivity.noSubmissions')}
              />
            ) : (
              submissions.map((submission) => (
                <GroupActivitySubmission
                  key={submission.id}
                  submission={submission}
                  selectedSubmission={selectedSubmission}
                  selectSubmission={setSelectedSubmission}
                />
              ))
            )}
          </div>
        </div>
        <div className="w-1/2">GRADING VIEW</div>
      </div>
    </Layout>
  )
}

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
    },
  }
}

export function getStaticPaths() {
  return {
    paths: [],
    fallback: 'blocking',
  }
}

export default GroupActivityGrading
