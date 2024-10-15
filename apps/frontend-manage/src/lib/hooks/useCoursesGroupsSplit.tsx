import { ElementSelectCourse } from '../../components/sessions/creation/ElementCreation'

function useCoursesGroupsSplit({
  courseSelection,
}: {
  courseSelection: ElementSelectCourse[]
}) {
  return (
    courseSelection?.reduce<{
      coursesWithGroups: ElementSelectCourse[]
      coursesWithoutGroups: ElementSelectCourse[]
    }>(
      (acc, course) => {
        if (course.isGroupCreationEnabled) {
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
      { coursesWithGroups: [], coursesWithoutGroups: [] }
    ) ?? { coursesWithGroups: [], coursesWithoutGroups: [] }
  )
}

export default useCoursesGroupsSplit
