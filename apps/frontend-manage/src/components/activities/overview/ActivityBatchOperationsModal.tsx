import { faCheck, faX } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ActivityInfo,
  ActivityType,
  ApplyActivityBatchOperationsDocument,
  GetActiveUserCoursesDocument,
  PublicationStatus,
} from '@klicker-uzh/graphql/dist/ops'
//           : null,
//       course: selectedActions.course ?? undefined,
//       liveQuizPoints: selectedActions.liveQuizPoints ?? undefined,
//     },
//   })ops'
import { ApolloError, useMutation, useQuery } from '@apollo/client'
import { Button, Modal, toast } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import { isShallowEqual } from 'remeda'
import { twMerge } from 'tailwind-merge'
import ActivityBatchOperationsInfo from './batchOperations/ActivityBatchOperationsInfo'
import ActivityCourseCard from './batchOperations/ActivityCourseCard'
import ActivityLiveQuizPointsCard from './batchOperations/ActivityLiveQuizPointsCard'
import ActivityMultiplierCard from './batchOperations/ActivityMultiplierCard'
import SelectedActivitiesList from './batchOperations/SelectedActivitiesList'
import {
  ActivityBatchOperationActions,
  INITIAL_ACTIVITY_BATCH_OPERATIONS,
} from './batchOperations/types'

