import { FormikErrors } from 'formik'
import { useEffect } from 'react'
import { ElementSelectCourse } from '../ElementCreation'
import { LiveSessionFormValues } from '../WizardLayout'

function LiveQuizCourseMonitor({
  values,
  setFieldValue,
  gamifiedCourses,
  nonGamifiedCourses,
}: {
  values: LiveSessionFormValues
  setFieldValue: (
    field: string,
    value: any
  ) => Promise<void | FormikErrors<LiveSessionFormValues>>
  gamifiedCourses: ElementSelectCourse[]
  nonGamifiedCourses: ElementSelectCourse[]
}) {
  useEffect(() => {
    if (values.courseId === '') {
      setFieldValue('isGamificationEnabled', false)
      setFieldValue('multiplier', '1')
    } else {
      setFieldValue(
        'isGamificationEnabled',
        [...gamifiedCourses!, ...nonGamifiedCourses!].find(
          (course) => course.value === values.courseId
        )?.isGamified
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.courseId])

  return null
}

export default LiveQuizCourseMonitor
