import { useMutation } from '@apollo/client'
import { faCheck, faX } from '@fortawesome/free-solid-svg-icons'
import {
  ElementData,
  ElementInstance,
  ElementType,
  GradeGroupActivitySubmissionDocument,
  GroupActivityDecision,
  GroupActivityGrading,
  GroupActivityInstance,
  SelectionElementData,
} from '@klicker-uzh/graphql/dist/ops'
import StudentElement, {
  CaseStudyStudentResponseType,
  StackStudentResponseType,
} from '@klicker-uzh/shared-components/src/StudentElement'
import getEmptySelectionResponse from '@klicker-uzh/shared-components/src/utils/getEmptySelectionResponse'
import {
  Button,
  FormLabel,
  FormikNumberField,
  H2,
  H3,
  UserNotification,
  toast,
} from '@uzh-bf/design-system'
import { FastField, FastFieldProps, Formik, useFormikContext } from 'formik'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect } from 'react'
import { twMerge } from 'tailwind-merge'
import * as Yup from 'yup'
import ContentInput from '../../common/ContentInput'

interface GroupActivityGradingStackProps {
  setEdited: (edited: boolean) => void
  elements: ElementInstance[]
  submission?: GroupActivityInstance
  gradingCompleted: boolean
  pointsPerInstance: number
  maxPoints: number
}

