import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction } from 'react'
import CourseDeletionItem from './CourseDeletionItem'
import { CourseDeletionConfirmationType } from './CourseDeletionModal'

interface CourseDeletionConfirmationsProps {
  summary: {
    numOfLiveQuizzes: number
    numOfPracticeQuizzes: number
    numOfMicroLearnings: number
    numOfGroupActivities: number
    numOfParticipantGroups: number
    numOfLeaderboardEntries: number
  }
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
      <CourseDeletionItem
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
        data={{ cy: 'course-deletion-live-quiz-confirm' }}
      />
      <CourseDeletionItem
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
        data={{ cy: 'course-deletion-practice-quiz-confirm' }}
      />
      <CourseDeletionItem
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
        data={{ cy: 'course-deletion-micro-learning-confirm' }}
      />
      <CourseDeletionItem
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
        data={{ cy: 'course-deletion-group-activity-confirm' }}
      />
      <CourseDeletionItem
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
        data={{ cy: 'course-deletion-participant-group-confirm' }}
      />
      <CourseDeletionItem
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
        data={{ cy: 'course-deletion-leaderboard-entry-confirm' }}
      />
    </div>
  )
}

export default CourseDeletionConfirmations
