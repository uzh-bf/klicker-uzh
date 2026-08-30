import { useQuery } from '@apollo/client'
import { faMagnifyingGlass, faMessage } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  type ElementData,
  type ElementStatus,
  ElementType,
  GetAnswerCollectionsElementsDocument,
  ObjectType,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  H3,
  Modal,
  TabContent,
  Tabs,
  toast,
} from '@uzh-bf/design-system'
import { Form, Formik, type FormikProps } from 'formik'
import { useTranslations } from 'next-intl'
import {
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useRef,
  useState,
} from 'react'
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
import AnswerFeedbackSetting from './options/AnswerFeedbackSetting'
import CaseStudyOptions from './options/CaseStudyOptions'
import ChoicesOptions from './options/ChoicesOptions'
import DisplayModeSetting from './options/DisplayModeSetting'
import FreeTextOptions from './options/FreeTextOptions'
import NumericalOptions from './options/NumericalOptions'
import OptionsLabel from './options/OptionsLabel'
import SelectionOptions from './options/SelectionOptions'
import StudentElementPreview from './StudentElementPreview'
import type { ElementFormTypes } from './types'
import useValidationSchema from './useValidationSchema'

function ElementEditForm({
  isTemplate = false,
  inputsDisabled = false,
  templateId,
  onClose,
  onSuccess,
  mode,
  elementId,
  loading,
  initialValues,
  onSubmitElement,
  setAutoSavedElement,
  updateInstances,
  setUpdateInstances,
  includeTemplateUpdates,
  setIncludeTemplateUpdates,
  titleOverride,
  submitLabel,
  submitErrorMessage,
  submitDataCy,
  secondaryAction,
  supplementaryContent,
  discardChangesPrompt,
}: {
  // flag to disable inputs (edit mode and read permissions)
  inputsDisabled?: boolean
  // flag to highlight template mode
  isTemplate?: boolean
  templateId?: string
  // modal state props
  onClose: () => void
  onSuccess: () => void
  // element mode and identification
  mode: ElementEditMode
  elementId?: number
  // loading state
  loading: boolean
  // form data props
  initialValues?: ElementFormTypes
  onSubmitElement: (
    values: ElementFormTypes & { status: ElementStatus }
  ) => Promise<boolean>
  setAutoSavedElement: Dispatch<SetStateAction<ElementFormTypes>>
  // instance update controls
  updateInstances: boolean
  setUpdateInstances: Dispatch<SetStateAction<boolean>>
  includeTemplateUpdates: boolean
  setIncludeTemplateUpdates: Dispatch<SetStateAction<boolean>>
  titleOverride?: string
  submitLabel?: string
  submitErrorMessage?: string
  submitDataCy?: string
  secondaryAction?: {
    label: string
    onClick: () => void | Promise<void>
    dataCy: string
  }
  supplementaryContent?: ReactNode
  discardChangesPrompt?: {
    title: string
    message: string
    confirmLabel: string
  }
}) {
  const t = useTranslations()
  const [activeTab, setActiveTab] = useState('preview')
  const [discardChangesOpen, setDiscardChangesOpen] = useState(false)
  const [secondaryActionLoading, setSecondaryActionLoading] = useState(false)
  const formikRef = useRef<FormikProps<ElementFormTypes>>(null)
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

  function requestClose() {
    if (discardChangesPrompt && formikRef.current?.dirty) {
      setDiscardChangesOpen(true)
      return
    }
    onClose()
  }

  async function runSecondaryAction() {
    if (!secondaryAction || secondaryActionLoading) return
    setSecondaryActionLoading(true)
    try {
      await secondaryAction.onClick()
    } catch {
      toast({
        type: 'error',
        message: t('shared.generic.systemError'),
        options: { duration: 6000 },
      })
    } finally {
      setSecondaryActionLoading(false)
    }
  }

  return (
    <>
      <Modal
        open
        fullScreen
        escapeDisabled
        loading={loading || (!isTemplate && !initialValues)}
        title={titleOverride ?? t(`manage.elements.${mode}Title`)}
        onClose={requestClose}
        className={{
          title: 'text-xl',
          content: 'h-max pb-1 text-sm md:text-base 2xl:max-w-[1400px]',
          footer: twMerge(isTemplate ? 'justify-end' : 'justify-between'),
        }}
        dataCloseButton={{ cy: 'close-element-modal' }}
      >
        {initialValues && (
          <Formik
            innerRef={formikRef}
            validateOnMount
            // enableReinitialize={!isTemplate && !initialValues}
            initialValues={initialValues}
            validationSchema={questionManipulationSchema}
            onSubmit={async (values, { setSubmitting }) => {
              setSubmitting(true)
              const success = await onSubmitElement(values)

              // close modal, set success toast
              setSubmitting(false)
              if (!success) {
                toast({
                  type: 'error',
                  message:
                    submitErrorMessage ??
                    t('manage.elements.questionSavedFailed'),
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
            }) => (
              <>
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
                      {supplementaryContent}

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
                          setAnswerCollectionEntries={
                            setAnswerCollectionEntries
                          }
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
                          setAnswerCollectionEntries={
                            setAnswerCollectionEntries
                          }
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

                  {mode === ElementEditMode.EDIT && elementId ? (
                    <Tabs
                      defaultValue="preview"
                      onValueChange={(value) => {
                        setActiveTab(value)
                      }}
                      tabs={[
                        {
                          id: 'preview',
                          value: 'preview',
                          label: (
                            <div className="flex flex-row items-center gap-2">
                              <FontAwesomeIcon icon={faMagnifyingGlass} />
                              <span>{t('shared.generic.preview')}</span>
                            </div>
                          ),
                          data: { cy: 'element-preview-tab' },
                        },
                        {
                          id: 'activity',
                          value: 'activity',
                          label: (
                            <div className="flex flex-row items-center gap-2">
                              <FontAwesomeIcon icon={faMessage} />
                              <span>{t('shared.comments.title')}</span>
                            </div>
                          ),
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
                        <div className="w-full flex-1">
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

                <div
                  className={twMerge(
                    'mt-4 flex gap-4',
                    isTemplate ? 'justify-end' : 'justify-between'
                  )}
                >
                  {!isTemplate && !inputsDisabled && (
                    <div className="flex flex-wrap gap-4">
                      <Button
                        onClick={requestClose}
                        data={{ cy: 'close-element-modal-button' }}
                      >
                        {t('shared.generic.close')}
                      </Button>
                      {secondaryAction ? (
                        <Button
                          onClick={runSecondaryAction}
                          disabled={isSubmitting || secondaryActionLoading}
                          loading={secondaryActionLoading}
                          data={{ cy: secondaryAction.dataCy }}
                        >
                          {secondaryAction.label}
                        </Button>
                      ) : null}
                    </div>
                  )}
                  {!inputsDisabled && (
                    <Button
                      primary
                      onClick={() => submitForm()}
                      disabled={!isValid || secondaryActionLoading}
                      loading={isSubmitting}
                      data={{ cy: submitDataCy ?? 'save-new-question' }}
                    >
                      {submitLabel ?? t('shared.generic.save')}
                    </Button>
                  )}
                </div>
              </>
            )}
          </Formik>
        )}

        {collectionModal.open && typeof collectionModal.id !== 'undefined' ? (
          <AnswerCollectionEditModal
            inlineEditing
            collectionId={collectionModal.id}
            onClose={() => setCollectionModal({ open: false, id: undefined })}
            refetchAnswerCollections={async () => {
              await refetch()
            }}
            className={{ overlay: 'z-30', content: 'z-30' }}
          />
        ) : null}
      </Modal>
      {discardChangesOpen && discardChangesPrompt ? (
        <Modal
          open
          title={discardChangesPrompt.title}
          onClose={() => setDiscardChangesOpen(false)}
          secondaryLabel={t('shared.generic.cancel')}
          onSecondaryAction={() => setDiscardChangesOpen(false)}
          dataSecondaryAction={{ cy: 'cancel-discard-element-changes' }}
          primaryLabel={discardChangesPrompt.confirmLabel}
          onPrimaryAction={() => {
            setDiscardChangesOpen(false)
            onClose()
          }}
          dataPrimaryAction={{ cy: 'confirm-discard-element-changes' }}
          data={{ cy: 'discard-element-changes-modal' }}
          className={{ content: 'max-w-lg' }}
        >
          <p>{discardChangesPrompt.message}</p>
        </Modal>
      ) : null}
    </>
  )
}

export default ElementEditForm
