import Loader from '@klicker-uzh/shared-components/src/Loader'
import {
  FormLabel,
  FormikSelectField,
  FormikTextField,
  SelectField,
  toast,
} from '@uzh-bf/design-system'
import { useFormikContext } from 'formik'
import { useTranslations } from 'next-intl'
import { Suspense, useState } from 'react'
import { ElementStatus } from '../../../lib/constants/elementTypes'
import { trpc, type RouterInputs } from '../../../lib/trpc'
import SuspendedTagInput from '../tags/SuspendedTagInput'
import { ElementEditMode } from './ElementEditModal'
import { ElementFormTypes } from './types'
import useElementTypeOptions from './useElementTypeOptions'
import useStatusOptions from './useStatusOptions'

type ChangeElementStatusInput = RouterInputs['element']['changeStatus']

interface ElementInformationFieldsProps {
  isTemplate?: boolean
  elementId?: number
  mode: ElementEditMode
  values: ElementFormTypes
  isSubmitting: boolean
  inputsDisabled?: boolean
}

function ElementInformationFields({
  isTemplate = false,
  elementId,
  mode,
  values,
  isSubmitting,
  inputsDisabled = false,
}: ElementInformationFieldsProps) {
  const t = useTranslations()
  const statusOptions = useStatusOptions()
  const questionTypeOptions = useElementTypeOptions()
  const { setFieldValue } = useFormikContext()
  const utils = trpc.useUtils()

  const [statusSaving, setStatusSaving] = useState(false)
  const changeElementStatus = trpc.element.changeStatus.useMutation()

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
          <SelectField
            value={values.status}
            onChange={async (newValue) => {
              setStatusSaving(true)

              try {
                if (typeof elementId !== 'undefined') {
                  const result = await changeElementStatus.mutateAsync({
                    elementId,
                    status: newValue as ChangeElementStatusInput['status'],
                  })

                  if (!result.success) {
                    toast({
                      type: 'error',
                      message: t('shared.generic.systemError'),
                      options: { duration: 6000 },
                    })
                    return
                  }

                  void utils.element.single
                    .invalidate({ id: elementId })
                    .catch(console.error)
                }

                setFieldValue('status', newValue as ElementStatus)
              } catch (error) {
                console.error(error)
                toast({
                  type: 'error',
                  message: t('shared.generic.systemError'),
                  options: { duration: 6000 },
                })
              } finally {
                setStatusSaving(false)
              }
            }}
            contentPosition="popper"
            disabled={isSubmitting || statusSaving}
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
          className={{ root: 'w-full' }}
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