function GroupActivityGradingStack({
  setEdited,
  elements,
  submission,
  gradingCompleted,
  pointsPerInstance,
  maxPoints,
}: GroupActivityGradingStackProps) {
  const t = useTranslations()
  const [gradeGroupActivitySubmissions] = useMutation(
    GradeGroupActivitySubmissionDocument
  )

  const EditingDetector = () => {
    const { touched } = useFormikContext()

    useEffect(() => {
      if (Object.keys(touched).length > 0) {
        setEdited(true)
      }
    }, [touched])

    return null
  }

  const results = submission?.results
  const findResponse = useCallback(
    (elementId: number, type: ElementType, elementData: ElementData) => {
      const decision = submission?.decisions?.find(
        (decision: GroupActivityDecision) => decision.instanceId === elementId
      )

      if (!decision) {
        return
      }

      if (type === ElementType.Sc || type === ElementType.Mc) {
        return {
          [elementId]: {
            type: type,
            response: decision.choicesResponse?.reduce(
              (acc: Record<number, boolean>, choice: any) => ({
                ...acc,
                [choice]: true,
              }),
              {}
            ),
            valid: true,
          },
        }
      } else if (type === ElementType.Kprim) {
        const responseObj = Array.from({ length: 4 }, (_, i) => i).reduce<
          Record<number, boolean>
        >((acc, choice) => ({ ...acc, [choice]: false }), {})

        return {
          [elementId]: {
            type: type,
            response: decision.choicesResponse?.reduce(
              (acc: Record<number, boolean>, choice) => ({
                ...acc,
                [choice.ix]: true,
              }),
              responseObj
            ),
            valid: true,
          },
        }
      } else if (type === ElementType.Numerical) {
        return {
          [elementId]: {
            type: type,
            response: decision.numericalResponse,
            valid: true,
          },
        }
      } else if (type === ElementType.FreeText) {
        return {
          [elementId]: {
            type: type,
            response: decision.freeTextResponse,
            valid: true,
          },
        }
      } else if (type === ElementType.Selection) {
        const response = getEmptySelectionResponse({
          numberOfInputs: (elementData as SelectionElementData).options
            .numberOfInputs,
        })
        decision.selectionResponse
          ? decision.selectionResponse.forEach((answerId, ix) => {
              response[ix] = answerId
            })
          : undefined

        return {
          [elementId]: {
            type: type,
            response,
            valid: true,
          },
        }
      } else if (type === ElementType.CaseStudy) {
        const response =
          decision.caseStudyResponse?.reduce<CaseStudyStudentResponseType>(
            (caseAcc, caseItem) => {
              caseAcc[caseItem.caseId] = caseItem.itemResponses.reduce<
                CaseStudyStudentResponseType['']
              >((itemAcc, item) => {
                itemAcc[String(item.itemId)] = item.criterionResponses.reduce<
                  CaseStudyStudentResponseType['']['']
                >((criterionAcc, criterion) => {
                  criterionAcc[criterion.criterionId] = criterion.response
                  return criterionAcc
                }, {})
                return itemAcc
              }, {})
              return caseAcc
            },
            {}
          )

        return {
          [elementId]: {
            type: type,
            response,
            valid: true,
          },
        }
      }
    },
    [submission?.decisions]
  )

  const gradingSchema = Yup.object().shape({
    passed: Yup.boolean().required(
      t('manage.groupActivity.passedMissingError')
    ),
    comment: Yup.string(),
    grading: Yup.array().of(
      Yup.object().shape({
        instanceId: Yup.number().required(),
        score: Yup.number()
          .required(t('manage.groupActivity.scoreMissingError'))
          .min(0, t('manage.groupActivity.scoreMissingError')),
        feedback: Yup.string(),
      })
    ),
  })

  if (!submission) {
    return null
  }

  return (
    <Formik
      key={submission.id}
      isInitialValid={Object.keys(submission.results ?? {}).length > 0}
      enableReinitialize={true}
      initialValues={{
        passed: results?.passed ?? undefined,
        comment: results?.comment ?? undefined,
        grading:
          results?.grading.map((result: GroupActivityGrading) => {
            return {
              instanceId: result.instanceId,
              score: result.score,
              feedback: result.feedback,
            }
          }) ??
          elements.map((element) => ({
            instanceId: element.id,
            score: undefined,
            feedback: undefined,
          })),
      }}
      validationSchema={gradingSchema}
      onSubmit={async (values, { setSubmitting, resetForm }) => {
        setSubmitting(true)
        const result = await gradeGroupActivitySubmissions({
          variables: {
            id: submission.id,
            groupActivityId: submission.groupActivityId,
            gradingDecisions: {
              passed: values.passed!,
              comment: values.comment,
              grading: values.grading.map((res) => ({
                instanceId: res.instanceId,
                score: parseFloat(String(res.score!)),
                feedback: res.feedback,
              })),
            },
          },
        })

        if (result.data?.gradeGroupActivitySubmission?.id) {
          setSubmitting(false)
          resetForm()
          toast({
            type: 'success',
            message: t('manage.groupActivity.stackGradingSuccess'),
            options: { duration: 4000 },
          })
          setEdited(false)
        } else {
          setSubmitting(false)
          toast({
            type: 'error',
            message: t('manage.groupActivity.stackGradingError'),
            options: { duration: 6000 },
          })
        }
      }}
    >
      {({
        isSubmitting,
        values,
        isValid,
        setFieldValue,
        setFieldTouched,
        submitForm,
      }) => {
        return (
          <div className="flex flex-col gap-8">
            {gradingCompleted && (
              <UserNotification
                type="warning"
                message={t('manage.groupActivity.alreadyGraded')}
              />
            )}
            {elements.map((element, ix) => (
              <div key={element.id} className="flex flex-col">
                <H3 className={{ root: 'border-t border-gray-400 pt-2' }}>
                  {element.elementData.name}
                </H3>
                <StudentElement
                  preview
                  element={element}
                  elementIx={ix}
                  studentResponse={
                    (findResponse(
                      element.id,
                      element.elementType,
                      element.elementData
                    ) as StackStudentResponseType) ?? []
                  }
                  setStudentResponse={() => null}
                  hideReadButton
                  disabledInput={true}
                />
                <FastField
                  name={`grading.${ix}.feedback`}
                  shouldUpdate={(next: any, prev: any) =>
                    next?.formik.values.grading[ix].feedback !==
                    prev?.formik.values.grading[ix].feedback
                  }
                >
                  {({ field, meta }: FastFieldProps) => (
                    <div className="mt-2 w-full">
                      <FormLabel
                        label={t('shared.generic.feedback')}
                        labelType="small"
                        required={false}
                        className={{ label: 'text-black' }}
                      />
                      <ContentInput
                        error={meta.error}
                        touched={meta.touched}
                        content={field.value}
                        onChange={(newValue: string) => {
                          setFieldValue(`grading.${ix}.feedback`, newValue)
                          setFieldTouched(`grading.${ix}.feedback`, true)
                        }}
                        disabled={gradingCompleted}
                        showToolbarOnFocus={false}
                        placeholder={t(
                          'manage.groupActivity.optionalQuestionFeedback'
                        )}
                        data={{ cy: `groupActivity-grading-comment-${ix}` }}
                        className={{ content: 'max-w-none' }}
                      />
                    </div>
                  )}
                </FastField>
                <div className="mt-2 flex w-max flex-row items-center justify-end gap-3 self-end">
                  <FormikNumberField
                    hideError
                    required
                    disabled={gradingCompleted}
                    name={`grading.${ix}.score`}
                    label={t('manage.groupActivity.achievedScore')}
                    labelType="large"
                    tooltip={t('manage.groupActivity.maxScoreTooltip')}
                    min={0}
                    max={
                      (element.options?.pointsMultiplier ?? 1) *
                      pointsPerInstance
                    }
                    data={{ cy: `groupActivity-grading-score-${ix}` }}
                    className={{ input: 'w-20' }}
                  />
                  <div className="min-w-max">{`/ ${t(
                    'manage.groupActivity.nPoints',
                    {
                      number:
                        (element.options?.pointsMultiplier ?? 1) *
                        pointsPerInstance,
                    }
                  )}`}</div>
                </div>
              </div>
            ))}
            <div className="self-end border-t border-black pt-2 text-lg font-bold">
              {t('manage.groupActivity.totalAchievedPoints', {
                achieved: values.grading.reduce((acc: number, result) => {
                  return (
                    acc +
                    (String(result.score) === ''
                      ? 0
                      : parseFloat(String(result.score ?? 0)))
                  )
                }, 0),
                total: maxPoints,
              })}
            </div>
            <div className="-mt-4">
              <H2>{t('manage.groupActivity.generalFeedback')}</H2>
              <div className="mb-3 flex flex-row items-center gap-2">
                <div className="flex flex-row">
                  {t('manage.groupActivity.didGroupPass')}
                  <div className="mb-1 ml-0.5 mr-2 text-red-600">*</div>
                </div>
                <Button
                  destructive={values.passed === true}
                  onClick={() => setFieldValue('passed', true)}
                  className={{
                    root: twMerge(
                      values.passed ? 'bg-green-600 hover:bg-green-700' : ''
                    ),
                  }}
                  disabled={gradingCompleted}
                  data={{ cy: 'groupActivity-passed' }}
                >
                  <Button.Icon withoutLabel icon={faCheck} />
                </Button>
                <Button
                  destructive={values.passed === false}
                  onClick={() => setFieldValue('passed', false)}
                  disabled={gradingCompleted}
                  data={{ cy: 'groupActivity-failed' }}
                >
                  <Button.Icon withoutLabel icon={faX} />
                </Button>
              </div>
              <FastField
                name="comment"
                shouldUpdate={(next: any, prev: any) =>
                  next?.formik.values.comment !== prev?.formik.values.comment
                }
              >
                {({ field, meta }: FastFieldProps) => (
                  <ContentInput
                    error={meta.error}
                    touched={meta.touched}
                    content={field.value}
                    onChange={(newValue: string) => {
                      setFieldValue('comment', newValue)
                      setFieldTouched('comment', true)
                    }}
                    disabled={gradingCompleted}
                    showToolbarOnFocus={false}
                    placeholder={t('manage.groupActivity.optionalFeedback')}
                    data={{ cy: 'groupActivity-general-grading-comment' }}
                    className={{ content: 'max-w-none' }}
                  />
                )}
              </FastField>
            </div>
            <Button
              primary
              disabled={!isValid || gradingCompleted}
              type="submit"
              loading={isSubmitting}
              onClick={() => submitForm()}
              className={{ root: 'float-right self-end' }}
              data={{ cy: 'groupActivity-save-submission-grading' }}
            >
              <Button.Label>
                {t('manage.groupActivity.saveGrading')}
              </Button.Label>
            </Button>
            <EditingDetector />
          </div>
        )
      }}
    </Formik>
  )
}

export default GroupActivityGradingStack
