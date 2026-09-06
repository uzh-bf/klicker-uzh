import { useQuery } from '@apollo/client'
import { faMagnifyingGlass, faMessage } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ElementData,
  ElementStatus,
  ElementType,
  GetAnswerCollectionsElementsDocument,
  ObjectType,
} from '@klicker-uzh/graphql/dist/ops'
import { ELEMENT_CREATION_AUTOSAVE_KEY } from '@lib/elementCreationRecovery'
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
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
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
  preserveDraftOnDismiss = false,
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
}: {
  // flag to disable inputs (edit mode and read permissions)
  inputsDisabled?: boolean
  // flag to highlight template mode
  isTemplate?: boolean
  templateId?: string
  // flag to preserve dirty drafts when the modal is dismissed (creation only)
  preserveDraftOnDismiss?: boolean
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
}) {
  const t = useTranslations()
  const [activeTab, setActiveTab] = useState('preview')
  const [answerCollectionEntries, setAnswerCollectionEntries] = useState<
    { id: number; value: string }[]
  >([])
  const [elementDataTypename, setElementDataTypename] = useState<
    ElementData['__typename'] | undefined
  >()
  const formikContextRef = useRef<FormikProps<ElementFormTypes>>(null)
  const formBodyRef = useRef<HTMLDivElement>(null)
  const formActionsRef = useRef<HTMLDivElement>(null)
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

  // Dismissal arbiter for the normal library creation form: pristine dismissal
  // closes immediately, a dirty draft is written to the recovery store and the
  // modal closes only after the raw store entry exactly matches the current
  // values, so a failed write never discards user input.
  const handleCloseRequest = useCallback(
    (
      formikContext:
        | { dirty: boolean; values: ElementFormTypes }
        | null
        | undefined
    ) => {
      if (!preserveDraftOnDismiss || !formikContext) {
        onClose()
        return
      }

      const { dirty, values } = formikContext
      if (!dirty) {
        onClose()
        return
      }

      let serializedValues: string | undefined
      let storedRaw: string | null | undefined
      try {
        serializedValues = JSON.stringify(values)
        setAutoSavedElement(values)
        storedRaw = localStorage.getItem(ELEMENT_CREATION_AUTOSAVE_KEY)
      } catch {
        storedRaw = undefined
      }

      if (
        typeof serializedValues === 'undefined' ||
        storedRaw !== serializedValues
      ) {
        toast({
          type: 'error',
          message: t('shared.generic.systemError'),
          options: { duration: 6000 },
        })
        return
      }

      onClose()
    },
    [onClose, preserveDraftOnDismiss, setAutoSavedElement, t]
  )

  useEffect(() => {
    if (!preserveDraftOnDismiss) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || collectionModal.open) return

      const eventPath = event.composedPath()
      const owningDialog = eventPath.find(
        (element) =>
          element instanceof HTMLElement &&
          element.getAttribute('role') === 'dialog'
      )
      if (owningDialog !== formBodyRef.current?.closest('[role="dialog"]'))
        return

      const formOwnsEvent = [formBodyRef.current, formActionsRef.current].some(
        (element) => element && eventPath.includes(element)
      )
      if (!formOwnsEvent) return

      event.preventDefault()
      event.stopPropagation()
      handleCloseRequest(formikContextRef.current)
    }

    window.addEventListener('keydown', handleEscape, true)
    return () => window.removeEventListener('keydown', handleEscape, true)
  }, [collectionModal.open, handleCloseRequest, preserveDraftOnDismiss])

  return (
    <Modal
      open
      fullScreen
      escapeDisabled
      loading={loading || (!isTemplate && !initialValues)}
      title={t(`manage.elements.${mode}Title`)}
      onClose={() => handleCloseRequest(formikContextRef.current)}
      className={{
        title: 'text-xl',
        content: 'h-max pb-1 text-sm md:text-base 2xl:max-w-[1400px]',
        footer: twMerge(isTemplate ? 'justify-end' : 'justify-between'),
      }}
      dataCloseButton={{ cy: 'close-element-modal' }}
    >
      {initialValues && (
        <Formik
          innerRef={formikContextRef}
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
              <div ref={formBodyRef} className="flex flex-row gap-12">
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
                ref={formActionsRef}
                className={twMerge(
                  'mt-4 flex gap-4',
                  isTemplate ? 'justify-end' : 'justify-between'
                )}
              >
                {!isTemplate && !inputsDisabled && (
                  <Button
                    onClick={() => handleCloseRequest(formikContextRef.current)}
                    data={{ cy: 'close-element-modal-button' }}
                  >
                    {t('shared.generic.close')}
                  </Button>
                )}
                {!inputsDisabled && (
                  <Button
                    primary
                    onClick={() => submitForm()}
                    disabled={!isValid}
                    loading={isSubmitting}
                    data={{ cy: 'save-new-question' }}
                  >
                    {t('shared.generic.save')}
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
  )
}

export default ElementEditForm
