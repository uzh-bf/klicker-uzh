import { Checkbox, FormikTextareaField } from '@uzh-bf/design-system'
import { useFormikContext } from 'formik'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { PointCorrectionsFormValues } from './types'

function PointCorrectionsReasonStep() {
  const t = useTranslations()
  const { values, setFieldValue } =
    useFormikContext<PointCorrectionsFormValues>()
  const useSameReason = values.useSameReasonForStudents

  useEffect(() => {
    if (useSameReason && values.studentReason !== values.lecturerReason) {
      setFieldValue('studentReason', values.lecturerReason)
    }
  }, [
    useSameReason,
    values.lecturerReason,
    values.studentReason,
    setFieldValue,
  ])

  const handleUseSameReasonToggle = () => {
    const nextValue = !useSameReason
    setFieldValue('useSameReasonForStudents', nextValue)

    if (nextValue) {
      setFieldValue('studentReason', values.lecturerReason)
    }
  }

  return (
    <div className="flex flex-col">
      <div className="text-sm text-gray-700">
        {t('manage.pointCorrections.reasonDescription')}
      </div>

      <FormikTextareaField
        name="lecturerReason"
        id="lecturerReason"
        rows="4"
        label={t('manage.pointCorrections.reasonLecturerLabel')}
        placeholder={t('manage.pointCorrections.reasonLecturerPlaceholder')}
        className={{
          root: 'mt-3 flex w-full flex-col gap-2',
          label: 'mb-1 text-sm font-normal',
        }}
        maxLength={1000}
        maxLengthLabel={t('shared.generic.characters')}
        data={{ cy: 'point-corrections-lecturer-reason' }}
      />

      <div className="-mt-5.5 mb-4">
        <Checkbox
          checked={useSameReason}
          onCheck={handleUseSameReasonToggle}
          label={t('manage.pointCorrections.reasonUseSameMessageLabel')}
          className={{
            root: '',
            label: 'text-sm text-gray-900',
          }}
          data={{ cy: 'point-corrections-use-same-reason' }}
        />
      </div>

      <FormikTextareaField
        name="studentReason"
        id="studentReason"
        rows="4"
        label={t('manage.pointCorrections.reasonStudentLabel')}
        placeholder={t('manage.pointCorrections.reasonStudentPlaceholder')}
        disabled={useSameReason}
        className={{
          root: 'mt-3 flex w-full flex-col gap-2',
          label: 'mb-1 text-sm font-normal',
          input: useSameReason ? 'bg-gray-100' : '',
        }}
        maxLength={1000}
        maxLengthLabel={t('shared.generic.characters')}
        data={{ cy: 'point-corrections-student-reason' }}
      />
    </div>
  )
}

export default PointCorrectionsReasonStep
