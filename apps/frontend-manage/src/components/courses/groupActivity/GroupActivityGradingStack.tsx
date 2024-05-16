import ContentInput from '@components/common/ContentInput'
import { faCheck, faX } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ElementInstance,
  ElementType,
  GroupActivityDecision,
  GroupActivityGrading,
  GroupActivityInstance,
} from '@klicker-uzh/graphql/dist/ops'
import StudentElement from '@klicker-uzh/shared-components/src/StudentElement'
import { Button, FormikNumberField, H2, H3 } from '@uzh-bf/design-system'
import { FastField, FastFieldProps, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import * as Yup from 'yup'

interface GroupActivityGradingStackProps {
  elements: ElementInstance[]
  submission?: GroupActivityInstance
}

function GroupActivityGradingStack({
  elements,
  submission,
}: GroupActivityGradingStackProps) {
  const t = useTranslations()
  const MAX_POINTS_PER_QUESTION = 25

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
      onSubmit={async (values) => {
        console.log(values)
        return null
      }}
    >
      {({ isSubmitting, values, isValid, setFieldValue, submitForm }) => {
        return (
          <div className="flex flex-col gap-8">
            {elements.map((element, ix) => (
              <div key={element.id}>
                <H3 className={{ root: 'border-b border-gray-400' }}>
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
                        onChange={(newValue: string) =>
                          setFieldValue(`grading.${ix}.feedback`, newValue)
                        }
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
            <div>
              <H2>{t('manage.groupActivity.generalFeedback')}</H2>
              <div className="flex flex-row items-center gap-2 mb-3">
                <div className="flex flex-row">
                  {t('manage.groupActivity.didGroupPass')}
                  <div className="mb-1 ml-0.5 mr-2 text-red-600">*</div>
                </div>
                <Button
                  active={values.passed === true}
                  onClick={() => setFieldValue('passed', true)}
                  className={{ active: 'bg-green-500' }}
                >
                  <FontAwesomeIcon icon={faCheck} />
                </Button>
                <Button
                  active={values.passed === false}
                  onClick={() => setFieldValue('passed', false)}
                  className={{ active: 'bg-red-500' }}
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
                    onChange={(newValue: string) =>
                      setFieldValue('content', newValue)
                    }
                    showToolbarOnFocus={false}
                    placeholder={t('manage.groupActivity.optionalFeedback')}
                    data_cy="groupActivity-general-grading-comment"
                    className={{ content: 'max-w-none' }}
                  />
                )}
              </FastField>
            </div>
            <Button
              disabled={!isValid || isSubmitting}
              type="submit"
              className={{
                root: twMerge(
                  '-mt-2 h-10 w-max self-end font-bold bg-primary-80 text-white',
                  !isValid && 'cursor-not-allowed bg-primary-60'
                ),
              }}
              loading={isSubmitting}
              onClick={() => submitForm()}
            >
              {t('manage.groupActivity.saveGrading')}
            </Button>
          </div>
        )
      }}
    </Formik>
  )
}

export default GroupActivityGradingStack
