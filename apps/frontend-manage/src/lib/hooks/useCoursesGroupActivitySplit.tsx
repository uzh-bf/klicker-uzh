import { ElementSelectCourse } from '../../components/activities/ActivityCreation'

function useCoursesGroupActivitySplit({
  courseSelection,
}: {
  courseSelection: ElementSelectCourse[]
}) {
  return (
    courseSelection?.reduce<{
      coursesWithGroups: ElementSelectCourse[]
      assessmentCoursesWithGroups: ElementSelectCourse[]
      coursesWithoutGroups: ElementSelectCourse[]
    }>(
      (acc, course) => {
        if (course.isGroupCreationEnabled && course.isAssessmentEnabled) {
          acc.assessmentCoursesWithGroups.push({
            ...course,
            data: { cy: `select-course-${course.label}` },
          })
        } else if (course.isGroupCreationEnabled) {
          acc.coursesWithGroups.push({
            ...course,
            data: { cy: `select-course-${course.label}` },
          })
        } else {
          acc.coursesWithoutGroups.push({
            ...course,
            data: { cy: `select-course-${course.label}` },
          })
        }
        return acc
      },
      {
        coursesWithGroups: [],
        assessmentCoursesWithGroups: [],
        coursesWithoutGroups: [],
      }
    ) ?? {
      coursesWithGroups: [],
      assessmentCoursesWithGroups: [],
      coursesWithoutGroups: [],
    }
  )
}

export default useCoursesGroupActivitySplit
