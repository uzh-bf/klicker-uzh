import { useMutation, useQuery } from '@apollo/client'
import { faCheck, faExclamationCircle } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  DeleteCourseDocument,
  GetCourseSummaryDocument,
  GetUserCoursesDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, Modal, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

function CourseDeletionItem({
  label,
  confirmed,
  onClick,
}: {
  label: string
  confirmed: boolean
  onClick: () => void
}) {
  const t = useTranslations()

  return (
    <div className="flex h-10 flex-row items-center justify-between border-b pb-2">
      <div className="flex flex-row items-center gap-4">
        <FontAwesomeIcon icon={faExclamationCircle} className="text-red-600" />
        <div className="mr-4">{label}</div>
      </div>
      {confirmed ? (
        <FontAwesomeIcon icon={faCheck} className="text-green-700" />
      ) : (
        <Button onClick={onClick} className={{ root: 'h-7 border-red-600' }}>
          {t('shared.generic.confirm')}
        </Button>
      )}
    </div>
  )
}

interface CourseDeletionModalProps {
  open: boolean
  setOpen: (open: boolean) => void
  courseId: string | null
}

const initialConfirmations = {
  disconnectLiveQuizzes: false,
  deletePracticeQuizzes: false,
  deleteMicroLearnings: false,
  deleteGroupActivities: false,
  deleteParticipantGroups: false,
  deleteLeaderboardEntries: false,
}

function CourseDeletionModal({
  open,
  setOpen,
  courseId,
}: CourseDeletionModalProps) {
  const [confirmations, setConfirmations] = useState(initialConfirmations)
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
  }, [courseId, data])

  if (!courseId || !data?.getCourseSummary) {
    return null
  }

  const summary = data.getCourseSummary

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
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
          onClick={() => setOpen(false)}
          data={{ cy: 'course-deletion-modal-cancel' }}
        >
          {t('shared.generic.close')}
        </Button>
      }
    >
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
            confirmations.disconnectLiveQuizzes = true
            setConfirmations({ ...confirmations })
          }}
          confirmed={confirmations.disconnectLiveQuizzes}
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
            confirmations.deletePracticeQuizzes = true
            setConfirmations({ ...confirmations })
          }}
          confirmed={confirmations.deletePracticeQuizzes}
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
            confirmations.deleteMicroLearnings = true
            setConfirmations({ ...confirmations })
          }}
          confirmed={confirmations.deleteMicroLearnings}
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
            confirmations.deleteGroupActivities = true
            setConfirmations({ ...confirmations })
          }}
          confirmed={confirmations.deleteGroupActivities}
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
            confirmations.deleteParticipantGroups = true
            setConfirmations({ ...confirmations })
          }}
          confirmed={confirmations.deleteParticipantGroups}
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
            confirmations.deleteLeaderboardEntries = true
            setConfirmations({ ...confirmations })
          }}
          confirmed={confirmations.deleteLeaderboardEntries}
        />
      </div>
    </Modal>
  )
}

export default CourseDeletionModal
