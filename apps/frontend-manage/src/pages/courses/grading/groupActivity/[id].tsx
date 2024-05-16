import { useQuery } from '@apollo/client'
import GroupActivityGradingStack from '@components/courses/groupActivity/GroupActivityGradingStack'
import GroupActivitySubmission from '@components/courses/groupActivity/GroupActivitySubmission'
import SubmissionSwitchModal from '@components/courses/groupActivity/SubmissionSwitchModal'
import Layout from '@components/Layout'
import {
  ElementType,
  GetGradingGroupActivityDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { H1, H2, UserNotification } from '@uzh-bf/design-system'
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
  const [currentEditing, setCurrentEditing] = useState<boolean>(false)
  const [switchingModal, setSwitchingModal] = useState<boolean>(false)
  const [nextSubmission, setNextSubmission] = useState<number>(-1)

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
      <H1 className={{ root: 'mb-4' }}>
        {t('manage.groupActivity.gradingTitle', { name: groupActivity.name })}
      </H1>
      <div className="flex flex-row">
        <div className="w-1/2 pr-6">
          <H2 className={{ root: 'mb-2' }}>
            {t('manage.groupActivity.submissions')}
          </H2>
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
                  selectSubmission={(submissionId: number) => {
                    if (currentEditing) {
                      setSwitchingModal(true)
                      setNextSubmission(submissionId)
                    } else {
                      setSelectedSubmission(submissionId)
                    }
                  }}
                />
              ))
            )}
          </div>
        </div>
        <div className="w-1/2">
          <H2 className={{ root: 'mb-2' }}>
            {t('manage.groupActivity.grading')}
          </H2>
          {selectedSubmission ? (
            <GroupActivityGradingStack
              setEdited={() => setCurrentEditing(true)}
              elements={(groupActivity.stacks?.[0].elements ?? []).filter(
                (element) =>
                  element.elementType !== ElementType.Content &&
                  element.elementType !== ElementType.Flashcard
              )}
              submission={submissions.find(
                (submission) => submission.id === selectedSubmission
              )}
            />
          ) : (
            <UserNotification
              type="warning"
              message={t('manage.groupActivity.noSubmissionSelected')}
            />
          )}
        </div>
      </div>
      <SubmissionSwitchModal
        nextSubmission={nextSubmission}
        switchingModal={switchingModal}
        setSelectedSubmission={setSelectedSubmission}
        setCurrentEditing={setCurrentEditing}
        setSwitchingModal={setSwitchingModal}
      />
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
