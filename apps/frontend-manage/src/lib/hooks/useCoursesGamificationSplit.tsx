import { ElementSelectCourse } from '../../components/activities/ActivityCreation'

function useCoursesGamificationSplit({
  courseSelection,
}: {
  courseSelection: ElementSelectCourse[]
}) {
  return (
    courseSelection?.reduce<{
      gamifiedCourses: ElementSelectCourse[]
      nonGamifiedCourses: ElementSelectCourse[]
      assessmentCourses: ElementSelectCourse[]
    }>(
      (acc, course) => {
        if (course.isAssessmentEnabled) {
          acc.assessmentCourses.push({
            ...course,
            data: { cy: `select-course-${course.label}` },
          })
        } else if (course.isGamified) {
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
      { gamifiedCourses: [], nonGamifiedCourses: [], assessmentCourses: [] }
    ) ?? { gamifiedCourses: [], nonGamifiedCourses: [], assessmentCourses: [] }
  )
}

export default useCoursesGamificationSplit
