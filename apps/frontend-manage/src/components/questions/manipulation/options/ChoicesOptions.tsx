import {
  faArrowDown,
  faArrowUp,
  faTrash,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ElementType } from '@klicker-uzh/graphql/dist/ops'
import { Button, Switch } from '@uzh-bf/design-system'
import {
  FastField,
  FastFieldProps,
  FieldArray,
  FieldArrayRenderProps,
  FieldProps,
  FormikErrors,
} from 'formik'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import ContentInput from '../../../common/ContentInput'
import { QuestionFormTypes, QuestionFormTypesChoices } from '../types'

interface ChoicesOptionsProps {
  values: QuestionFormTypesChoices
  setFieldValue: (
    field: string,
    value: any,
    shouldValidate?: boolean
  ) => Promise<void | FormikErrors<QuestionFormTypes>>
}

function ChoicesOptions({
  values,
  setFieldValue,
}: ChoicesOptionsProps): JSX.Element {
  const t = useTranslations()

  return (
    <FieldArray name="options.choices">
      {({ push, remove, move }: FieldArrayRenderProps) => {
        return (
          <div className="flex w-full flex-col gap-2 pt-2">
            {values.options.choices.map((choice, index: number) => (
              <div
                key={index}
                className={twMerge(
                  'border-uzh-grey-80 w-full rounded',
                  values.options.hasSampleSolution && 'p-2',
                  choice.correct &&
                    values.options.hasSampleSolution &&
                    'border-green-300 bg-green-100',
                  !choice.correct &&
                    values.options.hasSampleSolution &&
                    'border-red-300 bg-red-100'
                )}
              >
                <div className="focus:border-primary-40 flex w-full flex-row items-center">
                  <FastField
                    name={`options.choices.${index}.value`}
                    questionType={values.type}
                    shouldUpdate={(
                      next?: {
                        formik: { values: QuestionFormTypes }
                      },
                      prev?: {
                        formik: { values: QuestionFormTypes }
                      }
                    ) =>
                      (next &&
                        prev &&
                        'options' in next.formik.values &&
                        'options' in prev.formik.values &&
                        next.formik.values.options &&
                        prev.formik.values.options &&
                        'choices' in next.formik.values.options &&
                        'choices' in prev.formik.values.options &&
                        next.formik.values.options.choices[index].value !==
                          prev.formik.values.options.choices[index].value) ||
                      next?.formik.values.type !== prev?.formik.values.type
                    }
                  >
                    {({ field, meta }: FastFieldProps) => (
                      <ContentInput
                        key={`${values.type}-choice-${index}-${values.options.choices.length}-${values.options.choices[index].ix}`}
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
                  {values.options.hasSampleSolution && (
                    <div className="ml-2 flex flex-row items-center">
                      <div className="mr-2">{t('shared.generic.correct')}?</div>
                      <FastField name={`options.choices.${index}.correct`}>
                        {({ field }: FieldProps) => (
                          <Switch
                            checked={field.value || false}
                            label=""
                            className={{
                              root: 'mr-0.5 gap-0',
                            }}
                            onCheckedChange={(newValue: boolean) => {
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
                      <FontAwesomeIcon icon={faArrowUp} className="h-3.5" />
                    </Button>
                    <Button
                      className={{ root: 'px-auto py-0.5' }}
                      disabled={index === values.options.choices.length - 1}
                      onClick={() => move(index, index + 1)}
                      data={{
                        cy: `move-answer-option-ix-${index}-down`,
                      }}
                    >
                      <FontAwesomeIcon icon={faArrowDown} className="h-3.5" />
                    </Button>
                  </div>
                  <Button
                    onClick={() => {
                      // decrement the choice.ix value of all answers after this one
                      values.options.choices
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

                {values.options.hasAnswerFeedbacks &&
                  values.options.hasSampleSolution && (
                    <div className="">
                      <div className="mt-2 text-sm font-bold">
                        {t('shared.generic.feedback')}
                      </div>
                      <FastField
                        name={`options.choices.${index}.feedback`}
                        questionType={values.type}
                        shouldUpdate={(
                          next?: {
                            formik: {
                              values: QuestionFormTypes
                            }
                          },
                          prev?: {
                            formik: {
                              values: QuestionFormTypes
                            }
                          }
                        ) =>
                          (next &&
                            prev &&
                            'options' in next.formik.values &&
                            'options' in prev.formik.values &&
                            next.formik.values.options &&
                            prev.formik.values.options &&
                            'choices' in next.formik.values.options &&
                            'choices' in prev.formik.values.options &&
                            next?.formik.values.options.choices[index]
                              .feedback !==
                              prev?.formik.values.options.choices[index]
                                .feedback) ||
                          next?.formik.values.type !== prev?.formik.values.type
                        }
                      >
                        {({ field, meta }: FastFieldProps) => (
                          <ContentInput
                            key={`${values.type}-feedback-${index}-${values.options.choices[index].ix}`}
                            error={meta.error}
                            touched={meta.touched}
                            content={field.value || '<br>'}
                            onChange={(newContent: string): void => {
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
            ))}

            <Button
              fluid
              className={{
                root: twMerge(
                  'border-uzh-grey-100 border border-solid font-bold',
                  values.type === ElementType.Kprim &&
                    values.options.choices.length >= 4 &&
                    'cursor-not-allowed opacity-50'
                ),
              }}
              disabled={
                values.type === ElementType.Kprim &&
                values.options.choices.length >= 4
              }
              onClick={() =>
                push({
                  ix: values.options.choices[values.options.choices.length - 1]
                    ? values.options.choices[values.options.choices.length - 1]
                        .ix + 1
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
  )
}

export default ChoicesOptions
