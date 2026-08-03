import { ApolloError, useMutation, useQuery } from '@apollo/client'
import {
  DeleteCourseDocument,
  GetCourseSummaryDocument,
  GetUserCoursesDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Modal, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import CourseDeletionConfirmations from './CourseDeletionConfirmations'

export interface CourseDeletionConfirmationType {
  deleteParticipations: boolean
  disconnectLiveQuizzes: boolean
  deletePracticeQuizzes: boolean
  deleteMicroLearnings: boolean
  deleteGroupActivities: boolean
  deleteParticipantGroups: boolean
  deleteLeaderboardEntries: boolean
}

function CourseDeletionModal({
  onClose,
  courseId,
}: {
  onClose: () => void
  courseId: string | null
}) {
  const initialConfirmations: CourseDeletionConfirmationType = {
    deleteParticipations: false,
    disconnectLiveQuizzes: false,
    deletePracticeQuizzes: false,
    deleteMicroLearnings: false,
    deleteGroupActivities: false,
    deleteParticipantGroups: false,
    deleteLeaderboardEntries: false,
  }

  const [confirmations, setConfirmations] =
    useState<CourseDeletionConfirmationType>({
      ...initialConfirmations,
    })
  const [deletionError, setDeletionError] = useState<
    'retainedAdaptiveHistory' | 'generic' | null
  >(null)
  const t = useTranslations()

  // fetch course information
  const { data, loading: queryLoading } = useQuery(GetCourseSummaryDocument, {
    variables: { courseId: courseId ?? '' },
    skip: !courseId,
  })

  const [deleteCourse, { loading: courseDeleting }] =
    useMutation(DeleteCourseDocument)

  // skip confirmation for the elements where none are present
  useEffect(() => {
    if (!courseId || !data?.getCourseSummary) {
      return
    }

    setConfirmations({
      deleteParticipations: data.getCourseSummary.numOfParticipations === 0,
      disconnectLiveQuizzes: data.getCourseSummary.numOfLiveQuizzes === 0,
      deletePracticeQuizzes: data.getCourseSummary.numOfPracticeQuizzes === 0,
      deleteMicroLearnings: data.getCourseSummary.numOfMicroLearnings === 0,
      deleteGroupActivities: data.getCourseSummary.numOfGroupActivities === 0,
      deleteParticipantGroups:
        data.getCourseSummary.numOfParticipantGroups === 0,
      deleteLeaderboardEntries:
        data.getCourseSummary.numOfLeaderboardEntries === 0,
    })
  }, [courseId, data?.getCourseSummary])

  const summary = data?.getCourseSummary
  if (!courseId) {
    return null
  }

  return (
    <Modal
      open
      loading={queryLoading || !summary}
      onClose={() => {
        onClose()
        setConfirmations({ ...initialConfirmations })
        setDeletionError(null)
      }}
      className={{ content: 'w-full! max-w-240' }}
      title={t('manage.courseList.deleteCourse')}
      primaryLabel={t('shared.generic.confirm')}
      primaryButtonStyle="destructive"
      primaryLoading={courseDeleting}
      primaryDisabled={
        queryLoading ||
        Object.values(confirmations).some((confirmation) => !confirmation)
      }
      onPrimaryAction={async () => {
        setDeletionError(null)
        try {
          await deleteCourse({
            variables: { id: courseId },
            update: (cache, { data }) => {
              // check if the deletion was successful
              if (!data?.deleteCourse) return

              // remove the course from the queries list
              cache.updateQuery({ query: GetUserCoursesDocument }, (qData) => ({
                userCourses: qData?.userCourses?.filter(
                  (course) => course.id !== data.deleteCourse!.id
                ),
              }))
            },
          })
        } catch (error) {
          setDeletionError(
            hasGraphqlCode(error, 'ADAPTIVE_COURSE_HISTORY_RETAINED')
              ? 'retainedAdaptiveHistory'
              : 'generic'
          )
          return
        }
        onClose()
        setConfirmations({ ...initialConfirmations })
      }}
      dataPrimaryAction={{ cy: 'course-deletion-modal-confirm' }}
      secondaryLabel={t('shared.generic.close')}
      onSecondaryAction={() => {
        onClose()
        setConfirmations({ ...initialConfirmations })
        setDeletionError(null)
      }}
      dataSecondaryAction={{ cy: 'course-deletion-modal-cancel' }}
    >
      {deletionError && (
        <UserNotification
          type="error"
          message={t(`manage.courseList.deletionErrors.${deletionError}`)}
          className={{ root: 'mb-4' }}
          data={{ cy: 'course-deletion-error' }}
        />
      )}
      {summary && (
        <CourseDeletionConfirmations
          summary={summary}
          confirmations={confirmations}
          setConfirmations={setConfirmations}
        />
      )}
    </Modal>
  )
}

function hasGraphqlCode(error: unknown, code: string) {
  return (
    error instanceof ApolloError &&
    error.graphQLErrors.some(
      (graphqlError) => graphqlError.extensions?.code === code
    )
  )
}

export default CourseDeletionModal
