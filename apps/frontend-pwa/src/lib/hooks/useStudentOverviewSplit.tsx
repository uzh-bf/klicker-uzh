import type {
  ActivityInfo,
  Course,
  LiveQuiz,
  MicroLearning,
  Participation,
} from '@klicker-uzh/graphql/dist/ops'
import dayjs from 'dayjs'
import { useMemo } from 'react'

type LocalCourseType = {
  id: string
  displayName: string
  description?: string
  isSubscribed: boolean
  isLeaderboardParticipant: boolean
  startDate: string
  endDate: string
  isGamificationEnabled: boolean
  studyStreakCurrent: number
}

type LocalLiveQuizType = Pick<LiveQuiz, 'id' | 'displayName'> & {
  courseName: string
}

type LocalMicroLearningType = Pick<
  MicroLearning,
  'id' | 'displayName' | 'scheduledStartAt' | 'scheduledEndAt'
> & {
  courseId: string
  courseName: string
  isCompleted: boolean
}

function useStudentOverviewSplit({
  participations,
}: {
  participations: (Pick<
    Participation,
    | 'id'
    | 'isActive'
    | 'studyStreakCurrent'
    | 'completedMicroLearnings'
    | 'subscriptions'
  > & {
    course?:
      | (Pick<
          Course,
          | 'id'
          | 'displayName'
          | 'startDate'
          | 'endDate'
          | 'isGamificationEnabled'
        > & {
          liveQuizzes?: Pick<ActivityInfo, 'id' | 'displayName'>[] | null
          microLearnings?:
            | Pick<
                ActivityInfo,
                'id' | 'displayName' | 'scheduledStartAt' | 'scheduledEndAt'
              >[]
            | null
        })
      | null
  })[]
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
                  isLeaderboardParticipant: participation.isActive,
                  studyStreakCurrent: participation.studyStreakCurrent,
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
                isLeaderboardParticipant: participation.isActive,
                studyStreakCurrent: participation.studyStreakCurrent,
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
