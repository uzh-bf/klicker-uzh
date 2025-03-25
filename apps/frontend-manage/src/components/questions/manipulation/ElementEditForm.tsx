import { ElementData, ElementType } from '@klicker-uzh/graphql/dist/ops'
import { Button, Modal } from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction, useState } from 'react'
import AutoSaveMonitor from './AutoSaveMonitor'
import ElementContentInput from './ElementContentInput'
import { ElementEditMode } from './ElementEditModal'
import ElementExplanationField from './ElementExplanationField'
import ElementFailureToast from './ElementFailureToast'
import ElementFormErrors from './ElementFormErrors'
import ElementformScoringSection from './ElementFormScoringSection'
import ElementInformationFields from './ElementInformationFields'
import ElementTypeMonitor from './ElementTypeMonitor'
import InstanceUpdateSwitch from './InstanceUpdateSwitch'
import StudentElementPreview from './StudentElementPreview'
import AnswerFeedbackSetting from './options/AnswerFeedbackSetting'
import CaseStudyOptions from './options/CaseStudyOptions'
import ChoicesOptions from './options/ChoicesOptions'
import DisplayModeSetting from './options/DisplayModeSetting'
import FreeTextOptions from './options/FreeTextOptions'
import NumericalOptions from './options/NumericalOptions'
import OptionsLabel from './options/OptionsLabel'
import SelectionOptions from './options/SelectionOptions'
import { ElementFormTypes } from './types'
import useValidationSchema from './useValidationSchema'

