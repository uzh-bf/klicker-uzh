import dayjs from 'dayjs'
import { useMemo } from 'react'

type DateLike = Date | string

type LocalCourseType = {
  id: string
  displayName: string
  description?: string
  isSubscribed: boolean
  startDate: DateLike
  endDate: DateLike
  isGamificationEnabled: boolean
}

type LocalLiveQuizType = {
  id: string
  displayName: string
  courseName: string
}

type LocalMicroLearningType = {
  id: string
  displayName: string
  scheduledStartAt: DateLike
  scheduledEndAt: DateLike
  courseId: string
  courseName: string
  isCompleted: boolean
}

type StudentOverviewParticipation = {
  id: number
  completedMicroLearnings: string[]
  subscriptions?: { id: number; endpoint: string }[] | null
  course?: {
    id: string
    displayName: string
    startDate: DateLike
    endDate: DateLike
    isGamificationEnabled: boolean
    liveQuizzes?: { id: string; displayName: string }[] | null
    microLearnings?:
      | {
          id: string
          displayName: string
          scheduledStartAt: DateLike
          scheduledEndAt: DateLike
        }[]
      | null
  } | null
}

function useStudentOverviewSplit({
  participations,
}: {
  participations: StudentOverviewParticipation[]
}) {
  return useMemo((): {
    courses: LocalCourseType[]
    oldCourses: LocalCourseType[]
    activeLiveQuizzes: LocalLiveQuizType[]
    activeMicrolearning: LocalMicroLearningType[]
  } => {
    const obj = {
      courses: [] as LocalCourseType[],
      oldCourses: [] as LocalCourseType[],
      activeLiveQuizzes: [] as LocalLiveQuizType[],
      activeMicrolearning: [] as LocalMicroLearningType[],
    }
    return participations.reduce((acc, participation) => {
      if (!participation.course) return acc
      const course = participation.course

      return {
        courses:
          // check if endDate of course is before today or today
          dayjs(participation.course?.endDate).isAfter(dayjs()) ||
          dayjs(participation.course?.endDate).isSame(dayjs())
            ? [
                ...acc.courses,
                {
                  id: participation.course?.id,
                  displayName: participation.course?.displayName,
                  startDate: participation.course?.startDate,
                  endDate: participation.course?.endDate,
                  isGamificationEnabled:
                    participation.course?.isGamificationEnabled,
                  isSubscribed:
                    (participation.subscriptions &&
                      participation.subscriptions.length > 0) ??
                    false,
                },
              ]
            : acc.courses,
        oldCourses: dayjs(participation.course?.endDate).isBefore(dayjs())
          ? [
              ...acc.oldCourses,
              {
                id: participation.course?.id,
                displayName: participation.course?.displayName,
                startDate: participation.course?.startDate,
                endDate: participation.course?.endDate,
                isGamificationEnabled:
                  participation.course?.isGamificationEnabled,
                isSubscribed:
                  (participation.subscriptions &&
                    participation.subscriptions.length > 0) ??
                  false,
              },
            ]
          : acc.oldCourses,
        activeLiveQuizzes: [
          ...acc.activeLiveQuizzes,
          ...(course.liveQuizzes?.map((quiz) => ({
            id: quiz.id,
            displayName: quiz.displayName,
            courseName: course.displayName,
          })) ?? []),
        ],
        activeMicrolearning: [
          ...acc.activeMicrolearning,
          ...(course.microLearnings?.map((micro) => ({
            id: micro.id,
            displayName: micro.displayName,
            scheduledStartAt: micro.scheduledStartAt,
            scheduledEndAt: micro.scheduledEndAt,
            courseId: course.id,
            courseName: course.displayName,
            isCompleted: participation.completedMicroLearnings?.includes(
              micro.id
            ),
          })) ?? []),
        ],
      }
    }, obj)
  }, [participations])
}

export default useStudentOverviewSplit
