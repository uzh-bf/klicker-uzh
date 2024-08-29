import { FormikErrors, FormikTouched } from 'formik'
import { useEffect } from 'react'
import validateFieldSync from '../../../lib/utils/validateFieldSync'
import { CourseManipulationFormData } from './CourseManipulationModal'

function CourseDateChangeMonitor({
  values,
  setTouched,
  validateField,
}: {
  values: CourseManipulationFormData
  setTouched: (
    touched: FormikTouched<CourseManipulationFormData>
  ) => Promise<void | FormikErrors<CourseManipulationFormData>>
  validateField: (field: string) => Promise<void> | Promise<string | undefined>
}) {
  useEffect(() => {
    setTouched({ startDate: true, endDate: true, groupCreationDeadline: true })

    validateFieldSync('startDate', validateField)
    validateFieldSync('endDate', validateField)
    validateFieldSync('groupCreationDeadline', validateField)

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.startDate, values.endDate, values.groupCreationDeadline])

  return null
}

export default CourseDateChangeMonitor