function ActivityBatchOperationsModal({
  selectedActivities,
  onClose,
  resetSelectedActivities,
  refetchActivities,
}: {
  selectedActivities: ActivityInfo[]
  onClose: () => void
  resetSelectedActivities: () => void
  refetchActivities: () => Promise<void>
}) {
  const t = useTranslations()
  const [affectedActivities, setAffectedActivities] = useState(
    selectedActivities.map((activity) => ({
      ...activity,
      actionsApplied: true,
      reasons: [] as string[],
    }))
  )
  const [selectedActions, setSelectedActions] =
    useState<ActivityBatchOperationActions>(INITIAL_ACTIVITY_BATCH_OPERATIONS)

  // database mutation to execute activity batch operations
  const [applyActivityBatchOperations, { loading: applying }] = useMutation(
    ApplyActivityBatchOperationsDocument
  )

  const { loading: loadingCourses, data: dataCourses } = useQuery(
    GetActiveUserCoursesDocument,
    { fetchPolicy: 'network-only' }
  )

  // whenever the applied filters change, update the affected activities
  useEffect(() => {
    const updatedAffectedActivities = selectedActivities.map((activity) => {
      let actionsApplied = true
      const reasons: string[] = []

      // only allow batch operations on draft or scheduled activities
      if (
        activity.status !== PublicationStatus.Draft &&
        activity.status !== PublicationStatus.Scheduled
      ) {
        actionsApplied = false
        reasons.push(t('manage.activities.batchInvalidStatus'))
      }

      // insufficient permissions - all operations require write permissions
      if (!activity.isEditor) {
        actionsApplied = false
        reasons.push(t('manage.activities.batchNeedEditorPermissions'))
      }

      // multiplier modification with course modification at the same time (selected course settings apply)
      if (
        typeof selectedActions.multiplier !== 'undefined' &&
        selectedActions.multiplier !== null &&
        selectedActions.course?.id &&
        !selectedActions.course.isAssessmentEnabled &&
        !selectedActions.course.isGamificationEnabled
      ) {
        actionsApplied = false
        reasons.push(
          t('manage.activities.batchMultiplierRequiresGamificationOrAssessment')
        )
      }

      // if the course assignment is not modified, the assigned course settings
      else if (
        typeof selectedActions.multiplier !== 'undefined' &&
        selectedActions.multiplier !== null &&
        !selectedActions.course?.id &&
        (!activity.courseId ||
          (!activity.isGamificationEnabled && !activity.isAssessmentEnabled))
      ) {
        actionsApplied = false
        reasons.push(
          t('manage.activities.batchMultiplierRequiresGamificationOrAssessment')
        )
      }

      // course assignment change
      if (selectedActions.course?.id) {
        // assessment activities can only be removed from assessment courses by course admins
        if (
          activity.isAssessmentEnabled &&
          !activity.isActivityReviewer &&
          selectedActions.course.id !== activity.courseId
        ) {
          actionsApplied = false
          reasons.push(t('manage.activities.batchAssessmentRemovalAdminOnly'))
        }

        // group activities can only be assigned to courses with groups enabled
        if (
          activity.type === ActivityType.GroupActivity &&
          !selectedActions.course.isGroupCreationEnabled
        ) {
          actionsApplied = false
          reasons.push(
            t('manage.activities.batchGroupActivityRequiresGroupsEnabled')
          )
        }

        // for group activities, verify that the start date is after the group formation deadline
        if (
          activity.type === ActivityType.GroupActivity &&
          selectedActions.course.groupDeadlineDate
        ) {
          const activityStart = dayjs(activity.scheduledStartAt)
          const groupFormationDeadline = dayjs(
            selectedActions.course.groupDeadlineDate
          )

          if (activityStart.isBefore(groupFormationDeadline)) {
            actionsApplied = false
            reasons.push(
              t('manage.activities.batchGroupActivityRequiresFinalizedGroups')
            )
          }
        }

        // scheduled practice quizzes can only be assigned to courses where the scheduled start date lies within the course duration
        if (
          activity.type === ActivityType.PracticeQuiz &&
          activity.automaticPublicationAt &&
          dayjs(activity.automaticPublicationAt).isAfter(dayjs()) &&
          (dayjs(activity.automaticPublicationAt).isBefore(
            dayjs(selectedActions.course.startDate)
          ) ||
            dayjs(activity.automaticPublicationAt).isAfter(
              dayjs(selectedActions.course.endDate)
            ))
        ) {
          actionsApplied = false
          reasons.push(
            t('manage.activities.batchPracticeQuizScheduledWithinCourse')
          )
        }

        // for microlearnings and group activities, verify start/end dates lie within course dates
        if (
          activity.type === ActivityType.MicroLearning ||
          activity.type === ActivityType.GroupActivity
        ) {
          const activityStart = dayjs(activity.scheduledStartAt)
          const activityEnd = dayjs(activity.scheduledEndAt)
          const courseStart = dayjs(selectedActions.course.startDate)
          const courseEnd = dayjs(selectedActions.course.endDate)

          if (
            activityStart.isBefore(courseStart) ||
            activityEnd.isAfter(courseEnd)
          ) {
            actionsApplied = false
            reasons.push(t('manage.activities.batchActivityDatesOutsideCourse'))
          }
        }
      }

      // live quiz points modification
      if (
        typeof selectedActions.liveQuizPoints !== 'undefined' &&
        (activity.type !== ActivityType.LiveQuiz ||
          (!selectedActions.course?.id &&
            !activity.isGamificationEnabled &&
            !activity.isAssessmentEnabled))
      ) {
        actionsApplied = false
        reasons.push(t('manage.activities.batchPointsOnlyLiveQuiz'))
      }

      return {
        ...activity,
        actionsApplied,
        reasons,
      }
    })

    setAffectedActivities(updatedAffectedActivities)
  }, [selectedActivities, selectedActions])

  // if the course changes to a non-gamified non-assessment course, no points are awarded
  // -> multiplier and live quiz points settings need to be blocked
  useEffect(() => {
    if (
      selectedActions.course?.id &&
      !selectedActions.course.isGamificationEnabled &&
      !selectedActions.course.isAssessmentEnabled
    ) {
      setSelectedActions((prev) => ({
        ...prev,
        multiplier: undefined,
        liveQuizPoints: undefined,
      }))
    }
  }, [selectedActions.course])

  const numOfUpdatedActivities = useMemo(() => {
    return affectedActivities.filter((activity) => activity.actionsApplied)
      .length
  }, [affectedActivities])

  return (
    <Modal
      open
      onClose={onClose}
      loading={loadingCourses}
      title={t('manage.activities.batchOperationsActivities')}
      className={{
        content: 'xl:w-220 h-max w-[calc(100%-2rem)] lg:overflow-hidden',
      }}
      dataCloseButton={{ cy: 'close-batch-operations-modal' }}
    >
      <div className="flex h-auto min-h-0 flex-col gap-6 md:flex-row md:gap-6 lg:h-full lg:max-h-full">
        <div className="flex h-max max-h-full min-h-0 w-full flex-col gap-4 overflow-auto md:w-1/2 lg:max-h-[calc(100vh-6rem)] lg:w-2/5">
          <div className="text-sm">
            {t('manage.activities.selectedActivitiesDescription')}
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <SelectedActivitiesList
              selectedActivities={selectedActivities}
              affectedActivities={affectedActivities}
            />
          </div>
        </div>
        <div className="w-full overflow-auto px-0.5 pb-2 md:w-1/2 lg:max-h-[calc(100vh-6rem)] lg:w-3/5">
          <div className="flex flex-row items-center gap-2.5">
            <div className="font-bold">
              {t('shared.generic.availableActions')}
            </div>
            <ActivityBatchOperationsInfo />
          </div>

          <div className="mt-2 flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <ActivityMultiplierCard
                selectedActions={selectedActions}
                setSelectedActions={setSelectedActions}
              />
              <ActivityCourseCard
                selectedActions={selectedActions}
                setSelectedActions={setSelectedActions}
                courses={dataCourses?.getActiveUserCourses ?? []}
              />
              <ActivityLiveQuizPointsCard
                selectedActions={selectedActions}
                setSelectedActions={setSelectedActions}
              />
            </div>
            <div className="flex flex-row items-center gap-5 self-end">
              <span
                className={twMerge(
                  'text-sm text-green-700',
                  numOfUpdatedActivities === 0 && 'text-red-600'
                )}
              >
                <FontAwesomeIcon
                  icon={numOfUpdatedActivities === 0 ? faX : faCheck}
                  className="mr-1.5"
                />
                {numOfUpdatedActivities === 0
                  ? t('manage.activities.noActivitiesWillBeUpdated')
                  : numOfUpdatedActivities === selectedActivities.length
                    ? t('manage.activities.nActivitiesWillBeUpdated', {
                        number: numOfUpdatedActivities,
                      })
                    : t('manage.activities.nActivitiesWillBeUpdated', {
                        number: `${numOfUpdatedActivities}/${selectedActivities.length}`,
                      })}
              </span>
              <Button
                primary
                disabled={
                  applying ||
                  numOfUpdatedActivities === 0 ||
                  isShallowEqual(
                    selectedActions,
                    INITIAL_ACTIVITY_BATCH_OPERATIONS
                  ) ||
                  (selectedActions.course && !selectedActions.course.id)
                }
                onClick={async () => {
                  try {
                    const { data: res } = await applyActivityBatchOperations({
                      variables: {
                        activityIds: selectedActivities.map(
                          (activity) => activity.id
                        ),
                        multiplier:
                          typeof selectedActions.multiplier !== 'undefined' &&
                          selectedActions.multiplier !== ''
                            ? parseInt(selectedActions.multiplier, 10)
                            : null,
                        courseId: selectedActions.course?.id,
                        basePoints: selectedActions.liveQuizPoints?.basePoints,
                        correctnessPoints:
                          selectedActions.liveQuizPoints?.correctnessPoints,
                        bonusPoints:
                          selectedActions.liveQuizPoints?.bonusPoints,
                        timeToZeroBonus:
                          selectedActions.liveQuizPoints?.bonusTime,
                      },
                    })

                    if (
                      res?.applyActivityBatchOperations ===
                      numOfUpdatedActivities
                    ) {
                      resetSelectedActivities()
                      await refetchActivities()
                      toast({
                        type: 'success',
                        message: t('manage.activities.batchOperationSuccess'),
                        options: { duration: 3000 },
                      })
                      onClose()
                    } else if (res?.applyActivityBatchOperations !== 0) {
                      resetSelectedActivities()
                      await refetchActivities()
                      toast({
                        type: 'warning',
                        message: t(
                          'manage.activities.batchOperationPartialSuccess'
                        ),
                        options: { duration: 4500 },
                      })
                      onClose()
                    } else {
                      toast({
                        type: 'error',
                        message: t('manage.activities.batchOperationFailed'),
                        options: { duration: 5000 },
                      })
                    }
                  } catch (error) {
                    console.error(error)
                    const isCorrelatedGamificationConflict =
                      error instanceof ApolloError &&
                      error.graphQLErrors.some(
                        (graphQLError) =>
                          graphQLError.extensions?.code ===
                          'LIVE_QUIZ_CORRELATED_GAMIFICATION_CONFLICT'
                      )
                    toast({
                      type: 'error',
                      message: isCorrelatedGamificationConflict
                        ? t(
                            'manage.activities.batchCorrelatedGamificationConflict'
                          )
                        : t('manage.activities.batchOperationFailed'),
                      options: { duration: 5000 },
                    })
                  }
                }}
                className={{ root: 'h-9' }}
                data={{ cy: 'apply-batch-operations' }}
              >
                {t('shared.generic.apply')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default ActivityBatchOperationsModal
