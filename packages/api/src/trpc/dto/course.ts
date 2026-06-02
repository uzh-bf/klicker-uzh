import type * as DB from '@klicker-uzh/prisma/client'

type ControlCourseListItem = Pick<
  DB.Course,
  'description' | 'displayName' | 'id' | 'isArchived' | 'name'
>

type ControlCourseSource = Pick<DB.Course, 'id' | 'name'> & {
  liveQuizzes?: Pick<DB.LiveQuiz, 'id' | 'name' | 'status'>[] | null
}

export function toControlCourseListItem(course: ControlCourseListItem) {
  return {
    id: course.id,
    name: course.name,
    isArchived: course.isArchived,
    displayName: course.displayName,
    description: course.description,
  }
}

export function toControlCourse(course: ControlCourseSource | null) {
  if (!course) return null

  return {
    id: course.id,
    name: course.name,
    liveQuizzes:
      course.liveQuizzes?.map((quiz) => ({
        id: quiz.id,
        name: quiz.name,
        status: quiz.status,
      })) ?? [],
  }
}
