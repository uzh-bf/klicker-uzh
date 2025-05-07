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
  inputsDisabled?: boolean
}

function ElementInformationFields({
  isTemplate = false,
  mode,
  values,
  isSubmitting,
  inputsDisabled = false,
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
          disabled={mode === ElementEditMode.EDIT || isTemplate || isSubmitting}
          label={t('manage.elements.elementType')}
          placeholder={t('manage.elements.selectQuestionType')}
          items={questionTypeOptions}
          data={{ cy: 'select-question-type' }}
          className={{ select: { trigger: 'h-8 w-max' } }}
        />

        {!isTemplate ? (
          <FormikSelectField
            name="status"
            contentPosition="popper"
            disabled={inputsDisabled || isSubmitting}
            label={t('manage.elements.questionStatus')}
            placeholder={t('manage.elements.selectQuestionStatus')}
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
          disabled={inputsDisabled || isSubmitting}
          label={t('manage.elements.elementTitle')}
          tooltip={t('manage.elements.titleTooltip')}
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
              tooltip={t('manage.elements.tagsTooltip')}
            />
            <Suspense fallback={<Loader />}>
              <SuspendedTagInput disabled={inputsDisabled || isSubmitting} />
            </Suspense>
          </div>
        ) : null}
      </div>
    </>
  )
}

export default ElementInformationFields
