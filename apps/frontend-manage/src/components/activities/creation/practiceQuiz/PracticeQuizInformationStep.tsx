import {
  faBookOpen,
  faLightbulb,
  faUsers,
} from '@fortawesome/free-solid-svg-icons'
import { PracticeQuizMode } from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  FormikTextField,
  Modal,
  ToggleGroup,
  ToggleGroupItem,
  UserNotification,
} from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import CreationFormValidator from '../CreationFormValidator'
import PropertyList from '../PropertyList'
import WizardNavigation from '../WizardNavigation'
import { PracticeQuizWizardStepProps } from './PracticeQuizWizard'
import {
  hasAdaptivePracticeQuizConfiguration,
  hasStandardPracticeQuizContent,
  switchPracticeQuizMode,
} from './adaptivePracticeQuizForm'

function PracticeQuizInformationStep({
  editMode,
  formRef,
  formData,
  continueDisabled,
  activeStep,
  stepValidity,
  validationSchema,
  gamifiedCourses,
  nonGamifiedCourses,
  adaptiveCourses,
  setStepValidity,
  onNextStep,
  onModeChange,
  closeWizard,
}: PracticeQuizWizardStepProps) {
  const t = useTranslations()
  const [pendingMode, setPendingMode] = useState<PracticeQuizMode | null>(null)
  const noCourse =
    gamifiedCourses?.length === 0 && nonGamifiedCourses?.length === 0
  const adaptiveUnavailable = adaptiveCourses?.length === 0

  return (
    <Formik
      validateOnMount
      initialValues={formData}
      onSubmit={onNextStep!}
      innerRef={formRef}
      validationSchema={validationSchema}
    >
      {({ values, isValid, isSubmitting, setValues }) => (
        <Form className="h-full w-full">
          <CreationFormValidator
            isValid={isValid}
            activeStep={activeStep}
            setStepValidity={setStepValidity}
          />
          <div className="flex h-full w-full flex-col justify-between gap-1">
            <div className="flex flex-row">
              <div className="w-full md:w-1/2">
                {noCourse ? (
                  <UserNotification
                    type="error"
                    message={t('manage.activityWizard.practiceQuizNoCourse')}
                    className={{ root: 'mb-2' }}
                  />
                ) : null}
                <div className="w-full md:pr-14">
                  {t('manage.activityWizard.practiceQuizIntroductionName')}
                </div>
                <FormikTextField
                  required
                  autoComplete="off"
                  name="name"
                  label={t('manage.activityWizard.name')}
                  tooltip={t('manage.activityWizard.practiceQuizName')}
                  className={{
                    root: 'mb-2 md:w-96',
                    tooltip: 'z-20',
                  }}
                  data-cy="insert-practice-quiz-name"
                />
                <div className="mt-4 w-full md:w-96">
                  <div className="mb-1 text-sm font-bold">
                    {t('manage.activityWizard.adaptive.mode.label')}
                  </div>
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    value={values.mode}
                    aria-label={t('manage.activityWizard.adaptive.mode.label')}
                    data-cy="practice-quiz-mode"
                    className="w-full"
                    onValueChange={(value) => {
                      if (!value || value === values.mode) return

                      const nextMode = value as PracticeQuizMode
                      const needsConfirmation =
                        values.mode === PracticeQuizMode.Standard
                          ? hasStandardPracticeQuizContent(values)
                          : hasAdaptivePracticeQuizConfiguration(values)

                      if (needsConfirmation) {
                        setPendingMode(nextMode)
                        return
                      }

                      const nextValues = switchPracticeQuizMode(
                        values,
                        nextMode
                      )
                      void setValues(nextValues, true)
                      onModeChange?.(nextValues)
                    }}
                  >
                    <ToggleGroupItem
                      type="button"
                      value={PracticeQuizMode.Standard}
                      aria-label={t(
                        'manage.activityWizard.adaptive.mode.standard'
                      )}
                      data-cy="practice-quiz-mode-standard"
                      className="data-[state=on]:bg-uzh-blue-100 h-9 data-[state=on]:text-white"
                    >
                      {t('manage.activityWizard.adaptive.mode.standard')}
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      type="button"
                      value={PracticeQuizMode.Adaptive}
                      disabled={
                        adaptiveUnavailable &&
                        values.mode !== PracticeQuizMode.Adaptive
                      }
                      aria-label={t(
                        'manage.activityWizard.adaptive.mode.adaptive'
                      )}
                      data-cy="practice-quiz-mode-adaptive"
                      className="data-[state=on]:bg-uzh-blue-100 h-9 data-[state=on]:text-white"
                    >
                      {t('manage.activityWizard.adaptive.mode.adaptive')}
                    </ToggleGroupItem>
                  </ToggleGroup>
                  {adaptiveUnavailable ? (
                    <UserNotification
                      type="info"
                      message={t(
                        'manage.activityWizard.adaptive.mode.rolloutUnavailable'
                      )}
                      className={{ root: 'mt-2' }}
                      data={{ cy: 'adaptive-mode-rollout-unavailable' }}
                    />
                  ) : null}
                  <div
                    className="border-uzh-grey-80 mt-2 border-l-2 pl-2 text-sm"
                    data-cy="practice-quiz-mode-description"
                  >
                    {values.mode === PracticeQuizMode.Adaptive
                      ? t(
                          'manage.activityWizard.adaptive.mode.adaptiveDescription'
                        )
                      : t(
                          'manage.activityWizard.adaptive.mode.standardDescription'
                        )}
                  </div>
                </div>
              </div>
              <div className="border-uzh-grey-80 bg-uzh-grey-20 ml-1 hidden h-max w-1/2 flex-col gap-2 rounded-md border border-solid p-3 md:flex">
                <PropertyList
                  elements={[
                    {
                      icon: faLightbulb,
                      iconColor: 'text-orange-400',
                      richText: t.rich(
                        'manage.activityWizard.practiceQuizUseCase',
                        {
                          link: (text) => (
                            <a
                              href="https://www.klicker.uzh.ch/use_cases/practice_quiz/"
                              target="_blank"
                              className="underline"
                            >
                              {text}
                            </a>
                          ),
                        }
                      ),
                    },
                    {
                      icon: faBookOpen,
                      iconColor: 'text-uzh-blue-100',
                      richText: t.rich(
                        'manage.activityWizard.practiceQuizLecturerDocs',
                        {
                          link: (text) => (
                            <a
                              href="https://www.klicker.uzh.ch/tutorials/practice_quiz/"
                              target="_blank"
                              className="underline"
                            >
                              {text}
                            </a>
                          ),
                        }
                      ),
                    },
                    {
                      icon: faUsers,
                      iconColor: 'text-black',
                      richText: t.rich(
                        'manage.activityWizard.practiceQuizStudentDocs',
                        {
                          link: (text) => (
                            <a
                              href="https://www.klicker.uzh.ch/student_tutorials/practice_quiz/"
                              target="_blank"
                              className="underline"
                            >
                              {text}
                            </a>
                          ),
                        }
                      ),
                    },
                  ]}
                />
              </div>
            </div>
            <WizardNavigation
              editMode={editMode}
              isSubmitting={isSubmitting}
              stepValidity={stepValidity}
              activeStep={activeStep}
              lastStep={activeStep === stepValidity.length - 1}
              continueDisabled={continueDisabled}
              onCloseWizard={closeWizard}
            />
          </div>
          {pendingMode ? (
            <ModeChangeConfirmation
              mode={pendingMode}
              onCancel={() => setPendingMode(null)}
              onConfirm={() => {
                const nextValues = switchPracticeQuizMode(values, pendingMode)
                void setValues(nextValues, true)
                onModeChange?.(nextValues)
                setPendingMode(null)
              }}
            />
          ) : null}
        </Form>
      )}
    </Formik>
  )
}

