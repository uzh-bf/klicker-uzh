import { FormikErrors, FormikTouched } from 'formik'
import { SetStateAction, useEffect } from 'react'
import { ElementSelectCourse } from '../ActivityCreation'
import { MicroLearningFormValues } from './WizardLayout'

function CourseSelectionMonitorMicrolearning({
  values,
  gamifiedCourses,
  setCourseGamified,
  setTouched,
  setValues,
}: {
  values: MicroLearningFormValues
  gamifiedCourses?: ElementSelectCourse[]
  setCourseGamified: (value: boolean) => void
  setTouched: (
    touched: FormikTouched<MicroLearningFormValues>
  ) => Promise<void | FormikErrors<MicroLearningFormValues>>
  setValues: (
    values: SetStateAction<MicroLearningFormValues>,
    shouldValidate?: boolean
  ) => Promise<void | FormikErrors<MicroLearningFormValues>>
}) {
  useEffect(() => {
    if (values.courseId) {
      const course = gamifiedCourses?.find(
        (course) => course.value === values.courseId
      )

      if (!course) {
        setCourseGamified(false)
        return
      }

      setCourseGamified(true)
      setTouched({
        startDate: true,
        endDate: true,
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
  }, [
    gamifiedCourses,
    setCourseGamified,
    setTouched,
    setValues,
    values.courseId,
  ])

  return null
}

export default CourseSelectionMonitorMicrolearning