function ElementEditForm({
  isTemplate = false,
  templateId,
  open,
  onClose,
  onSuccess,
  mode,
  elementId,
  loading,
  initialValues,
  onSubmitElement,
  setAutoSavedElement,
  failureToast,
  setFailureToast,
  updateInstances,
  setUpdateInstances,
  includeTemplateUpdates,
  setIncludeTemplateUpdates,
}: {
  // flag to highlight template mode
  isTemplate?: boolean
  templateId?: string
  // modal state props
  open: boolean
  onClose: () => void
  onSuccess: () => void
  // element mode and identification
  mode: ElementEditMode
  elementId?: number
  // loading state
  loading: boolean
  // form data props
  initialValues: ElementFormTypes
  onSubmitElement: (values: ElementFormTypes) => Promise<void>
  setAutoSavedElement: Dispatch<SetStateAction<ElementFormTypes>>
  // failure handling
  failureToast: boolean
  setFailureToast: Dispatch<SetStateAction<boolean>>
  // instance update controls
  updateInstances: boolean
  setUpdateInstances: Dispatch<SetStateAction<boolean>>
  includeTemplateUpdates: boolean
  setIncludeTemplateUpdates: Dispatch<SetStateAction<boolean>>
}) {
  const t = useTranslations()

  const [answerCollectionEntries, setAnswerCollectionEntries] = useState<
    { id: number; value: string }[]
  >([])
  const [elementDataTypename, setElementDataTypename] = useState<
    ElementData['__typename'] | undefined
  >()

  const questionManipulationSchema = useValidationSchema({
    numberOfAnswerOptions: answerCollectionEntries.length,
  })

  return (
    <Formik
      validateOnMount
      enableReinitialize
      initialValues={initialValues}
      validationSchema={questionManipulationSchema}
      onSubmit={async (values, { setSubmitting }) => {
        setSubmitting(true)
        await onSubmitElement(values)

        // close modal, set success toast
        setSubmitting(false)
        onSuccess()
        onClose()
      }}
    >
      {({
        values,
        errors,
        isSubmitting,
        isValid,
        setFieldValue,
        setFieldTouched,
        validateForm,
      }) => {
        if (loading) {
          return null
        }

        return (
          <Modal
            asPortal
            fullScreen
            title={t(`manage.questionForms.${mode}Title`)}
            className={{
              content: 'h-max max-h-full max-w-[1400px] text-sm md:text-base',
              title: 'text-xl',
            }}
            open={open}
            onClose={() => onClose()}
            escapeDisabled={true}
            onPrimaryAction={
              <Button
                primary
                type="submit"
                loading={isSubmitting}
                disabled={!isValid}
                className={{ root: 'mt-2' }}
                form="question-manipulation-form"
                data={{ cy: 'save-new-question' }}
              >
                <Button.Label>{t('shared.generic.save')}</Button.Label>
              </Button>
            }
            onSecondaryAction={
              !isTemplate ? (
                <Button
                  className={{ root: 'mt-2' }}
                  onClick={() => onClose()}
                  data={{ cy: 'close-element-modal' }}
                >
                  <Button.Label>{t('shared.generic.close')}</Button.Label>
                </Button>
              ) : undefined
            }
          >
            <AutoSaveMonitor
              values={values}
              initialValuesString={JSON.stringify(initialValues)}
              setAutoSavedElement={setAutoSavedElement}
            />
            <ElementTypeMonitor
              elementType={values.type ?? ElementType.Sc}
              setElementDataTypename={setElementDataTypename}
              validateForm={validateForm}
            />
            <div className="flex flex-row gap-12">
              <div className="max-w-5xl flex-1">
                <Form className="w-full" id="question-manipulation-form">
                  <ElementInformationFields
                    isTemplate={isTemplate}
                    mode={mode}
                    values={values}
                    isSubmitting={isSubmitting}
                  />
                  <ElementContentInput
                    values={values}
                    setFieldValue={setFieldValue}
                  />
                  <ElementExplanationField
                    values={values}
                    setFieldValue={setFieldValue}
                  />

                  {/* scoring section */}
                  {!isTemplate &&
                    values.type !== ElementType.Content &&
                    values.type !== ElementType.Flashcard && (
                      <ElementformScoringSection
                        isTemplate={isTemplate}
                        values={values}
                        setFieldValue={setFieldValue}
                        isSubmitting={isSubmitting}
                      />
                    )}

                  <div className="mt-4 flex flex-row gap-4">
                    <OptionsLabel type={values.type} />

                    <AnswerFeedbackSetting
                      disabled={isTemplate}
                      values={values}
                    />
                    <DisplayModeSetting type={values.type} />
                  </div>

                  {values.type === ElementType.Sc ||
                  values.type === ElementType.Mc ||
                  values.type === ElementType.Kprim ? (
                    <ChoicesOptions
                      values={values}
                      setFieldValue={setFieldValue}
                    />
                  ) : null}

                  {values.type === ElementType.Numerical && (
                    <NumericalOptions values={values} />
                  )}

                  {values.type === ElementType.FreeText && (
                    <FreeTextOptions values={values} />
                  )}

                  {values.type === ElementType.Selection && (
                    <SelectionOptions
                      templateId={templateId}
                      isTemplate={isTemplate}
                      values={values}
                      setAnswerCollectionEntries={setAnswerCollectionEntries}
                    />
                  )}

                  {values.type === ElementType.CaseStudy && (
                    <CaseStudyOptions
                      templateId={templateId}
                      isTemplate={isTemplate}
                      setFieldValue={setFieldValue}
                      setFieldTouched={setFieldTouched}
                      hasSampleSolution={values.options.hasSampleSolution}
                      setAnswerCollectionEntries={setAnswerCollectionEntries}
                    />
                  )}
                </Form>

                {Object.keys(errors).length !== 0 && (
                  <ElementFormErrors errors={errors} />
                )}
              </div>
              <StudentElementPreview
                values={values}
                elementDataTypename={elementDataTypename}
                answerCollectionEntries={answerCollectionEntries}
              />
            </div>

            {mode === ElementEditMode.EDIT && elementId && (
              <InstanceUpdateSwitch
                elementId={elementId}
                hasSampleSolution={
                  'options' in values && 'hasSampleSolution' in values.options
                    ? values.options.hasSampleSolution
                    : undefined
                }
                updateInstances={updateInstances}
                setUpdateInstances={setUpdateInstances}
                includeTemplateUpdates={includeTemplateUpdates}
                setIncludeTemplateUpdates={setIncludeTemplateUpdates}
              />
            )}
            <ElementFailureToast
              open={failureToast}
              onClose={() => setFailureToast(false)}
            />
          </Modal>
        )
      }}
    </Formik>
  )
}

export default ElementEditForm
