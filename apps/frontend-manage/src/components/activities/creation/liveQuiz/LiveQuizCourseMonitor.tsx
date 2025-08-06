import { FormikErrors } from 'formik'
import { useEffect } from 'react'
import { ElementSelectCourse } from '../../ActivityCreation'
import { LiveQuizFormValues } from '../WizardLayout'

function LiveQuizCourseMonitor({
  values,
  setFieldValue,
  gamifiedCourses,
  nonGamifiedCourses,
}: {
  values: LiveQuizFormValues
  setFieldValue: (
    field: string,
    value: any
  ) => Promise<void | FormikErrors<LiveQuizFormValues>>
  gamifiedCourses: ElementSelectCourse[]
  nonGamifiedCourses: ElementSelectCourse[]
}) {
  useEffect(() => {
    if (values.courseId === 'no-course-selected') {
      setFieldValue('isGamificationEnabled', false)
      setFieldValue('multiplier', '1')
    } else {
      setFieldValue(
        'isGamificationEnabled',
        [...gamifiedCourses!, ...nonGamifiedCourses!].find(
          (course) => course.value === values.courseId
        )?.isGamified ?? false
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.courseId])

  return null
}

export default LiveQuizCourseMonitor
