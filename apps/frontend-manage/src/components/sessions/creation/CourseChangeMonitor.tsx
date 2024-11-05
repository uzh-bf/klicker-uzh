import { FormikErrors, FormikTouched } from 'formik'
import { SetStateAction, useEffect } from 'react'
import { ElementSelectCourse } from './ElementCreation'
import { GroupActivityFormValues } from './WizardLayout'

function CourseChangeMonitor({
  values,
  setTouched,
  setValues,
  courses,
}: {
  values: GroupActivityFormValues
  setTouched: (
    touched: FormikTouched<GroupActivityFormValues>
  ) => Promise<void | FormikErrors<GroupActivityFormValues>>
  setValues: (
    values: SetStateAction<GroupActivityFormValues>,
    shouldValidate?: boolean
  ) => Promise<void | FormikErrors<GroupActivityFormValues>>
  courses: ElementSelectCourse[]
}) {
  useEffect(() => {
    if (!values.courseId) {
      console.log('Course change modal triggered without selected course')
      return
    }

    const course = courses.find((course) => course.value === values.courseId)

    if (!course) {
      console.log('Invalid course selection detected')
      return
    }

    setTouched({
      startDate: true,
      endDate: true,
      courseStartDate: true,
      courseEndDate: true,
      courseGroupDeadline: true,
    })

    setValues(
      (prev) => ({
        ...prev,
        courseStartDate: course.startDate,
        courseEndDate: course.endDate,
        courseGroupDeadline: course.groupDeadline,
      }),
      true
    )

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.courseId])

  return null
}

export default CourseChangeMonitor
