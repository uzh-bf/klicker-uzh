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
  // Date values are trigger-only dependencies for this Formik monitor.
  // biome-ignore lint/correctness/useExhaustiveDependencies: date values intentionally trigger validation and touch updates
  useEffect(() => {
    setTouched({ startDate: true, endDate: true, groupCreationDeadline: true })

    validateFieldSync('startDate', validateField)
    validateFieldSync('endDate', validateField)
    validateFieldSync('groupCreationDeadline', validateField)
  }, [
    setTouched,
    validateField,
    values.startDate,
    values.endDate,
    values.groupCreationDeadline,
  ])

  return null
}

export default CourseDateChangeMonitor