function ModeChangeConfirmation({
  mode,
  onCancel,
  onConfirm,
}: {
  mode: PracticeQuizMode
  onCancel: () => void
  onConfirm: () => void
}) {
  const t = useTranslations()

  return (
    <Modal
      open
      title={t('manage.activityWizard.adaptive.mode.confirmTitle')}
      onClose={onCancel}
      dataCloseButton={{ cy: 'cancel-practice-quiz-mode-change' }}
      className={{ content: 'max-w-lg' }}
    >
      <div className="flex flex-col gap-4">
        <p>
          {t('manage.activityWizard.adaptive.mode.confirmDescription', {
            mode: t(
              mode === PracticeQuizMode.Adaptive
                ? 'manage.activityWizard.adaptive.mode.adaptive'
                : 'manage.activityWizard.adaptive.mode.standard'
            ),
          })}
        </p>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            onClick={onCancel}
            data={{ cy: 'keep-practice-quiz-mode' }}
          >
            <Button.Label>{t('shared.generic.cancel')}</Button.Label>
          </Button>
          <Button
            destructive
            type="button"
            onClick={onConfirm}
            data={{ cy: 'confirm-practice-quiz-mode-change' }}
          >
            <Button.Label>
              {t('manage.activityWizard.adaptive.mode.confirmAction')}
            </Button.Label>
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default PracticeQuizInformationStep
