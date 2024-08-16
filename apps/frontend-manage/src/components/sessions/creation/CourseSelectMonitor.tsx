import { useEffect } from 'react'
import { ElementSelectCourse } from './ElementCreation'
import { MicroLearningFormValues, PracticeQuizFormValues } from './WizardLayout'

function CourseSelectionMonitor({
  values,
  gamifiedCourses,
  setCourseGamified,
}: {
  values: MicroLearningFormValues | PracticeQuizFormValues
  gamifiedCourses?: ElementSelectCourse[]
  setCourseGamified: (value: boolean) => void
}) {
  useEffect(() => {
    if (values.courseId) {
      const course = gamifiedCourses?.find(
        (course) => course.value === values.courseId
      )
      setCourseGamified(!!course)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.courseId])

  return null
}

export default CourseSelectionMonitor
