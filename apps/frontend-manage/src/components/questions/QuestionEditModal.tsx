import { useMutation, useQuery } from '@apollo/client'
import {
  faArrowDown,
  faArrowUp,
  faTrash,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ElementDisplayMode,
  ElementInstance,
  ElementInstanceType,
  ElementType,
  GetSingleQuestionDocument,
  GetUserQuestionsDocument,
  GetUserTagsDocument,
  ManipulateChoicesQuestionDocument,
  ManipulateContentElementDocument,
  ManipulateFlashcardElementDocument,
  ManipulateFreeTextQuestionDocument,
  ManipulateNumericalQuestionDocument,
  UpdateQuestionInstancesDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import StudentElement, {
  StudentResponseType,
} from '@klicker-uzh/shared-components/src/StudentElement'
import { QUESTION_GROUPS } from '@klicker-uzh/shared-components/src/constants'
import {
  Button,
  FormLabel,
  FormikNumberField,
  FormikSelectField,
  FormikSwitchField,
  FormikTextField,
  H3,
  H4,
  Modal,
  Prose,
  Switch,
  UserNotification,
} from '@uzh-bf/design-system'
import {
  FastField,
  FastFieldProps,
  FieldArray,
  FieldArrayRenderProps,
  FieldProps,
  Form,
  Formik,
} from 'formik'
import { useTranslations } from 'next-intl'
import React, { Suspense, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import ContentInput from '../common/ContentInput'
import MultiplierSelector from '../sessions/creation/MultiplierSelector'
import ElementTypeMonitor from './ElementTypeMonitor'
import {
  prepareChoicesArgs,
  prepareContentArgs,
  prepareFlashcardArgs,
  prepareFreeTextArgs,
  prepareNumericalArgs,
} from './helpers'
import SuspendedTagInput from './tags/SuspendedTagInput'
import useElementFormInitialValues from './useElementFormInitialValues'
import useQuestionTypeOptions from './useQuestionTypeOptions'
import useStatusOptions from './useStatusOptions'
import useValidationSchema from './useValidationSchema'

export enum QuestionEditMode {
  DUPLICATE = 'DUPLICATE',
  EDIT = 'EDIT',
  CREATE = 'CREATE',
}

interface QuestionEditModalProps {
  isOpen: boolean
  handleSetIsOpen: (open: boolean) => void
  questionId?: number
  mode: QuestionEditMode
}

function QuestionEditModal({
  isOpen,
  handleSetIsOpen,
  questionId,
  mode,
}: QuestionEditModalProps): React.ReactElement {
  // TODO: styling of tooltips - some are too wide
  const t = useTranslations()
  const questionManipulationSchema = useValidationSchema()

  const isDuplication = mode === QuestionEditMode.DUPLICATE
  const [updateInstances, setUpdateInstances] = useState(false)
  const [elementDataTypename, setElementDataTypename] =
    useState('ChoicesElementData')
  const [studentResponse, setStudentResponse] = useState<StudentResponseType>(
    {}
  )

  const { loading: loadingQuestion, data: dataQuestion } = useQuery(
    GetSingleQuestionDocument,
    {
      variables: { id: questionId! },
      skip: typeof questionId === 'undefined',
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
  const [updateQuestionInstances] = useMutation(UpdateQuestionInstancesDocument)

  const statusOptions = useStatusOptions()
  const questionTypeOptions = useQuestionTypeOptions()

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
      initialValues={initialValues}
      validationSchema={questionManipulationSchema}
      onSubmit={async (values, { setSubmitting }) => {
        setSubmitting(true)

        switch (values.type) {
          case ElementType.Content: {
            const args = prepareContentArgs({
              questionId,
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
            if (data?.__typename !== 'ContentElement' || !data.id) return
            break
          }

          case ElementType.Flashcard: {
            const args = prepareFlashcardArgs({
              questionId,
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
            if (data?.__typename !== 'FlashcardElement' || !data.id) return
            break
          }

          case ElementType.Sc:
          case ElementType.Mc:
          case ElementType.Kprim: {
            const args = prepareChoicesArgs({
              questionId,
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
            if (data?.__typename !== 'ChoicesElement' || !data.id) return
            break
          }
          case ElementType.Numerical: {
            const args = prepareNumericalArgs({
              questionId,
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
            if (data?.__typename !== 'NumericalElement' || !data.id) return
            break
          }
          case ElementType.FreeText: {
            const args = prepareFreeTextArgs({
              questionId,
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
            if (data?.__typename !== 'FreeTextElement' || !data.id) return
            break
          }

          default:
            break
        }

        if (mode === QuestionEditMode.EDIT && updateInstances) {
          if (questionId !== null && typeof questionId !== 'undefined') {
            await updateQuestionInstances({
              variables: { questionId: questionId },
            })
          }
        }

        setSubmitting(false)
        handleSetIsOpen(false)
      }}
    >
      {({ errors, isSubmitting, values, isValid, setFieldValue }) => {
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
            <ElementTypeMonitor
              elementType={values.type ?? ElementType.Sc}
              setElementDataTypename={setElementDataTypename}
            />
            <div className="flex flex-row gap-12">
              <div className="max-w-5xl flex-1">
                <Form className="w-full" id="question-manipulation-form">
                  <div className="z-0 flex flex-row justify-between">
                    <FormikSelectField
                      name="type"
                      required={mode === 'CREATE'}
                      contentPosition="popper"
                      disabled={mode === 'EDIT'}
                      label={t('manage.questionForms.questionType')}
                      placeholder={t('manage.questionForms.selectQuestionType')}
                      items={questionTypeOptions}
                      data={{ cy: 'select-question-type' }}
                      className={{ select: { trigger: 'h-8 w-max' } }}
                    />

                    <FormikSelectField
                      name="status"
                      contentPosition="popper"
                      label={t('manage.questionForms.questionStatus')}
                      placeholder={t(
                        'manage.questionForms.selectQuestionStatus'
                      )}
                      items={statusOptions}
                      data={{ cy: 'select-question-status' }}
                      className={{ select: { trigger: 'h-8 w-32' } }}
                    />
                  </div>

                  <div className="mt-2 flex flex-row">
                    <FormikTextField
                      name="name"
                      required
                      label={t('manage.questionForms.questionTitle')}
                      tooltip={t('manage.questionForms.titleTooltip')}
                      className={{
                        root: 'w-full',
                      }}
                      data={{ cy: 'insert-question-title' }}
                    />
                  </div>

                  <div className="mt-2 flex flex-row gap-2">
                    {values.type !== ElementType.Content &&
                      values.type !== ElementType.Flashcard && (
                        <div>
                          <MultiplierSelector
                            name="pointsMultiplier"
                            disabled={isSubmitting}
                          />
                        </div>
                      )}
                    <div className="flex w-full flex-col">
                      <FormLabel
                        required={false}
                        label={t('manage.questionPool.tags')}
                        labelType="small"
                        tooltip={t('manage.questionForms.tagsTooltip')}
                      />
                      <Suspense fallback={<Loader />}>
                        <SuspendedTagInput />
                      </Suspense>
                    </div>
                  </div>

                  <div className="mt-4">
                    {typeof values.content !== 'undefined' && (
                      <FastField
                        name="content"
                        questionType={values.type}
                        shouldUpdate={(next, prev) =>
                          next?.formik.values.content !==
                            prev?.formik.values.content ||
                          next?.formik.values.type !== prev?.formik.values.type
                        }
                      >
                        {({ field, meta }: FastFieldProps) => (
                          <>
                            <FormLabel
                              required
                              label={t('shared.generic.question')}
                              labelType="small"
                              tooltip={t(
                                'manage.questionForms.questionTooltip'
                              )}
                            />
                            <ContentInput
                              autoFocus
                              error={meta.error}
                              touched={meta.touched}
                              content={field.value || '<br>'}
                              onChange={(newValue: string) =>
                                setFieldValue('content', newValue)
                              }
                              showToolbarOnFocus={false}
                              placeholder={t(
                                'manage.questionForms.questionPlaceholder'
                              )}
                              key={`${values.type}-content`}
                              data={{ cy: 'insert-question-text' }}
                              className={{ content: 'max-w-none' }}
                            />
                          </>
                        )}
                      </FastField>
                    )}
                  </div>

                  {values.type !== ElementType.Content && (
                    <div className="mt-4">
                      {typeof values.explanation !== 'undefined' && (
                        <FastField
                          name="explanation"
                          questionType={values.type}
                          shouldUpdate={(next, prev) =>
                            next?.formik.values.explanation !==
                              prev?.formik.values.explanation ||
                            next?.formik.values.type !==
                              prev?.formik.values.type
                          }
                        >
                          {({ field, meta }: FastFieldProps) => (
                            <>
                              <FormLabel
                                required={values.type === ElementType.Flashcard}
                                label={t('shared.generic.explanation')}
                                labelType="small"
                                tooltip={t(
                                  'manage.questionForms.explanationTooltip'
                                )}
                              />
                              <ContentInput
                                error={meta.error}
                                touched={meta.touched}
                                content={field.value || '<br>'}
                                onChange={(newValue: string) =>
                                  setFieldValue('explanation', newValue)
                                }
                                placeholder={t(
                                  'manage.questionForms.explanationPlaceholder'
                                )}
                                key={`${values.type}-explanation`}
                                data={{ cy: 'insert-question-explanation' }}
                              />
                            </>
                          )}
                        </FastField>
                      )}
                    </div>
                  )}

                  <div className="mt-4 flex flex-row gap-4">
                    {QUESTION_GROUPS.CHOICES.includes(values.type) && (
                      <div className="flex-1">
                        <FormLabel
                          required
                          label={t('manage.questionForms.answerOptions')}
                          labelType="small"
                          tooltip={t(
                            'manage.questionForms.answerOptionsTooltip'
                          )}
                          className={{ label: 'text-black' }}
                        />
                      </div>
                    )}
                    {QUESTION_GROUPS.FREE.includes(values.type) && (
                      <div className="flex-1">
                        <FormLabel
                          required
                          label={t('shared.generic.options')}
                          labelType="small"
                          tooltip={
                            values.type === ElementType.Numerical
                              ? t(
                                  'manage.questionForms.NUMERICALOptionsTooltip'
                                )
                              : t('manage.questionForms.FTOptionsTooltip')
                          }
                          className={{ label: 'mb-1 text-black' }}
                        />
                      </div>
                    )}
                    {QUESTION_GROUPS.ALL.includes(values.type) && (
                      <FormikSwitchField
                        name="options.hasSampleSolution"
                        label={t('shared.generic.sampleSolution')}
                        data={{ cy: 'configure-sample-solution' }}
                        className={{ label: 'text-gray-600' }}
                      />
                    )}
                    {QUESTION_GROUPS.CHOICES.includes(values.type) && (
                      <FormikSwitchField
                        name="options.hasAnswerFeedbacks"
                        label={t('manage.questionPool.answerFeedbacks')}
                        disabled={!values.options?.hasSampleSolution}
                        className={{
                          root: twMerge(
                            !values.options?.hasSampleSolution && 'opacity-50'
                          ),
                          label: 'text-gray-600',
                        }}
                      />
                    )}
                    {[ElementType.Sc, ElementType.Mc].includes(values.type) && (
                      <FormikSelectField
                        contentPosition="popper"
                        name="options.displayMode"
                        items={Object.values(ElementDisplayMode).map(
                          (mode) => ({
                            value: mode,
                            label: t(`manage.questionForms.${mode}Display`),
                            data: {
                              cy: `select-display-mode-${t(
                                `manage.questionForms.${mode}Display`
                              )}`,
                            },
                          })
                        )}
                        data={{ cy: 'select-display-mode' }}
                        className={{ select: { trigger: 'h-8 w-48' } }}
                      />
                    )}
                  </div>

                  {QUESTION_GROUPS.CHOICES.includes(values.type) && (
                    <FieldArray name="options.choices">
                      {({ push, remove, move }: FieldArrayRenderProps) => {
                        return (
                          <div className="flex w-full flex-col gap-2 pt-2">
                            {values.options?.choices?.map(
                              (
                                choice: {
                                  ix: number
                                  value: string
                                  correct?: boolean
                                  feedback?: string
                                },
                                index: number
                              ) => (
                                <div
                                  key={index}
                                  className={twMerge(
                                    'border-uzh-grey-80 w-full rounded',
                                    values.options?.hasSampleSolution && 'p-2',
                                    choice.correct &&
                                      values.options?.hasSampleSolution &&
                                      'border-green-300 bg-green-100',
                                    !choice.correct &&
                                      values.options?.hasSampleSolution &&
                                      'border-red-300 bg-red-100'
                                  )}
                                >
                                  <div className="focus:border-primary-40 flex w-full flex-row items-center">
                                    {/* // TODO: define maximum height of editor if possible */}
                                    <FastField
                                      name={`options.choices.${index}.value`}
                                      questionType={values.type}
                                      shouldUpdate={(next, prev) =>
                                        next?.formik.values.options.choices[
                                          index
                                        ].value !==
                                          prev?.formik.values.options.choices[
                                            index
                                          ].value ||
                                        next.formik.values.type !==
                                          prev.formik.values.type
                                      }
                                    >
                                      {({ field, meta }: FastFieldProps) => (
                                        <ContentInput
                                          key={`${values.type}-choice-${index}-${values.options?.choices.length}-${values.options.choices[index].ix}`}
                                          error={meta.error}
                                          touched={meta.touched}
                                          content={field.value}
                                          onChange={(newContent: string) => {
                                            setFieldValue(
                                              `options.choices.${index}.value`,
                                              newContent
                                            )
                                          }}
                                          showToolbarOnFocus={true}
                                          placeholder={t(
                                            'manage.questionForms.answerOptionPlaceholder'
                                          )}
                                          className={{
                                            root: 'bg-white',
                                          }}
                                          data={{
                                            cy: `insert-answer-field-${index}`,
                                          }}
                                        />
                                      )}
                                    </FastField>
                                    {values.options?.hasSampleSolution && (
                                      <div className="ml-2 flex flex-row items-center">
                                        <div className="mr-2">
                                          {t('shared.generic.correct')}?
                                        </div>
                                        <FastField
                                          name={`options.choices.${index}.correct`}
                                        >
                                          {({ field }: FieldProps) => (
                                            <Switch
                                              checked={field.value || false}
                                              label=""
                                              className={{
                                                root: 'mr-0.5 gap-0',
                                              }}
                                              onCheckedChange={(
                                                newValue: boolean
                                              ) => {
                                                setFieldValue(
                                                  `options.choices.${index}.correct`,
                                                  newValue
                                                )
                                              }}
                                              data={{
                                                cy: `set-correctness-${index}`,
                                              }}
                                            />
                                          )}
                                        </FastField>
                                      </div>
                                    )}
                                    <div className="ml-2 flex flex-col">
                                      <Button
                                        className={{ root: 'px-auto py-0.5' }}
                                        disabled={index === 0}
                                        onClick={() => move(index, index - 1)}
                                        data={{
                                          cy: `move-answer-option-ix-${index}-up`,
                                        }}
                                      >
                                        <FontAwesomeIcon
                                          icon={faArrowUp}
                                          className="h-3.5"
                                        />
                                      </Button>
                                      <Button
                                        className={{ root: 'px-auto py-0.5' }}
                                        disabled={
                                          index ===
                                          values.options?.choices.length - 1
                                        }
                                        onClick={() => move(index, index + 1)}
                                        data={{
                                          cy: `move-answer-option-ix-${index}-down`,
                                        }}
                                      >
                                        <FontAwesomeIcon
                                          icon={faArrowDown}
                                          className="h-3.5"
                                        />
                                      </Button>
                                    </div>
                                    <Button
                                      onClick={() => {
                                        // decrement the choice.ix value of all answers after this one
                                        values.options?.choices
                                          .slice(index + 1)
                                          .forEach((choice) => {
                                            setFieldValue(
                                              `options.choices.${choice.ix}.ix`,
                                              choice.ix - 1
                                            )
                                          })
                                        remove(index)
                                      }}
                                      className={{
                                        root: 'h-10 w-10 items-center justify-center rounded-md bg-red-600 text-white',
                                      }}
                                      data={{
                                        cy: `delete-answer-option-ix-${index}`,
                                      }}
                                    >
                                      <Button.Icon>
                                        <FontAwesomeIcon
                                          icon={faTrash}
                                          className="hover:bg-primary-20"
                                        />
                                      </Button.Icon>
                                    </Button>
                                  </div>

                                  {values.options?.hasAnswerFeedbacks &&
                                    values.options?.hasSampleSolution && (
                                      <div className="">
                                        <div className="mt-2 text-sm font-bold">
                                          {t('shared.generic.feedback')}
                                        </div>
                                        <FastField
                                          name={`options.choices.${index}.feedback`}
                                          questionType={values.type}
                                          shouldUpdate={(next, prev) =>
                                            next?.formik.values.options.choices[
                                              index
                                            ].feedback !==
                                              prev?.formik.values.options
                                                .choices[index].feedback ||
                                            next?.formik.values.type !==
                                              prev?.formik.values.type
                                          }
                                        >
                                          {({
                                            field,
                                            meta,
                                          }: FastFieldProps) => (
                                            <ContentInput
                                              key={`${values.type}-feedback-${index}-${values.options.choices[index].ix}`}
                                              error={meta.error}
                                              touched={meta.touched}
                                              content={field.value || '<br>'}
                                              onChange={(
                                                newContent: string
                                              ): void => {
                                                setFieldValue(
                                                  `options.choices.${index}.feedback`,
                                                  newContent
                                                )
                                              }}
                                              className={{
                                                root: 'bg-white',
                                                content:
                                                  'border-uzh-grey-100 focus:border-primary-40 w-full rounded border',
                                              }}
                                              showToolbarOnFocus={true}
                                              placeholder={t(
                                                'manage.questionForms.feedbackPlaceholder'
                                              )}
                                            />
                                          )}
                                        </FastField>
                                      </div>
                                    )}
                                </div>
                              )
                            )}

                            <Button
                              fluid
                              className={{
                                root: twMerge(
                                  'border-uzh-grey-100 border border-solid font-bold',
                                  values.type === ElementType.Kprim &&
                                    values.options?.choices.length >= 4 &&
                                    'cursor-not-allowed opacity-50'
                                ),
                              }}
                              disabled={
                                values.type === ElementType.Kprim &&
                                values.options?.choices.length >= 4
                              }
                              onClick={() =>
                                push({
                                  ix: values.options?.choices[
                                    values.options?.choices.length - 1
                                  ]
                                    ? values.options?.choices[
                                        values.options?.choices.length - 1
                                      ].ix + 1
                                    : 0,
                                  value: '<br>',
                                  correct: false,
                                  feedback: '',
                                })
                              }
                              data={{ cy: 'add-new-answer' }}
                            >
                              {t('manage.questionForms.addAnswer')}
                            </Button>
                          </div>
                        )
                      }}
                    </FieldArray>
                  )}

                  {values.type === ElementType.Numerical && (
                    <div>
                      <div className="w-full">
                        <div className="mb-2 flex flex-row items-center gap-2">
                          <FormikNumberField
                            name="options.restrictions.min"
                            label={t('shared.generic.min')}
                            placeholder={t('shared.generic.minLong')}
                            data={{ cy: 'set-numerical-minimum' }}
                            hideError
                          />
                          <FormikNumberField
                            name="options.restrictions.max"
                            label={t('shared.generic.max')}
                            placeholder={t('shared.generic.maxLong')}
                            data={{ cy: 'set-numerical-maximum' }}
                            hideError
                          />
                          <FormikTextField
                            name="options.unit"
                            label={t('shared.generic.unit')}
                            placeholder="CHF"
                            data={{ cy: 'set-numerical-unit' }}
                          />
                          <FormikNumberField
                            name="options.accuracy"
                            label={t('shared.generic.precision')}
                            precision={0}
                            data={{ cy: 'set-numerical-accuracy' }}
                            hideError
                          />
                        </div>
                      </div>
                      {values.options?.hasSampleSolution && (
                        <div className="mt-3">
                          <FormLabel
                            required
                            label={t('manage.questionForms.solutionRanges')}
                            labelType="small"
                            tooltip={t(
                              'manage.questionForms.solutionRangesTooltip'
                            )}
                          />
                          <FieldArray name="options.solutionRanges">
                            {({ push, remove }: FieldArrayRenderProps) => (
                              <div className="flex w-max flex-col gap-1">
                                {values.options?.solutionRanges?.map(
                                  (_range: any, index: number) => (
                                    <div
                                      className="flex flex-row items-end gap-2"
                                      key={`${index}-${values.options?.solutionRanges.length}`}
                                    >
                                      <FormikNumberField
                                        required={index === 0}
                                        name={`options.solutionRanges.${index}.min`}
                                        label={t('shared.generic.min')}
                                        placeholder={t(
                                          'shared.generic.minLong'
                                        )}
                                        data={{
                                          cy: `set-solution-range-min-${index}`,
                                        }}
                                      />
                                      <FormikNumberField
                                        required={index === 0}
                                        name={`options.solutionRanges.${index}.max`}
                                        label={t('shared.generic.max')}
                                        placeholder={t(
                                          'shared.generic.maxLong'
                                        )}
                                        data={{
                                          cy: `set-solution-range-max-${index}`,
                                        }}
                                      />
                                      <Button
                                        onClick={() => remove(index)}
                                        className={{
                                          root: 'ml-2 h-9 bg-red-500 text-white hover:bg-red-600',
                                        }}
                                        data={{
                                          cy: `delete-solution-range-ix-${index}`,
                                        }}
                                      >
                                        {t('shared.generic.delete')}
                                      </Button>
                                    </div>
                                  )
                                )}
                                <Button
                                  fluid
                                  className={{
                                    root: 'border-uzh-grey-100 flex-1 border border-solid font-bold',
                                  }}
                                  onClick={() =>
                                    push({
                                      min: undefined,
                                      max: undefined,
                                    })
                                  }
                                  data={{ cy: 'add-solution-range' }}
                                >
                                  {t('manage.questionForms.addSolutionRange')}
                                </Button>
                              </div>
                            )}
                          </FieldArray>
                        </div>
                      )}
                    </div>
                  )}

                  {values.type === ElementType.FreeText && (
                    <div className="flex flex-col">
                      <div className="mb-4 flex flex-row items-center">
                        <FormikNumberField
                          name="options.restrictions.maxLength"
                          label={t('manage.questionForms.maximumLength')}
                          className={{
                            field: 'w-44',
                          }}
                          placeholder={t('manage.questionForms.answerLength')}
                          precision={0}
                          data={{ cy: 'set-free-text-length' }}
                          hideError
                        />
                      </div>
                      {values.options?.hasSampleSolution && (
                        <FieldArray name="options.solutions">
                          {({ push, remove }: FieldArrayRenderProps) => (
                            <div className="flex w-max flex-col gap-1">
                              {values.options?.solutions?.map(
                                (_solution, index) => (
                                  <div
                                    className="flex flex-row items-end gap-2"
                                    key={`${index}-${values.options?.solutions.length}`}
                                  >
                                    <FormikTextField
                                      required
                                      name={`options.solutions.${index}`}
                                      label={t(
                                        'manage.questionForms.possibleSolutionN',
                                        { number: String(index + 1) }
                                      )}
                                      type="text"
                                      placeholder={t('shared.generic.solution')}
                                    />
                                    <Button
                                      onClick={() => remove(index)}
                                      className={{
                                        root: 'ml-2 h-9 bg-red-500 text-white hover:bg-red-600',
                                      }}
                                      data={{
                                        cy: `delete-solution-ix-${index}`,
                                      }}
                                    >
                                      {t('shared.generic.delete')}
                                    </Button>
                                  </div>
                                )
                              )}
                              <Button
                                fluid
                                className={{
                                  root: 'border-uzh-grey-100 flex-1 border border-solid font-bold',
                                }}
                                onClick={() => push('')}
                                data={{ cy: 'add-solution-value' }}
                              >
                                {t('manage.questionForms.addSolution')}
                              </Button>
                            </div>
                          )}
                        </FieldArray>
                      )}
                    </div>
                  )}
                </Form>

                {JSON.stringify(errors) !== '{}' && (
                  <UserNotification
                    className={{
                      root: 'mt-8 p-4 text-base',
                      icon: 'text-red-700',
                      message: 'text-red-700',
                    }}
                    type="error"
                  >
                    <div>{t('manage.formErrors.resolveErrors')}</div>
                    <ul className="ml-4 list-disc">
                      {errors.name && (
                        <li>{`${t('manage.questionForms.questionTitle')}: ${
                          errors.name
                        }`}</li>
                      )}
                      {errors.tags && (
                        <li>{`${t('manage.questionPool.tags')}: ${
                          errors.tags
                        }`}</li>
                      )}
                      {errors.pointsMultiplier && (
                        <li>{`${t('shared.generic.multiplier')}: ${
                          errors.pointsMultiplier
                        }`}</li>
                      )}
                      {errors.content && (
                        <li>{`${t('shared.generic.question')}: ${
                          errors.content
                        }`}</li>
                      )}
                      {errors.explanation && (
                        <li>{`${t('shared.generic.explanation')}: ${
                          errors.explanation
                        }`}</li>
                      )}

                      {/* error messages specific to SC / MC / KP questions */}
                      {errors.options &&
                        errors.options.choices &&
                        typeof errors.options.choices === 'object' &&
                        errors.options.choices?.map(
                          (choiceError: any, ix: number) =>
                            choiceError && (
                              <li key={`choice-${ix}`}>{`${t(
                                'manage.questionForms.answerOption'
                              )} ${ix + 1}: ${
                                choiceError.value && choiceError.feedback
                                  ? `${choiceError.value} ${choiceError.feedback}`
                                  : choiceError.value || choiceError.feedback
                              }`}</li>
                            )
                        )}
                      {errors.options &&
                        errors.options.choices &&
                        typeof errors.options.choices === 'string' && (
                          <li>{`${t('manage.questionForms.answerOptions')}: ${
                            errors.options.choices
                          }`}</li>
                        )}

                      {/* error messages specific to NR questions */}
                      {errors.options && errors.options.accuracy && (
                        <li>{`${t('shared.generic.precision')}: ${
                          errors.options.accuracy
                        }`}</li>
                      )}
                      {errors.options && errors.options.unit && (
                        <li>{`${t('shared.generic.unit')}: ${
                          errors.options.unit
                        }`}</li>
                      )}
                      {errors.options &&
                        errors.options.solutionRanges &&
                        typeof errors.options.solutionRanges === 'string' && (
                          <li>{`${t('manage.questionForms.solutionRanges')}: ${
                            errors.options.solutionRanges
                          }`}</li>
                        )}

                      {/* error messages specific to FT questions */}
                      {errors.options &&
                        errors.options.restrictions?.maxLength && (
                          <li>{`${t('manage.questionForms.answerLength')}: ${
                            errors.options.restrictions.maxLength
                          }`}</li>
                        )}

                      {/* error messages specific to NR questions */}
                      {errors.options && errors.options.restrictions?.min && (
                        <li>{`${t('manage.questionForms.restrictions')}: ${
                          errors.options.restrictions.min
                        }`}</li>
                      )}
                      {errors.options && errors.options.restrictions?.max && (
                        <li>{`${t('manage.questionForms.restrictions')}: ${
                          errors.options.restrictions.max
                        }`}</li>
                      )}

                      {errors.options &&
                        errors.options.solutions &&
                        typeof errors.options.solutions === 'object' &&
                        errors.options.solutions?.map(
                          (solutionError: any, ix: number) =>
                            solutionError && (
                              <li key={`solution-${ix}`}>{`${t(
                                'manage.questionForms.possibleSolutionN',
                                { number: String(ix + 1) }
                              )}: ${solutionError}`}</li>
                            )
                        )}
                      {errors.options &&
                        errors.options.solutions &&
                        typeof errors.options.solutions === 'string' && (
                          <li>{`${t(
                            'manage.questionForms.possibleSolutions'
                          )}: ${errors.options.solutions}`}</li>
                        )}
                    </ul>
                  </UserNotification>
                )}
              </div>
              <div className="max-w-sm flex-1">
                <H3>{t('shared.generic.preview')}</H3>
                <div className="rounded border p-4">
                  <StudentElement
                    element={
                      {
                        id: 0,
                        type: ElementInstanceType.LiveQuiz,
                        elementType: values.type,
                        elementData: {
                          id: '0',
                          elementId: 0,
                          __typename: elementDataTypename,
                          content: values.content,
                          explanation: values.explanation,
                          name: values.name,
                          pointsMultiplier: parseInt(
                            values.pointsMultiplier || '1'
                          ),
                          type: values.type,
                          options: {
                            displayMode: values.options?.displayMode,
                            choices: values.options?.choices,
                            accuracy: parseInt(values.options?.accuracy),
                            unit: values.options?.unit,
                            restrictions: {
                              min: parseFloat(
                                values.options?.restrictions?.min
                              ),
                              max: parseFloat(
                                values.options?.restrictions?.max
                              ),
                              maxLength: parseInt(
                                values.options?.restrictions?.maxLength
                              ),
                            },
                          },
                        },
                      } as ElementInstance
                    }
                    elementIx={0}
                    studentResponse={studentResponse}
                    setStudentResponse={setStudentResponse}
                  />
                </div>
                {values.explanation && (
                  <div className="mt-4">
                    <H3>{t('shared.generic.explanation')}</H3>
                    <Markdown
                      className={{
                        root: 'prose prose-p:!m-0 prose-img:!m-0 leading-6',
                      }}
                      content={values.explanation}
                    />
                  </div>
                )}
                {QUESTION_GROUPS.CHOICES.includes(values.type) &&
                  values.options?.hasAnswerFeedbacks && (
                    <div className="mt-4">
                      <H3>{t('shared.generic.feedbacks')}</H3>
                      {values.options?.choices?.map((choice, index) => (
                        <div
                          key={index}
                          className="border-b pb-1 pt-1 last:border-b-0"
                        >
                          {choice.feedback ? (
                            <Markdown
                              className={{
                                root: 'prose prose-p:!m-0 prose-img:!m-0 leading-6',
                              }}
                              content={choice.feedback}
                            />
                          ) : (
                            t('manage.questionForms.noFeedbackDefined')
                          )}
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            </div>

            {mode === QuestionEditMode.EDIT && (
              <div
                className={twMerge(
                  'mt-3 flex flex-row items-center gap-6 rounded border border-solid p-2',
                  updateInstances && 'border-orange-200 bg-orange-100'
                )}
              >
                <Switch
                  checked={updateInstances}
                  onCheckedChange={() => setUpdateInstances(!updateInstances)}
                />
                <div>
                  <H4 className={{ root: 'm-0' }}>
                    {t('manage.questionForms.updateInstances')}
                  </H4>
                  <Prose className={{ root: 'prose-xs max-w-none' }}>
                    {t('manage.questionForms.updateInstancesExplanation')}
                  </Prose>
                </div>
              </div>
            )}
          </Modal>
        )
      }}
    </Formik>
  )
}

QuestionEditModal.Mode = QuestionEditMode

export default QuestionEditModal
