import { useMutation } from '@apollo/client'
import {
  ChangeElementStatusDocument,
  ElementStatus,
  GetUserElementsDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import {
  FormLabel,
  FormikSelectField,
  FormikTextField,
  SelectField,
} from '@uzh-bf/design-system'
import { useFormikContext } from 'formik'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction, Suspense, useState } from 'react'
import SuspendedTagInput from '../tags/SuspendedTagInput'
import { ElementEditMode } from './ElementEditModal'
import { ElementFormTypes } from './types'
import useElementTypeOptions from './useElementTypeOptions'
import useStatusOptions from './useStatusOptions'

interface ElementInformationFieldsProps {
  isTemplate?: boolean
  elementId?: number
  elementStatus: ElementStatus
  setElementStatus: Dispatch<SetStateAction<ElementStatus>>
  mode: ElementEditMode
  values: ElementFormTypes
  isSubmitting: boolean
  inputsDisabled?: boolean
}

function ElementInformationFields({
  isTemplate = false,
  elementId,
  elementStatus,
  setElementStatus,
  mode,
  values,
  isSubmitting,
  inputsDisabled = false,
}: ElementInformationFieldsProps) {
  const t = useTranslations()
  const statusOptions = useStatusOptions()
  const questionTypeOptions = useElementTypeOptions()
  const { setFieldValue } = useFormikContext()

  const [statusSaving, setStatusSaving] = useState(false)
  const [changeElementStatus] = useMutation(ChangeElementStatusDocument)

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
            value={elementStatus}
            onChange={async (newValue) => {
              setStatusSaving(true)

              if (typeof elementId !== 'undefined') {
                await changeElementStatus({
                  variables: { elementId, status: newValue as ElementStatus },
                  update: (cache, { data }) => {
                    // check if request was successful
                    const success = data?.changeElementStatus
                    if (!success) return

                    // update element list
                    const queryData = cache.readQuery({
                      query: GetUserElementsDocument,
                    })

                    if (queryData?.userElements) {
                      cache.writeQuery({
                        query: GetUserElementsDocument,
                        data: {
                          userElements: queryData?.userElements.map((obj) =>
                            obj.id === elementId
                              ? { ...obj, status: newValue as ElementStatus }
                              : obj
                          ),
                        },
                      })
                    }
                  },
                })
              }

              setElementStatus(newValue as ElementStatus)
              setStatusSaving(false)
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
