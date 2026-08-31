import { useQuery } from '@apollo/client'
import {
  ElementType,
  GetEscapeRoomProgressDocument,
  GetGradingGroupActivityDocument,
  PublicationStatus,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, H1, H2, UserNotification } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useMemo, useState } from 'react'
import Layout from '../../../../components/Layout'
import FinalizeGradingModal from '../../../../components/courses/groupActivity/FinalizeGradingModal'
import GroupActivityGradingStack from '../../../../components/courses/groupActivity/GroupActivityGradingStack'
import GroupActivitySubmission from '../../../../components/courses/groupActivity/GroupActivitySubmission'
import SubmissionSwitchModal from '../../../../components/courses/groupActivity/SubmissionSwitchModal'
import EscapeRoomProgress from '../../../../components/evaluation/EscapeRoomProgress'

const MAX_POINTS_PER_QUESTION = 25

function GroupActivityGrading() {
  const router = useRouter()
  const t = useTranslations()
  const [selectedSubmission, setSelectedSubmission] = useState<
    number | undefined
  >(undefined)
  const [currentEditing, setCurrentEditing] = useState<boolean>(false)
  const [switchingModal, setSwitchingModal] = useState<boolean>(false)
  const [finalizeModal, setFinalizeModal] = useState<boolean>(false)
  const [nextSubmission, setNextSubmission] = useState<number>(-1)

  const {
    data,
    loading,
    refetch: refetchGroupActivity,
  } = useQuery(GetGradingGroupActivityDocument, {
    variables: {
      id: router.query.id as string,
    },
    skip: !router.query.id,
  })
  const {
    data: escapeRoomData,
    error: escapeRoomError,
    refetch: refetchEscapeRoom,
  } = useQuery(GetEscapeRoomProgressDocument, {
    variables: { groupActivityId: router.query.id as string },
    skip: !router.query.id || !data?.getGradingGroupActivity?.escapeRoomConfig,
    pollInterval: 5000,
  })

  const groupActivity = data?.getGradingGroupActivity
  const maxPoints =
    useMemo(() => {
      return groupActivity?.stacks?.[0].elements
        ?.filter(
          (element) =>
            element.elementType !== ElementType.Content &&
            element.elementType !== ElementType.Flashcard
        )
        .reduce((acc, element) => {
          return (
            acc +
            (element.options?.pointsMultiplier ?? 1) * MAX_POINTS_PER_QUESTION
          )
        }, 0)
    }, [groupActivity]) ?? 0

  // sort invalid submissions last and graded ones to the back
  const submissions = useMemo(
    () =>
      [...(groupActivity?.activityInstances || [])].sort((a, b) => {
        if (a.decisions && !b.decisions) return -1
        if (!a.decisions && b.decisions) return 1
        if (a.decisionsSubmittedAt && b.decisionsSubmittedAt)
          return dayjs(a.decisionsSubmittedAt).diff(
            dayjs(b.decisionsSubmittedAt)
          )
        return 1
      }),
    [groupActivity?.activityInstances]
  )

  if (loading)
    return (
      <Layout>
        <Loader />
      </Layout>
    )

  if (!groupActivity) {
    return (
      <Layout>{t('manage.groupActivity.activityMissingOrNotCompleted')}</Layout>
    )
  }

  return (
    <Layout>
      <H1 className={{ root: 'mb-4' }}>
        {t('manage.groupActivity.gradingTitle', { name: groupActivity.name })}
      </H1>
      {escapeRoomData?.escapeRoomProgress && (
        <div
          className="mb-6 rounded border"
          data-cy="group-escape-room-progress"
        >
          <H2 className={{ root: 'border-b p-4' }}>
            {t('manage.evaluation.escapeRoomTab')}
          </H2>
          <EscapeRoomProgress
            activityType="groupActivity"
            activityId={groupActivity.id}
            progress={escapeRoomData.escapeRoomProgress}
            canReset={groupActivity.canResetEscapeRoom ?? false}
            onReset={async () => {
              setSelectedSubmission(undefined)
              setCurrentEditing(false)
              await Promise.all([refetchEscapeRoom(), refetchGroupActivity()])
            }}
          />
        </div>
      )}
      {escapeRoomError ? (
        <UserNotification
          type="error"
          message={t('shared.generic.systemError')}
        />
      ) : null}
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
              <>
                {submissions.map((submission, ix) => (
                  <GroupActivitySubmission
                    key={submission.id}
                    activityIndex={ix}
                    submission={submission}
                    selectedSubmission={selectedSubmission}
                    selectSubmission={(submissionId: number) => {
                      if (
                        currentEditing &&
                        groupActivity.status !== PublicationStatus.Graded
                      ) {
                        setSwitchingModal(true)
                        setNextSubmission(submissionId)
                      } else {
                        setSelectedSubmission(submissionId)
                      }
                    }}
                    maxPoints={maxPoints}
                  />
                ))}
                <Button
                  primary
                  disabled={
                    submissions.some(
                      (submission) =>
                        !submission.results && submission.decisions
                    ) || groupActivity.status === PublicationStatus.Graded
                  }
                  className={{
                    root: 'w-max self-end',
                  }}
                  onClick={() => setFinalizeModal(true)}
                  data={{ cy: 'finalize-grading' }}
                >
                  {t('manage.groupActivity.finalizeGrading')}
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="w-1/2">
          <H2 className={{ root: 'mb-2' }}>
            {t('manage.groupActivity.grading')}
          </H2>
          {selectedSubmission ? (
            <GroupActivityGradingStack
              setEdited={(edited: boolean) => setCurrentEditing(edited)}
              elements={(groupActivity.stacks?.[0].elements ?? []).filter(
                (element) =>
                  element.elementType !== ElementType.Content &&
                  element.elementType !== ElementType.Flashcard
              )}
              submission={submissions.find(
                (submission) => submission.id === selectedSubmission
              )}
              gradingCompleted={
                groupActivity.status === PublicationStatus.Graded
              }
              pointsPerInstance={MAX_POINTS_PER_QUESTION}
              maxPoints={maxPoints}
            />
          ) : (
            <UserNotification
              type="warning"
              message={
                groupActivity.status === PublicationStatus.Graded
                  ? t('manage.groupActivity.gradingAlreadyFinalized')
                  : t('manage.groupActivity.noSubmissionSelected')
              }
            />
          )}
        </div>
      </div>
      {switchingModal && (
        <SubmissionSwitchModal
          nextSubmission={nextSubmission}
          setSelectedSubmission={setSelectedSubmission}
          setCurrentEditing={setCurrentEditing}
          setSwitchingModal={setSwitchingModal}
        />
      )}
      {finalizeModal && (
        <FinalizeGradingModal
          onClose={() => setFinalizeModal(false)}
          activityId={groupActivity.id}
        />
      )}
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
