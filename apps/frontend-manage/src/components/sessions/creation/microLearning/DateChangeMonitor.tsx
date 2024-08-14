import { FormikErrors, FormikTouched } from 'formik'
import { useEffect } from 'react'
import { MicroLearningFormValues } from '../WizardLayout'

function DateChangeMonitor({
  values,
  setTouched,
}: {
  values: MicroLearningFormValues
  setTouched: (
    touched: FormikTouched<MicroLearningFormValues>
  ) => Promise<void | FormikErrors<MicroLearningFormValues>>
}) {
  useEffect(() => {
    setTouched({ startDate: true, endDate: true })

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.startDate, values.endDate])

  return null
}

export default DateChangeMonitor
