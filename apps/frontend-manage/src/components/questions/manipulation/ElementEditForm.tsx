import { useQuery } from '@apollo/client'
import {
  ElementData,
  ElementStatus,
  ElementType,
  GetAnswerCollectionsElementsDocument,
  ObjectType,
} from '@klicker-uzh/graphql/dist/ops'
import { H3, Modal, TabContent, Tabs, toast } from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import AnswerCollectionEditModal from '../../resources/answerCollections/AnswerCollectionEditModal'
import ActivityLog from '../../sharing/ActivityLog'
import AutoSaveMonitor from './AutoSaveMonitor'
import ElementContentInput from './ElementContentInput'
import { ElementEditMode } from './ElementEditModal'
import ElementExplanationField from './ElementExplanationField'
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
  initialStatus,
  onSubmitElement,
  setAutoSavedElement,
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
  initialStatus: ElementStatus
  onSubmitElement: (
    values: ElementFormTypes & { status: ElementStatus }
  ) => Promise<boolean>
  setAutoSavedElement: Dispatch<SetStateAction<ElementFormTypes>>
  // instance update controls
  updateInstances: boolean
  setUpdateInstances: Dispatch<SetStateAction<boolean>>
  includeTemplateUpdates: boolean
  setIncludeTemplateUpdates: Dispatch<SetStateAction<boolean>>
}) {
  const t = useTranslations()

  const [activeTab, setActiveTab] = useState('preview')
  const [elementStatus, setElementStatus] = useState(initialStatus)
  const [answerCollectionEntries, setAnswerCollectionEntries] = useState<
    { id: number; value: string }[]
  >([])
  const [elementDataTypename, setElementDataTypename] = useState<
    ElementData['__typename'] | undefined
  >()
  const [collectionModal, setCollectionModal] = useState<{
    open: boolean
    id?: number
  }>({ open: false, id: undefined })

  const questionManipulationSchema = useValidationSchema({
    numberOfAnswerOptions: answerCollectionEntries.length,
  })

  const {
    data,
    loading: collectionsLoading,
    refetch,
  } = useQuery(GetAnswerCollectionsElementsDocument, {
    variables: { templateId },
    fetchPolicy: 'network-only',
  })
  const collections = data?.getAnswerCollectionsElements ?? []

  return (
    <>
      <Formik
        validateOnMount
        enableReinitialize={!isTemplate}
        initialValues={initialValues}
        validationSchema={questionManipulationSchema}
        onSubmit={async (values, { setSubmitting }) => {
          setSubmitting(true)
          const success = await onSubmitElement({
            ...values,
            status: elementStatus,
          })

          // close modal, set success toast
          setSubmitting(false)
          if (!success) {
            toast({
              type: 'error',
              message: t('manage.elements.questionSavedFailed'),
              options: { duration: 6000 },
            })
          } else {
            onSuccess()
          }
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
          submitForm,
        }) => {
          if (loading) {
            return null
          }

          return (
            <Modal
              fullScreen
              title={t(`manage.elements.${mode}Title`)}
              open={open}
              onClose={() => onClose()}
              escapeDisabled={true}
              onPrimaryAction={() => submitForm()}
              primaryLabel={
                !inputsDisabled ? t('shared.generic.save') : undefined
              }
              primaryDisabled={!isValid}
              primaryLoading={isSubmitting}
              dataPrimaryAction={{ cy: 'save-new-question' }}
              onSecondaryAction={
                !isTemplate && !inputsDisabled ? () => onClose() : undefined
              }
              secondaryLabel={t('shared.generic.close')}
              dataSecondaryAction={{ cy: 'close-element-modal-button' }}
              className={{
                title: 'text-xl',
                content: 'h-max text-sm md:text-base 2xl:max-w-[1400px]',
                footer: twMerge(isTemplate ? 'justify-end' : 'justify-between'),
              }}
              dataCloseButton={{ cy: 'close-element-modal' }}
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
                <div className="flex-1">
                  <Form className="w-full" id="question-manipulation-form">
                    <ElementInformationFields
                      isTemplate={isTemplate}
                      elementId={elementId}
                      elementStatus={elementStatus}
                      setElementStatus={setElementStatus}
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
                        creationMode={
                          mode === ElementEditMode.CREATE ||
                          mode === ElementEditMode.DUPLICATE
                        }
                        inputsDisabled={inputsDisabled}
                        values={values}
                        collections={collections}
                        collectionsLoading={collectionsLoading}
                        refetchCollections={async () => {
                          await refetch()
                        }}
                        setAnswerCollectionEntries={setAnswerCollectionEntries}
                        openAnswerCollectionEditModal={(
                          collectionId: number
                        ) => {
                          setCollectionModal({ open: true, id: collectionId })
                        }}
                      />
                    )}

                    {values.type === ElementType.CaseStudy && (
                      <CaseStudyOptions
                        creationMode={
                          mode === ElementEditMode.CREATE ||
                          mode === ElementEditMode.DUPLICATE
                        }
                        inputsDisabled={inputsDisabled}
                        setFieldValue={setFieldValue}
                        setFieldTouched={setFieldTouched}
                        hasSampleSolution={values.options.hasSampleSolution}
                        collections={collections}
                        collectionsLoading={collectionsLoading}
                        refetchCollections={async () => {
                          await refetch()
                        }}
                        setAnswerCollectionEntries={setAnswerCollectionEntries}
                        openAnswerCollectionEditModal={(
                          collectionId: number
                        ) => {
                          setCollectionModal({ open: true, id: collectionId })
                        }}
                      />
                    )}
                  </Form>

                  {Object.keys(errors).length !== 0 && (
                    <ElementFormErrors errors={errors} />
                  )}
                </div>

                {mode === ElementEditMode.EDIT ? (
                  <Tabs
                    defaultValue="preview"
                    onValueChange={(value) => {
                      setActiveTab(value)
                    }}
                    tabs={[
                      {
                        id: 'preview',
                        value: 'preview',
                        label: t('shared.generic.preview'),
                        data: { cy: 'element-preview-tab' },
                      },
                      {
                        id: 'activity',
                        value: 'activity',
                        label: t('shared.generic.activity'),
                        data: { cy: 'element-activity-tab' },
                      },
                    ]}
                    className={{ root: 'w-full max-w-sm', list: 'w-sm' }}
                  >
                    <TabContent value="preview">
                      <StudentElementPreview
                        values={values}
                        elementDataTypename={elementDataTypename}
                        answerCollectionEntries={answerCollectionEntries}
                      />
                    </TabContent>
                    <TabContent value="activity">
                      <div className="w-sm w-full flex-1">
                        <ActivityLog
                          visible={activeTab === 'activity'}
                          objectId={elementId || ''}
                          objectType={ObjectType.Element}
                        />
                      </div>
                    </TabContent>
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

              {mode === ElementEditMode.EDIT &&
                elementId &&
                !inputsDisabled && (
                  <InstanceUpdateSwitch
                    elementId={elementId}
                    hasSampleSolution={
                      'options' in values &&
                      'hasSampleSolution' in values.options
                        ? values.options.hasSampleSolution
                        : undefined
                    }
                    updateInstances={updateInstances}
                    setUpdateInstances={setUpdateInstances}
                    includeTemplateUpdates={includeTemplateUpdates}
                    setIncludeTemplateUpdates={setIncludeTemplateUpdates}
                  />
                )}
            </Modal>
          )
        }}
      </Formik>

      {collectionModal.open && typeof collectionModal.id !== 'undefined' ? (
        <AnswerCollectionEditModal
          inlineEditing
          collectionId={collectionModal.id}
          open={collectionModal.open}
          onClose={() => setCollectionModal({ open: false, id: undefined })}
          refetchAnswerCollections={async () => {
            await refetch()
          }}
          className={{ overlay: 'z-30', content: 'z-30' }}
        />
      ) : null}
    </>
  )
}

export default ElementEditForm
