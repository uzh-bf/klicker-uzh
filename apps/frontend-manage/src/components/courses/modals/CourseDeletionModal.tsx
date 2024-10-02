import { useMutation, useQuery } from '@apollo/client'
import {
  DeleteCourseDocument,
  GetCourseSummaryDocument,
  GetUserCoursesDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import CourseDeletionConfirmations from './CourseDeletionConfirmations'

export interface CourseDeletionConfirmationType {
  disconnectLiveQuizzes: boolean
  deletePracticeQuizzes: boolean
  deleteMicroLearnings: boolean
  deleteGroupActivities: boolean
  deleteParticipantGroups: boolean
  deleteLeaderboardEntries: boolean
}

interface CourseDeletionModalProps {
  open: boolean
  setOpen: (open: boolean) => void
  courseId: string | null
  setSelectedCourseId: (courseId: string | null) => void
}

function CourseDeletionModal({
  open,
  setOpen,
  courseId,
  setSelectedCourseId,
}: CourseDeletionModalProps) {
  const initialConfirmations: CourseDeletionConfirmationType = {
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

  if (!courseId || !data?.getCourseSummary) {
    return null
  }

  const summary = data.getCourseSummary

  return (
    <Modal
      open={open}
      onClose={() => {
        setOpen(false)
        setSelectedCourseId(null)
        setConfirmations({ ...initialConfirmations })
      }}
      className={{ content: 'h-max min-h-max !w-max' }}
      title={t('manage.courseList.deleteCourse')}
      onPrimaryAction={
        <Button
          loading={courseDeleting}
          disabled={
            queryLoading ||
            Object.values(confirmations).some((confirmation) => !confirmation)
          }
          onClick={async () => {
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
            setOpen(false)
            setSelectedCourseId(null)
            setConfirmations({ ...initialConfirmations })
          }}
          className={{
            root: 'bg-red-700 text-white hover:bg-red-800 hover:text-white disabled:bg-opacity-50 disabled:hover:cursor-not-allowed',
          }}
          data={{ cy: 'course-deletion-modal-confirm' }}
        >
          {t('shared.generic.confirm')}
        </Button>
      }
      onSecondaryAction={
        <Button
          onClick={() => {
            setOpen(false)
            setSelectedCourseId(null)
            setConfirmations({ ...initialConfirmations })
          }}
          data={{ cy: 'course-deletion-modal-cancel' }}
        >
          {t('shared.generic.close')}
        </Button>
      }
    >
      <CourseDeletionConfirmations
        summary={summary}
        confirmations={confirmations}
        setConfirmations={setConfirmations}
      />
    </Modal>
  )
}

export default CourseDeletionModal
