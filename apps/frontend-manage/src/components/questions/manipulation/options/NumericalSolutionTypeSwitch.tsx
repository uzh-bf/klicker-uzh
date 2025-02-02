import { Button, FormLabel } from '@uzh-bf/design-system'
import { useField } from 'formik'
import { useTranslations } from 'next-intl'
import { ElementFormTypesNumerical } from '../types'

function NumericalSolutionTypeSwitch({
  solutionType,
}: {
  solutionType: ElementFormTypesNumerical['options']['solutionType']
}) {
  const t = useTranslations()
  const [_, __, helpers] = useField('options.solutionType')

  return (
    <div className="mt-3">
      <FormLabel
        required
        label={t('manage.questionForms.solutionTypeNumerical')}
        labelType="small"
        tooltip={t('manage.questionForms.solutionTypeNumericalTooltip')}
      />
      <div className="flex flex-row">
        <Button
          basic
          onClick={() => helpers.setValue('range')}
          className={{
            root: `py-0.25 h-8 rounded-l border !border-r-0 border-solid px-2 ${solutionType === 'range' ? 'bg-primary-100 border-primary-100 text-white' : ''}`,
          }}
          data={{ cy: 'set-solution-type-range' }}
        >
          {t('manage.questionForms.solutionRanges')}
        </Button>
        <Button
          basic
          onClick={() => helpers.setValue('exact')}
          className={{
            root: `h-8 rounded-r border !border-l-0 border-solid px-2 py-0.5 ${solutionType === 'exact' ? 'bg-primary-100 border-primary-100 text-white' : ''}`,
          }}
          data={{ cy: 'set-solution-type-exact' }}
        >
          {t('manage.questionForms.exactSolutions')}
        </Button>
      </div>
    </div>
  )
}

export default NumericalSolutionTypeSwitch
