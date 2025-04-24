import Loader from '@klicker-uzh/shared-components/src/Loader'
import {
  FormLabel,
  FormikSelectField,
  FormikTextField,
} from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Suspense } from 'react'
import SuspendedTagInput from '../tags/SuspendedTagInput'
import { ElementEditMode } from './ElementEditModal'
import { ElementFormTypes } from './types'
import useElementTypeOptions from './useElementTypeOptions'
import useStatusOptions from './useStatusOptions'

interface ElementInformationFieldsProps {
  isTemplate?: boolean
  mode: ElementEditMode
  values: ElementFormTypes
  isSubmitting: boolean
}

function ElementInformationFields({
  isTemplate = false,
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
          disabled={mode === ElementEditMode.EDIT || isTemplate}
          label={t('manage.elementForms.elementType')}
          placeholder={t('manage.elementForms.selectQuestionType')}
          items={questionTypeOptions}
          data={{ cy: 'select-question-type' }}
          className={{ select: { trigger: 'h-8 w-max' } }}
        />

        {!isTemplate ? (
          <FormikSelectField
            name="status"
            contentPosition="popper"
            label={t('manage.elementForms.questionStatus')}
            placeholder={t('manage.elementForms.selectQuestionStatus')}
            items={statusOptions}
            data={{ cy: 'select-question-status' }}
            className={{ select: { trigger: 'h-8 w-32' } }}
          />
        ) : null}
      </div>

      <div className="mt-2 flex flex-row">
        <FormikTextField
          name="name"
          required
          label={t('manage.elementForms.elementTitle')}
          tooltip={t('manage.elementForms.titleTooltip')}
          className={{
            root: 'w-full',
          }}
          data={{ cy: 'insert-question-title' }}
        />
      </div>

      <div className="mt-2 flex flex-row gap-2">
        {!isTemplate ? (
          <div className="flex w-full flex-col" data-cy="element-tag-input">
            <FormLabel
              required={false}
              label={t('manage.questionPool.tags')}
              labelType="small"
              tooltip={t('manage.elementForms.tagsTooltip')}
            />
            <Suspense fallback={<Loader />}>
              <SuspendedTagInput />
            </Suspense>
          </div>
        ) : null}
      </div>
    </>
  )
}

export default ElementInformationFields
