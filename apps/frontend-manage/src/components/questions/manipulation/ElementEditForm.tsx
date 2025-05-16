import {
  ElementData,
  ElementType,
  ObjectType,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, H3, Modal } from '@uzh-bf/design-system'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@uzh-bf/design-system/dist/future'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction, useState } from 'react'
import Changelog from '../../sharing/Changelog'
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
  inputsDisabled = false,
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
  // flag to disable inputs (edit mode and read permissions)
  inputsDisabled?: boolean
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
      enableReinitialize={!isTemplate}
      initialValues={initialValues}
      validationSchema={questionManipulationSchema}
      onSubmit={async (values, { setSubmitting }) => {
        setSubmitting(true)
        await onSubmitElement(values)

        // close modal, set success toast
        setSubmitting(false)
        onSuccess()
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
            title={t(`manage.elements.${mode}Title`)}
            className={{
              content: 'h-max max-h-full max-w-[1400px] text-sm md:text-base',
              title: 'text-xl',
            }}
            open={open}
            onClose={() => onClose()}
            escapeDisabled={true}
            onPrimaryAction={
              !inputsDisabled ? (
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
              ) : undefined
            }
            onSecondaryAction={
              !isTemplate && !inputsDisabled ? (
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
            {!inputsDisabled && (
              <AutoSaveMonitor
                values={values}
                initialValuesString={JSON.stringify(initialValues)}
                setAutoSavedElement={setAutoSavedElement}
              />
            )}
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
                    inputsDisabled={inputsDisabled}
                    mode={mode}
                    values={values}
                    isSubmitting={isSubmitting}
                  />
                  <ElementContentInput
                    disabled={inputsDisabled}
                    values={values}
                    setFieldValue={setFieldValue}
                  />
                  <ElementExplanationField
                    disabled={inputsDisabled}
                    values={values}
                    setFieldValue={setFieldValue}
                  />

                  {/* scoring section */}
                  {!isTemplate &&
                    values.type !== ElementType.Content &&
                    values.type !== ElementType.Flashcard && (
                      <ElementformScoringSection
                        isTemplate={isTemplate}
                        disabled={inputsDisabled}
                        values={values}
                        setFieldValue={setFieldValue}
                        isSubmitting={isSubmitting}
                      />
                    )}

                  <div className="mt-4 flex flex-row gap-4">
                    <OptionsLabel type={values.type} />
                    <AnswerFeedbackSetting
                      disabled={isTemplate || inputsDisabled}
                      values={values}
                    />
                    <DisplayModeSetting
                      disabled={inputsDisabled}
                      type={values.type}
                    />
                  </div>

                  {values.type === ElementType.Sc ||
                  values.type === ElementType.Mc ||
                  values.type === ElementType.Kprim ? (
                    <ChoicesOptions
                      inputsDisabled={inputsDisabled}
                      values={values}
                      setFieldValue={setFieldValue}
                    />
                  ) : null}

                  {values.type === ElementType.Numerical && (
                    <NumericalOptions
                      inputsDisabled={inputsDisabled}
                      values={values}
                    />
                  )}

                  {values.type === ElementType.FreeText && (
                    <FreeTextOptions
                      inputsDisabled={inputsDisabled}
                      values={values}
                    />
                  )}

                  {values.type === ElementType.Selection && (
                    <SelectionOptions
                      templateId={templateId}
                      isTemplate={isTemplate}
                      inputsDisabled={inputsDisabled}
                      values={values}
                      setAnswerCollectionEntries={setAnswerCollectionEntries}
                    />
                  )}

                  {values.type === ElementType.CaseStudy && (
                    <CaseStudyOptions
                      templateId={templateId}
                      isTemplate={isTemplate}
                      inputsDisabled={inputsDisabled}
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

              {mode === ElementEditMode.EDIT ? (
                <Tabs defaultValue="preview" className="w-full max-w-sm">
                  <TabsList className="w-full">
                    <TabsTrigger value="preview" className="w-1/2 font-bold">
                      {t('shared.generic.preview')}
                    </TabsTrigger>
                    <TabsTrigger value="changelog" className="w-1/2 font-bold">
                      {t('shared.generic.activity')}
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="preview">
                    <StudentElementPreview
                      values={values}
                      elementDataTypename={elementDataTypename}
                      answerCollectionEntries={answerCollectionEntries}
                    />
                  </TabsContent>
                  <TabsContent value="changelog">
                    <div className="w-sm w-full flex-1">
                      <Changelog
                        entries={[]}
                        objectId={elementId?.toString() || ''}
                        objectType={ObjectType.Element}
                        onMessageAdded={() => {
                          // TODO: Refresh changelog entries when implemented
                        }}
                      />
                    </div>
                  </TabsContent>
                </Tabs>
              ) : (
                <div className="w-full max-w-sm">
                  <H3>{t('shared.generic.preview')}</H3>
                  <StudentElementPreview
                    values={values}
                    elementDataTypename={elementDataTypename}
                    answerCollectionEntries={answerCollectionEntries}
                  />
                </div>
              )}
            </div>

            {mode === ElementEditMode.EDIT && elementId && !inputsDisabled && (
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
