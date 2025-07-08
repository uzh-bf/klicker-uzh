import { useMutation, useQuery } from '@apollo/client'
import {
  DeleteCourseDocument,
  GetCourseSummaryDocument,
  GetUserCoursesDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Modal } from '@uzh-bf/design-system'
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
  const t = useTranslations()

  // fetch course information
  const { data, loading: queryLoading } = useQuery(GetCourseSummaryDocument, {
    variables: { courseId: courseId ?? '' },
    skip: !courseId,
  })

  const [deleteCourse, { loading: courseDeleting }] = useMutation(
    DeleteCourseDocument,
    {
      update(cache, res) {
        const data = cache.readQuery({
          query: GetUserCoursesDocument,
        })
        cache.writeQuery({
          query: GetUserCoursesDocument,
          data: {
            userCourses:
              data?.userCourses?.filter(
                (e) => e.id !== res.data?.deleteCourse?.id
              ) ?? [],
          },
        })
      },
    }
  )

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
      onClose={() => {
        onClose()
        setConfirmations({ ...initialConfirmations })
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
        await deleteCourse({
          variables: { id: courseId },

          optimisticResponse: {
            __typename: 'Mutation',
            deleteCourse: {
              __typename: 'Course',
              id: courseId,
            },
          },
        })
        onClose()
        setConfirmations({ ...initialConfirmations })
      }}
      dataPrimaryAction={{ cy: 'course-deletion-modal-confirm' }}
      secondaryLabel={t('shared.generic.close')}
      onSecondaryAction={() => {
        onClose()
        setConfirmations({ ...initialConfirmations })
      }}
      dataSecondaryAction={{ cy: 'course-deletion-modal-cancel' }}
    >
      {queryLoading || !summary ? (
        <Loader />
      ) : (
        <CourseDeletionConfirmations
          summary={summary}
          confirmations={confirmations}
          setConfirmations={setConfirmations}
        />
      )}
    </Modal>
  )
}

export default CourseDeletionModal
