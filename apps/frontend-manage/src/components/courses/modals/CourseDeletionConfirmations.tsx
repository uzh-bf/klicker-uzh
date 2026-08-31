import type { CourseSummary } from '@klicker-uzh/graphql/dist/ops'
import { Checkbox, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import type { Dispatch, SetStateAction } from 'react'
import ConfirmationItem from '../../common/ConfirmationItem'
import type { CourseDeletionConfirmationType } from './CourseDeletionModal'

interface CourseDeletionConfirmationsProps {
  summary: CourseSummary
  confirmations: CourseDeletionConfirmationType
  setConfirmations: Dispatch<SetStateAction<CourseDeletionConfirmationType>>
  deleteDraftActivities: boolean
  setDeleteDraftActivities: Dispatch<SetStateAction<boolean>>
}

function CourseDeletionConfirmations({
  summary,
  confirmations,
  setConfirmations,
  deleteDraftActivities,
  setDeleteDraftActivities,
}: CourseDeletionConfirmationsProps) {
  const t = useTranslations()

  return (
    <div
      className="flex flex-col gap-2"
      data-testid="course-deletion-confirmations"
    >
      <UserNotification
        type="warning"
        message={t('manage.courseList.courseDeletionMessage')}
        className={{ root: 'mb-1 text-base' }}
      />
      <ConfirmationItem
        label={
          summary.numOfParticipations === 0
            ? t('manage.courseList.courseDeletionNoParticipations')
            : t('manage.courseList.courseDeletionParticipations', {
                number: summary.numOfParticipations,
              })
        }
        onClick={() => {
          setConfirmations((prev) => ({
            ...prev,
            participations: true,
          }))
        }}
        confirmed={confirmations.participations}
        notApplicable={summary.numOfParticipations === 0}
        confirmationType="delete"
        data={{ cy: 'course-deletion-participations-confirm' }}
      />
      {summary.numOfDraftActivities > 0 && (
        <div className="flex min-h-10 flex-row items-center border-b pb-2 pl-2">
          <Checkbox
            checked={deleteDraftActivities}
            onCheck={() => {
              setDeleteDraftActivities((value) => !value)
              setConfirmations((prev) => ({
                ...prev,
                liveQuizzes: summary.numOfLiveQuizzes === 0,
                practiceQuizzes: summary.numOfPracticeQuizzes === 0,
                microLearnings: summary.numOfMicroLearnings === 0,
                groupActivities: summary.numOfGroupActivities === 0,
              }))
            }}
            label={t('manage.courseList.deleteDraftActivitiesOption', {
              number: summary.numOfDraftActivities,
            })}
            className={{ label: 'mr-4' }}
            data={{ cy: 'course-deletion-delete-draft-activities' }}
          />
        </div>
      )}
      <ConfirmationItem
        label={
          summary.numOfLiveQuizzes === 0
            ? t('manage.courseList.courseDeletionNoLiveQuizzes')
            : t('manage.courseList.courseDeletionLiveQuizzes', {
                number: summary.numOfLiveQuizzes,
              })
        }
        onClick={() => {
          setConfirmations((prev) => ({
            ...prev,
            liveQuizzes: true,
          }))
        }}
        confirmed={confirmations.liveQuizzes}
        notApplicable={summary.numOfLiveQuizzes === 0}
        confirmationType="delete"
        data={{ cy: 'course-deletion-live-quiz-confirm' }}
      />
      <ConfirmationItem
        label={
          summary.numOfPracticeQuizzes === 0
            ? t('manage.courseList.courseDeletionNoPracticeQuizzes')
            : t('manage.courseList.courseDeletionPracticeQuizzes', {
                number: summary.numOfPracticeQuizzes,
              })
        }
        onClick={() => {
          setConfirmations((prev) => ({
            ...prev,
            practiceQuizzes: true,
          }))
        }}
        confirmed={confirmations.practiceQuizzes}
        notApplicable={summary.numOfPracticeQuizzes === 0}
        confirmationType="delete"
        data={{ cy: 'course-deletion-practice-quiz-confirm' }}
      />
      <ConfirmationItem
        label={
          summary.numOfMicroLearnings === 0
            ? t('manage.courseList.courseDeletionNoMicroLearnings')
            : t('manage.courseList.courseDeletionMicroLearnings', {
                number: summary.numOfMicroLearnings,
              })
        }
        onClick={() => {
          setConfirmations((prev) => ({
            ...prev,
            microLearnings: true,
          }))
        }}
        confirmed={confirmations.microLearnings}
        notApplicable={summary.numOfMicroLearnings === 0}
        confirmationType="delete"
        data={{ cy: 'course-deletion-micro-learning-confirm' }}
      />
      <ConfirmationItem
        label={
          summary.numOfGroupActivities === 0
            ? t('manage.courseList.courseDeletionNoGroupActivities')
            : t('manage.courseList.courseDeletionGroupActivities', {
                number: summary.numOfGroupActivities,
              })
        }
        onClick={() => {
          setConfirmations((prev) => ({
            ...prev,
            groupActivities: true,
          }))
        }}
        confirmed={confirmations.groupActivities}
        notApplicable={summary.numOfGroupActivities === 0}
        confirmationType="delete"
        data={{ cy: 'course-deletion-group-activity-confirm' }}
      />
      <ConfirmationItem
        label={
          summary.numOfParticipantGroups === 0
            ? t('manage.courseList.courseDeletionNoParticipantGroups')
            : t('manage.courseList.courseDeletionParticipantGroups', {
                number: summary.numOfParticipantGroups,
              })
        }
        onClick={() => {
          setConfirmations((prev) => ({
            ...prev,
            participantGroups: true,
          }))
        }}
        confirmed={confirmations.participantGroups}
        notApplicable={summary.numOfParticipantGroups === 0}
        confirmationType="delete"
        data={{ cy: 'course-deletion-participant-group-confirm' }}
      />
      <ConfirmationItem
        label={
          summary.numOfLeaderboardEntries === 0
            ? t('manage.courseList.courseDeletionNoLeaderboardEntries')
            : t('manage.courseList.courseDeletionLeaderboardEntries', {
                number: summary.numOfLeaderboardEntries,
              })
        }
        onClick={() => {
          setConfirmations((prev) => ({
            ...prev,
            leaderboardEntries: true,
          }))
        }}
        confirmed={confirmations.leaderboardEntries}
        notApplicable={summary.numOfLeaderboardEntries === 0}
        confirmationType="delete"
        data={{ cy: 'course-deletion-leaderboard-entry-confirm' }}
      />
    </div>
  )
}

export default CourseDeletionConfirmations
