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
  useEffect(() => {
    setTouched({ startDate: true, endDate: true })

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.startDate, values.endDate])

  return null
}

export default DateChangeMonitor
