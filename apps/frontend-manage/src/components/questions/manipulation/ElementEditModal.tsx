import { useMutation, useQuery } from '@apollo/client'
import {
  ElementData,
  ElementType,
  GetSingleQuestionDocument,
  GetUserQuestionsDocument,
  GetUserTagsDocument,
  ManipulateChoicesQuestionDocument,
  ManipulateContentElementDocument,
  ManipulateFlashcardElementDocument,
  ManipulateFreeTextQuestionDocument,
  ManipulateNumericalQuestionDocument,
  ManipulateSelectionQuestionDocument,
  UpdateElementInstancesDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { useLocalStorage } from '@uidotdev/usehooks'
import { Button, Modal } from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import React, { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import AutoSaveMonitor from './AutoSaveMonitor'
import ElementContentInput from './ElementContentInput'
import ElementExplanationField from './ElementExplanationField'
import ElementFailureToast from './ElementFailureToast'
import ElementFormErrors from './ElementFormErrors'
import ElementInformationFields from './ElementInformationFields'
import ElementTypeMonitor from './ElementTypeMonitor'
import InstanceUpdateSwitch from './InstanceUpdateSwitch'
import StudentElementPreview from './StudentElementPreview'
import {
  prepareChoicesArgs,
  prepareContentArgs,
  prepareFlashcardArgs,
  prepareFreeTextArgs,
  prepareNumericalArgs,
  prepareSelectionArgs,
} from './helpers'
import AnswerFeedbackSetting from './options/AnswerFeedbackSetting'
import ChoicesOptions from './options/ChoicesOptions'
import DisplayModeSetting from './options/DisplayModeSetting'
import FreeTextOptions from './options/FreeTextOptions'
import NumericalOptions from './options/NumericalOptions'
import OptionsLabel from './options/OptionsLabel'
import SampleSolutionSetting from './options/SampleSolutionSetting'
import SelectionOptions from './options/SelectionOptions'
import { ElementFormTypes } from './types'
import useElementFormInitialValues from './useElementFormInitialValues'
import useValidationSchema from './useValidationSchema'

export enum ElementEditMode {
  DUPLICATE = 'DUPLICATE',
  EDIT = 'EDIT',
  CREATE = 'CREATE',
}

interface ElementEditModalProps {
  isOpen: boolean
  handleSetIsOpen: (open: boolean) => void
  triggerSuccessToast: () => void
  elementId?: number
  mode: ElementEditMode
}

function ElementEditModal({
  isOpen,
  handleSetIsOpen,
  triggerSuccessToast,
  elementId,
  mode,
}: ElementEditModalProps): React.ReactElement {
  const t = useTranslations()

  const isDuplication = mode === ElementEditMode.DUPLICATE
  const [updateInstances, setUpdateInstances] = useState(false)
  const [failureToast, setFailureToast] = useState(false)
  const [answerCollectionEntries, setAnswerCollectionEntries] = useState<
    { id: number; value: string }[]
  >([])
  const [elementDataTypename, setElementDataTypename] =
    useState<ElementData['__typename']>('ChoicesElementData')

  const questionManipulationSchema = useValidationSchema({
    numberOfAnswerOptions: answerCollectionEntries.length,
  })

  const [autoSavedElement, setAutoSavedElement] =
    useLocalStorage<ElementFormTypes>(
      typeof elementId === 'undefined'
        ? 'autosave-element-creation'
        : `autosave-element-${elementId}`,
      undefined
    )

  const { loading: loadingQuestion, data: dataQuestion } = useQuery(
    GetSingleQuestionDocument,
    {
      variables: { id: elementId! },
      skip: typeof elementId === 'undefined' || !isOpen,
    }
  )

  const [manipulateContentElement] = useMutation(
    ManipulateContentElementDocument
  )
  const [manipulateFlashcardElement] = useMutation(
    ManipulateFlashcardElementDocument
  )
  const [manipulateChoicesQuestion] = useMutation(
    ManipulateChoicesQuestionDocument
  )
  const [manipulateNumericalQuestion] = useMutation(
    ManipulateNumericalQuestionDocument
  )
  const [manipulateFreeTextQuestion] = useMutation(
    ManipulateFreeTextQuestionDocument
  )
  const [manipulateSelectionQuestion] = useMutation(
    ManipulateSelectionQuestionDocument
  )
  const [updateElementInstances] = useMutation(UpdateElementInstancesDocument)

  const initialValues = useElementFormInitialValues({
    mode,
    question: dataQuestion?.question,
    isDuplication,
  })

  if (!initialValues || Object.keys(initialValues).length === 0) {
    return <div />
  }

  return (
    <Formik
      validateOnMount
      enableReinitialize
      initialValues={autoSavedElement ?? initialValues}
      validationSchema={questionManipulationSchema}
      onSubmit={async (values, { setSubmitting }) => {
        setSubmitting(true)

        switch (values.type) {
          case ElementType.Content: {
            const args = prepareContentArgs({
              elementId,
              isDuplication,
              values,
            })

            const result = await manipulateContentElement({
              variables: args,
              refetchQueries: [
                { query: GetUserQuestionsDocument },
                { query: GetUserTagsDocument },
              ],
            })

            const data = result.data?.manipulateContentElement
            if (data?.__typename !== 'ContentElement' || !data.id) {
              setFailureToast(true)
              return
            }

            break
          }

          case ElementType.Flashcard: {
            const args = prepareFlashcardArgs({
              elementId,
              isDuplication,
              values,
            })

            const result = await manipulateFlashcardElement({
              variables: args,
              refetchQueries: [
                { query: GetUserQuestionsDocument },
                { query: GetUserTagsDocument },
              ],
            })

            const data = result.data?.manipulateFlashcardElement
            if (data?.__typename !== 'FlashcardElement' || !data.id) {
              setFailureToast(true)
              return
            }

            break
          }

          case ElementType.Sc:
          case ElementType.Mc:
          case ElementType.Kprim: {
            const args = prepareChoicesArgs({
              elementId,
              isDuplication,
              values,
            })

            const result = await manipulateChoicesQuestion({
              variables: args,
              refetchQueries: [
                { query: GetUserQuestionsDocument },
                { query: GetUserTagsDocument },
              ],
            })

            const data = result.data?.manipulateChoicesQuestion
            if (data?.__typename !== 'ChoicesElement' || !data.id) {
              setFailureToast(true)
              return
            }

            break
          }
          case ElementType.Numerical: {
            const args = prepareNumericalArgs({
              elementId,
              isDuplication,
              values,
            })

            const result = await manipulateNumericalQuestion({
              variables: args,
              refetchQueries: [
                { query: GetUserQuestionsDocument },
                { query: GetUserTagsDocument },
              ],
            })

            const data = result.data?.manipulateNumericalQuestion
            if (data?.__typename !== 'NumericalElement' || !data.id) {
              setFailureToast(true)
              return
            }

            break
          }
          case ElementType.FreeText: {
            const args = prepareFreeTextArgs({
              elementId,
              isDuplication,
              values,
            })

            const result = await manipulateFreeTextQuestion({
              variables: args,
              refetchQueries: [
                { query: GetUserQuestionsDocument },
                { query: GetUserTagsDocument },
              ],
            })

            const data = result.data?.manipulateFreeTextQuestion
            if (data?.__typename !== 'FreeTextElement' || !data.id) {
              setFailureToast(true)
              return
            }

            break
          }
          case ElementType.Selection: {
            const args = prepareSelectionArgs({
              elementId,
              isDuplication,
              values,
            })

            const result = await manipulateSelectionQuestion({
              variables: args,
              refetchQueries: [
                { query: GetUserQuestionsDocument },
                { query: GetUserTagsDocument },
              ],
            })

            const data = result.data?.manipulateSelectionQuestion
            if (data?.__typename !== 'SelectionElement' || !data.id) {
              setFailureToast(true)
              return
            }

            break
          }

          default:
            break
        }

        if (mode === ElementEditMode.EDIT && updateInstances) {
          if (elementId !== null && typeof elementId !== 'undefined') {
            await updateElementInstances({
              variables: { elementId: elementId },
            })
          }
        }

        setSubmitting(false)
        triggerSuccessToast()
        handleSetIsOpen(false)
      }}
    >
      {({
        values,
        errors,
        isSubmitting,
        isValid,
        setFieldValue,
        validateForm,
      }) => {
        if (loadingQuestion) {
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
            open={isOpen}
            onClose={() => handleSetIsOpen(false)}
            escapeDisabled={true}
            onPrimaryAction={
              <Button
                disabled={isSubmitting || !isValid}
                className={{
                  root: twMerge(
                    'border-uzh-grey-80 bg-primary-80 mt-2 font-bold text-white',
                    (isSubmitting || !isValid) &&
                      'cursor-not-allowed opacity-50'
                  ),
                }}
                type="submit"
                form="question-manipulation-form"
                data={{ cy: 'save-new-question' }}
              >
                <Button.Label>{t('shared.generic.save')}</Button.Label>
              </Button>
            }
            onSecondaryAction={
              <Button
                className={{ root: 'border-uzh-grey-80 mt-2' }}
                onClick={() => handleSetIsOpen(false)}
                data={{ cy: 'close-question-modal' }}
              >
                <Button.Label>{t('shared.generic.close')}</Button.Label>
              </Button>
            }
          >
            <AutoSaveMonitor
              values={values}
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

                  <div className="mt-4 flex flex-row gap-4">
                    <OptionsLabel type={values.type} />
                    <SampleSolutionSetting type={values.type} />
                    <AnswerFeedbackSetting values={values} />
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
                      values={values}
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

            {mode === ElementEditMode.EDIT && (
              <InstanceUpdateSwitch
                updateInstances={updateInstances}
                setUpdateInstances={setUpdateInstances}
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

export default ElementEditModal
