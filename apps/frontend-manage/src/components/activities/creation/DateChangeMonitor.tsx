import { FormikErrors, FormikTouched } from 'formik'
import { useEffect } from 'react'
import {
  GroupActivityFormValues,
  MicroLearningFormValues,
} from './WizardLayout'

function DateChangeMonitor({
  values,
  setTouched,
}: {
  values: MicroLearningFormValues | GroupActivityFormValues
  setTouched: (
    touched: FormikTouched<MicroLearningFormValues | GroupActivityFormValues>
  ) => Promise<void | FormikErrors<
    MicroLearningFormValues | GroupActivityFormValues
  >>
}) {
  // The dates are trigger-only dependencies: this Formik monitor intentionally
  // touches both fields whenever either date changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: date values intentionally trigger this Formik touch effect
  useEffect(() => {
    setTouched({ startDate: true, endDate: true })
  }, [setTouched, values.startDate, values.endDate])

  return null
}

export default DateChangeMonitor
