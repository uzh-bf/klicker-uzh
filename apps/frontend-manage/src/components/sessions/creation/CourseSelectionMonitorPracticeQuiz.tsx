import { FormikErrors, FormikTouched } from 'formik'
import { SetStateAction, useEffect } from 'react'
import { ElementSelectCourse } from './ElementCreation'
import { PracticeQuizFormValues } from './WizardLayout'

function CourseSelectionMonitorPracticeQuiz({
  values,
  gamifiedCourses,
  nonGamifiedCourses,
  setCourseGamified,
  setTouched,
  setValues,
}: {
  values: PracticeQuizFormValues
  gamifiedCourses?: ElementSelectCourse[]
  nonGamifiedCourses?: ElementSelectCourse[]
  setCourseGamified: (value: boolean) => void
  setTouched: (
    touched: FormikTouched<PracticeQuizFormValues>
  ) => Promise<void | FormikErrors<PracticeQuizFormValues>>
  setValues: (
    values: SetStateAction<PracticeQuizFormValues>,
    shouldValidate?: boolean
  ) => Promise<void | FormikErrors<PracticeQuizFormValues>>
}) {
  useEffect(() => {
    if (values.courseId) {
      let course = gamifiedCourses?.find(
        (course) => course.value === values.courseId
      )

      if (!course) {
        course = nonGamifiedCourses?.find(
          (course) => course.value === values.courseId
        )
      }

      if (!course) {
        console.log('Invalid course selection')
        return
      }

      setCourseGamified(course.isGamified)
      setTouched({
        courseStartDate: true,
        courseEndDate: true,
      })

      setValues(
        (prev) => ({
          ...prev,
          courseStartDate: course.startDate,
          courseEndDate: course.endDate,
        }),
        true
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.courseId])

  return null
}

export default CourseSelectionMonitorPracticeQuiz
