import { FormikErrors, FormikTouched } from 'formik'
import { SetStateAction, useEffect } from 'react'
import { ElementSelectCourse } from './ElementCreation'
import { PracticeQuizFormValues } from './WizardLayout'

function CourseSelectionMonitorPracticeQuiz({
  values,
  gamifiedCourses,
  setCourseGamified,
  setTouched,
  setValues,
}: {
  values: PracticeQuizFormValues
  gamifiedCourses?: ElementSelectCourse[]
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
      const course = gamifiedCourses?.find(
        (course) => course.value === values.courseId
      )

      if (!course) {
        console.log('Invalid course selection detected')
        return
      }

      setCourseGamified(course.isGamified)

      // TODO: spread previous value here and in all other uses of setTouched
      setTouched({
        availableFrom: true,
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
