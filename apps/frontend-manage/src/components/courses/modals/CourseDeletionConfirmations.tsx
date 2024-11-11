import { CourseSummary } from '@klicker-uzh/graphql/dist/ops'
import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction } from 'react'
import ConfirmationItem from '../../common/ConfirmationItem'
import { CourseDeletionConfirmationType } from './CourseDeletionModal'

interface CourseDeletionConfirmationsProps {
  summary: CourseSummary
  confirmations: CourseDeletionConfirmationType
  setConfirmations: Dispatch<SetStateAction<CourseDeletionConfirmationType>>
}

function CourseDeletionConfirmations({
  summary,
  confirmations,
  setConfirmations,
}: CourseDeletionConfirmationsProps) {
  const t = useTranslations()

  return (
    <div className="flex flex-col gap-2">
      <UserNotification
        type="warning"
        message={t('manage.courseList.courseDeletionMessage')}
        className={{ root: 'mb-1 text-base' }}
      />
      <ConfirmationItem
        label={
          summary.numOfParticipations === 0
            ? t('manage.courseList.noParticipationsToDelete')
            : t('manage.courseList.deleteParticipations', {
                number: summary.numOfParticipations,
              })
        }
        onClick={() => {
          setConfirmations((prev) => ({
            ...prev,
            deleteParticipations: true,
          }))
        }}
        confirmed={confirmations.deleteParticipations}
        notApplicable={summary.numOfParticipations === 0}
        confirmationType="delete"
        data={{ cy: 'course-deletion-participations-confirm' }}
      />
      <ConfirmationItem
        label={
          summary.numOfLiveQuizzes === 0
            ? t('manage.courseList.noLiveQuizzesDisconnected')
            : t('manage.courseList.disconnectLiveQuizzes', {
                number: summary.numOfLiveQuizzes,
              })
        }
        onClick={() => {
          setConfirmations((prev) => ({
            ...prev,
            disconnectLiveQuizzes: true,
          }))
        }}
        confirmed={confirmations.disconnectLiveQuizzes}
        notApplicable={summary.numOfLiveQuizzes === 0}
        confirmationType="delete"
        data={{ cy: 'course-deletion-live-quiz-confirm' }}
      />
      <ConfirmationItem
        label={
          summary.numOfPracticeQuizzes === 0
            ? t('manage.courseList.noPracticeQuizzesToDelete')
            : t('manage.courseList.deletePracticeQuizzes', {
                number: summary.numOfPracticeQuizzes,
              })
        }
        onClick={() => {
          setConfirmations((prev) => ({
            ...prev,
            deletePracticeQuizzes: true,
          }))
        }}
        confirmed={confirmations.deletePracticeQuizzes}
        notApplicable={summary.numOfPracticeQuizzes === 0}
        confirmationType="delete"
        data={{ cy: 'course-deletion-practice-quiz-confirm' }}
      />
      <ConfirmationItem
        label={
          summary.numOfMicroLearnings === 0
            ? t('manage.courseList.noMicroLearningsToDelete')
            : t('manage.courseList.deleteMicroLearnings', {
                number: summary.numOfMicroLearnings,
              })
        }
        onClick={() => {
          setConfirmations((prev) => ({
            ...prev,
            deleteMicroLearnings: true,
          }))
        }}
        confirmed={confirmations.deleteMicroLearnings}
        notApplicable={summary.numOfMicroLearnings === 0}
        confirmationType="delete"
        data={{ cy: 'course-deletion-micro-learning-confirm' }}
      />
      <ConfirmationItem
        label={
          summary.numOfGroupActivities === 0
            ? t('manage.courseList.noGroupActivitiesToDelete')
            : t('manage.courseList.deleteGroupActivities', {
                number: summary.numOfGroupActivities,
              })
        }
        onClick={() => {
          setConfirmations((prev) => ({
            ...prev,
            deleteGroupActivities: true,
          }))
        }}
        confirmed={confirmations.deleteGroupActivities}
        notApplicable={summary.numOfGroupActivities === 0}
        confirmationType="delete"
        data={{ cy: 'course-deletion-group-activity-confirm' }}
      />
      <ConfirmationItem
        label={
          summary.numOfParticipantGroups === 0
            ? t('manage.courseList.noParticipantGroupsToDelete')
            : t('manage.courseList.deleteParticipantGroups', {
                number: summary.numOfParticipantGroups,
              })
        }
        onClick={() => {
          setConfirmations((prev) => ({
            ...prev,
            deleteParticipantGroups: true,
          }))
        }}
        confirmed={confirmations.deleteParticipantGroups}
        notApplicable={summary.numOfParticipantGroups === 0}
        confirmationType="delete"
        data={{ cy: 'course-deletion-participant-group-confirm' }}
      />
      <ConfirmationItem
        label={
          summary.numOfLeaderboardEntries === 0
            ? t('manage.courseList.noLeaderboardEntriesToDelete')
            : t('manage.courseList.deleteLeaderboardEntries', {
                number: summary.numOfLeaderboardEntries,
              })
        }
        onClick={() => {
          setConfirmations((prev) => ({
            ...prev,
            deleteLeaderboardEntries: true,
          }))
        }}
        confirmed={confirmations.deleteLeaderboardEntries}
        notApplicable={summary.numOfLeaderboardEntries === 0}
        confirmationType="delete"
        data={{ cy: 'course-deletion-leaderboard-entry-confirm' }}
      />
    </div>
  )
}

export default CourseDeletionConfirmations
