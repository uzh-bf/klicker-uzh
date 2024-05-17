import { useMutation } from '@apollo/client'
import ContentInput from '@components/common/ContentInput'
import { faCheck, faX } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ElementInstance,
  ElementType,
  GradeGroupActivitySubmissionDocument,
  GroupActivityDecision,
  GroupActivityGrading,
  GroupActivityInstance,
} from '@klicker-uzh/graphql/dist/ops'
import StudentElement from '@klicker-uzh/shared-components/src/StudentElement'
import {
  Button,
  FormikNumberField,
  H2,
  H3,
  Toast,
  UserNotification,
} from '@uzh-bf/design-system'
import { FastField, FastFieldProps, Formik, useFormikContext } from 'formik'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import * as Yup from 'yup'

interface GroupActivityGradingStackProps {
  setEdited: (edited: boolean) => void
  elements: ElementInstance[]
  submission?: GroupActivityInstance
  gradingCompleted: boolean
}

function GroupActivityGradingStack({
  setEdited,
  elements,
  submission,
  gradingCompleted,
}: GroupActivityGradingStackProps) {
  const t = useTranslations()
  const MAX_POINTS_PER_QUESTION = 25

  const [successToast, setSuccessToast] = useState(false)
  const [errorToast, setErrorToast] = useState(false)

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

  const maxPoints = useMemo(() => {
    return elements.reduce((acc, element) => {
      return (
        acc + (element.options?.pointsMultiplier || 1) * MAX_POINTS_PER_QUESTION
      )
    }, 0)
  }, [elements])

  if (!submission) {
    return <div></div>
  }

  const results = submission.results
  const findResponse = (elementId: number, type: ElementType) => {
    const decision = submission.decisions.find(
      (decision: GroupActivityDecision) => decision.instanceId === elementId
    )

    if (type === ElementType.FreeText) {
      return {
        [elementId]: {
          type: type,
          response: decision?.freeTextResponse,
          valid: true,
        },
      }
    } else if (type === ElementType.Sc || type === ElementType.Mc) {
      return {
        [elementId]: {
          type: type,
          response: decision?.choicesResponse,
          valid: true,
        },
      }
    } else if (type === ElementType.Kprim) {
      const responseObj = Array.from({ length: 4 }, (_, i) => i).reduce(
        (acc, choice) => ({ ...acc, [choice]: false }),
        {} as Record<number, boolean>
      )

      return {
        [elementId]: {
          type: type,
          response: decision.choicesResponse?.reduce(
            (acc: Record<number, boolean>, choice: number) => ({
              ...acc,
              [choice]: true,
            }),
            responseObj as Record<number, boolean>
          ),
          valid: true,
        },
      }
    } else if (type === ElementType.Numerical) {
      return {
        [elementId]: {
          type: type,
          response: decision?.numericalResponse,
          valid: true,
        },
      }
    }
  }

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
      onSubmit={async (values, { setSubmitting, resetForm, setTouched }) => {
        setSubmitting(true)
        const result = await gradeGroupActivitySubmissions({
          variables: {
            id: submission.id,
            gradingDecisions: {
              passed: values.passed,
              comment: values.comment,
              grading: values.grading.map(
                (res: {
                  instanceId: number
                  score: number
                  feedback?: string
                }) => ({
                  instanceId: res.instanceId,
                  score: parseFloat(String(res.score)),
                  feedback: res.feedback,
                })
              ),
            },
          },
        })

        if (result.data?.gradeGroupActivitySubmission?.id) {
          setSubmitting(false)
          resetForm()
          setSuccessToast(true)
          setEdited(false)
        } else {
          setSubmitting(false)
          setErrorToast(true)
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
              <div key={element.id}>
                <H3 className={{ root: 'border-t pt-2 -mb-2 border-gray-400' }}>
                  {element.elementData.name}
                </H3>
                <StudentElement
                  element={element}
                  elementIx={ix}
                  studentResponse={
                    findResponse(element.id, element.elementType) ?? []
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
                    <>
                      <div className="font-bold mt-2">
                        {t('shared.generic.feedback')}
                      </div>
                      <ContentInput
                        error={meta.error}
                        touched={meta.touched}
                        content={field.value || '<br>'}
                        onChange={(newValue: string) => {
                          setFieldValue(`grading.${ix}.feedback`, newValue)
                          setFieldTouched(`grading.${ix}.feedback`, true)
                        }}
                        disabled={gradingCompleted}
                        showToolbarOnFocus={false}
                        placeholder={t(
                          'manage.groupActivity.optionalQuestionFeedback'
                        )}
                        data_cy={`groupActivity-grading-comment-${ix}`}
                        className={{ content: 'max-w-none' }}
                      />
                    </>
                  )}
                </FastField>
                <div className="flex flex-row items-center gap-3 mt-2 justify-end">
                  <FormikNumberField
                    hideError
                    required
                    disabled={gradingCompleted}
                    name={`grading.${ix}.score`}
                    label={t('manage.groupActivity.achievedScore')}
                    tooltip={t('manage.groupActivity.maxScoreTooltip')}
                    min={0}
                    max={
                      (element.options?.pointsMultiplier || 1) *
                      MAX_POINTS_PER_QUESTION
                    }
                    data={{ cy: `grading-${element.id}-score` }}
                    className={{ numberField: { input: 'w-20' } }}
                  />
                  <div>{`/ ${t('manage.groupActivity.nPoints', {
                    number:
                      (element.options?.pointsMultiplier || 1) *
                      MAX_POINTS_PER_QUESTION,
                  })}`}</div>
                </div>
              </div>
            ))}
            <div className="border-t border-black pt-2 self-end font-bold text-lg">
              {t('manage.groupActivity.totalAchievedPoints', {
                achieved: values.grading.reduce(
                  (
                    acc: number,
                    result: {
                      instanceId: number
                      score: number
                      feedback?: string
                    }
                  ) => {
                    return (
                      acc +
                      (String(result.score) === ''
                        ? 0
                        : parseFloat(String(result.score ?? 0)))
                    )
                  },
                  0
                ),
                total: maxPoints,
              })}
            </div>
            <div className="-mt-4">
              <H2>{t('manage.groupActivity.generalFeedback')}</H2>
              <div className="flex flex-row items-center gap-2 mb-3">
                <div className="flex flex-row">
                  {t('manage.groupActivity.didGroupPass')}
                  <div className="mb-1 ml-0.5 mr-2 text-red-600">*</div>
                </div>
                <Button
                  active={values.passed === true}
                  onClick={() => setFieldValue('passed', true)}
                  className={{ root: 'text-black', active: 'bg-green-500' }}
                  disabled={gradingCompleted}
                >
                  <FontAwesomeIcon icon={faCheck} />
                </Button>
                <Button
                  active={values.passed === false}
                  onClick={() => setFieldValue('passed', false)}
                  className={{ root: 'text-black', active: 'bg-red-500' }}
                  disabled={gradingCompleted}
                >
                  <FontAwesomeIcon icon={faX} />
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
                    content={field.value || '<br>'}
                    onChange={(newValue: string) => {
                      setFieldValue('comment', newValue)
                      setFieldTouched('comment', true)
                    }}
                    disabled={gradingCompleted}
                    showToolbarOnFocus={false}
                    placeholder={t('manage.groupActivity.optionalFeedback')}
                    data_cy="groupActivity-general-grading-comment"
                    className={{ content: 'max-w-none' }}
                  />
                )}
              </FastField>
            </div>
            <Button
              disabled={!isValid || isSubmitting || gradingCompleted}
              type="submit"
              className={{
                root: twMerge(
                  '-mt-2 h-10 w-max self-end font-bold bg-primary-80 text-white',
                  (!isValid || gradingCompleted) &&
                    'cursor-not-allowed bg-primary-60'
                ),
              }}
              loading={isSubmitting}
              onClick={() => submitForm()}
            >
              {t('manage.groupActivity.saveGrading')}
            </Button>
            <EditingDetector />
            <Toast
              openExternal={successToast}
              setOpenExternal={setSuccessToast}
              type="success"
              duration={4000}
            >
              {t('manage.groupActivity.stackGradingSuccess')}
            </Toast>
            <Toast
              openExternal={errorToast}
              setOpenExternal={setErrorToast}
              type="error"
              duration={6000}
            >
              {t('manage.groupActivity.stackGradingError')}
            </Toast>
          </div>
        )
      }}
    </Formik>
  )
}

export default GroupActivityGradingStack
