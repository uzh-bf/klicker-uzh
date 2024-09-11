import { ElementSelectCourse } from '../../components/sessions/creation/ElementCreation'

function useCoursesGamificationSplit({
  courseSelection,
}: {
  courseSelection: ElementSelectCourse[]
}) {
  return (
    courseSelection?.reduce<{
      gamifiedCourses: ElementSelectCourse[]
      nonGamifiedCourses: ElementSelectCourse[]
    }>(
      (acc, course) => {
        if (course.isGamified) {
          acc.gamifiedCourses.push({
            ...course,
            data: { cy: `select-course-${course.label}` },
          })
        } else {
          acc.nonGamifiedCourses.push({
            ...course,
            data: { cy: `select-course-${course.label}` },
          })
        }
        return acc
      },
      { gamifiedCourses: [], nonGamifiedCourses: [] }
    ) ?? { gamifiedCourses: [], nonGamifiedCourses: [] }
  )
}

export default useCoursesGamificationSplit
