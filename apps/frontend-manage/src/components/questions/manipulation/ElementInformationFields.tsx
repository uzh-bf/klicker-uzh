import { ElementType } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import {
  FormLabel,
  FormikSelectField,
  FormikTextField,
} from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Suspense } from 'react'
import MultiplierSelector from '../../sessions/creation/MultiplierSelector'
import SuspendedTagInput from '../tags/SuspendedTagInput'
import { ElementEditMode } from './ElementEditModal'
import { ElementFormTypes } from './types'
import useElementTypeOptions from './useElementTypeOptions'
import useStatusOptions from './useStatusOptions'

interface ElementInformationFieldsProps {
  mode: ElementEditMode
  values: ElementFormTypes
  isSubmitting: boolean
}

function ElementInformationFields({
  mode,
  values,
  isSubmitting,
}: ElementInformationFieldsProps) {
  const t = useTranslations()
  const statusOptions = useStatusOptions()
  const questionTypeOptions = useElementTypeOptions()

  return (
    <>
      <div className="z-0 flex flex-row justify-between">
        <FormikSelectField
          name="type"
          required={mode === ElementEditMode.CREATE}
          contentPosition="popper"
          disabled={mode === ElementEditMode.EDIT}
          label={t('manage.questionForms.questionType')}
          placeholder={t('manage.questionForms.selectQuestionType')}
          items={questionTypeOptions}
          data={{ cy: 'select-question-type' }}
          className={{ select: { trigger: 'h-8 w-max' } }}
        />

        <FormikSelectField
          name="status"
          contentPosition="popper"
          label={t('manage.questionForms.questionStatus')}
          placeholder={t('manage.questionForms.selectQuestionStatus')}
          items={statusOptions}
          data={{ cy: 'select-question-status' }}
          className={{ select: { trigger: 'h-8 w-32' } }}
        />
      </div>

      <div className="mt-2 flex flex-row">
        <FormikTextField
          name="name"
          required
          label={t('manage.questionForms.questionTitle')}
          tooltip={t('manage.questionForms.titleTooltip')}
          className={{
            root: 'w-full',
          }}
          data={{ cy: 'insert-question-title' }}
        />
      </div>

      <div className="mt-2 flex flex-row gap-2">
        {values.type !== ElementType.Content &&
          values.type !== ElementType.Flashcard && (
            <div>
              <MultiplierSelector
                name="pointsMultiplier"
                disabled={isSubmitting}
              />
            </div>
          )}
        <div className="flex w-full flex-col">
          <FormLabel
            required={false}
            label={t('manage.questionPool.tags')}
            labelType="small"
            tooltip={t('manage.questionForms.tagsTooltip')}
          />
          <Suspense fallback={<Loader />}>
            <SuspendedTagInput />
          </Suspense>
        </div>
      </div>
    </>
  )
}

export default ElementInformationFields
