import type * as DB from '@klicker-uzh/prisma/client'

type ControlCourseListItem = Pick<
  DB.Course,
  'description' | 'displayName' | 'id' | 'isArchived' | 'name'
>

type ControlCourseSource = Pick<DB.Course, 'id' | 'name'> & {
  liveQuizzes?: Pick<DB.LiveQuiz, 'id' | 'name' | 'status'>[] | null
}

type BasicCourseInformationSource = Pick<
  DB.Course,
  'color' | 'description' | 'displayName' | 'id'
> & {
  owner: Pick<DB.User, 'shortname'>
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

export function toBasicCourseInformation(
  course: BasicCourseInformationSource | null
) {
  if (!course) return null

  return {
    id: course.id,
    displayName: course.displayName,
    description: course.description,
    color: course.color,
    owner: {
      shortname: course.owner.shortname,
    },
  }
}
