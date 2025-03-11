import { faCopy, faSave } from '@fortawesome/free-regular-svg-icons'
import {
  faArrowLeft,
  faArrowRight,
  faArrowsRotate,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ActivityType } from '@klicker-uzh/graphql/dist/ops'
import { Button, FormLabel, Modal } from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import * as Yup from 'yup'
import EditorField from '../../activities/creation/EditorField'
import ConfirmationItem from '../../common/ConfirmationItem'

interface TemplateConversionModalProps {
  open: boolean
  setOpen: (open: boolean) => void
  activityId: string
  activityType: ActivityType
}

function TemplateConversionModal({
  open,
  setOpen,
  activityId,
  activityType,
}: TemplateConversionModalProps) {
  const t = useTranslations()
  const [currentStep, setCurrentStep] = useState(0)

  return (
    <Modal
      title={t('manage.template.convertToTemplate', {
        activityType: t(`shared.types.${activityType}`),
      })}
      open={open}
      onClose={() => {
        setOpen(false)
        setCurrentStep(0)
      }}
    >
      <Formik
        validateOnMount
        initialValues={{
          description: '',
          instructions: '',
          conversionType: null as 'convert' | 'copy' | null,
          confirmations: {
            contentVisibility: false,
            questionAccess: false,
            resourceAccess: false,
          },
        }}
        validationSchema={Yup.object().shape({
          description: Yup.string()
            .required(t('manage.template.descriptionRequired'))
            .test({
              message: t('manage.template.descriptionRequired'),
              test: (description) =>
                !description?.match(/^(<br>(\n)*)$/g) && description !== '',
            }),
          instructions: Yup.string()
            .required(t('manage.template.instructionsRequired'))
            .test({
              message: t('manage.template.instructionsRequired'),
              test: (description) =>
                !description?.match(/^(<br>(\n)*)$/g) && description !== '',
            }),
          conversionType: Yup.mixed().oneOf(['convert', 'copy']).required(),
          confirmations: Yup.object().shape({
            contentVisibility: Yup.boolean().oneOf([true]),
            questionAccess: Yup.boolean().oneOf([true]),
            resourceAccess: Yup.boolean().oneOf([true]),
          }),
        })}
        onSubmit={async (values) => {
          // TODO: handle form submission
          console.log(values)

          // TODO: error and success handling with toasts
          setOpen(false)
          setCurrentStep(0)
        }}
      >
        {({ isSubmitting, isValid, values, setFieldValue }) => (
          <Form className="flex flex-col gap-2">
            {currentStep === 0 && (
              <div>
                <FormLabel
                  required
                  labelType="small"
                  label={t('manage.template.conversionType')}
                  className={{ label: 'text-lg' }}
                />
                <div className="mb-2 rounded border p-2 text-sm text-gray-600">
                  {t('manage.template.convertCopyTemplateInfo')}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    primary={values.conversionType === 'convert'}
                    onClick={() => setFieldValue('conversionType', 'convert')}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <FontAwesomeIcon icon={faArrowsRotate} />
                      <span>{t('manage.template.convertOption')}</span>
                    </div>
                  </Button>
                  <Button
                    primary={values.conversionType === 'copy'}
                    onClick={() => setFieldValue('conversionType', 'copy')}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <FontAwesomeIcon icon={faCopy} />
                      <span>{t('manage.template.copyOption')}</span>
                    </div>
                  </Button>
                </div>

                {values.conversionType !== null && (
                  <>
                    <FormLabel
                      required
                      labelType="small"
                      label={t('manage.template.confirmationsTitle')}
                      className={{ label: 'mb-2 mt-6 text-lg' }}
                    />
                    <div className="flex flex-col gap-2">
                      <ConfirmationItem
                        label={t('manage.template.confirmContentVisibility')}
                        onClick={() => {
                          setFieldValue('confirmations.contentVisibility', true)
                        }}
                        confirmed={values.confirmations.contentVisibility}
                        notApplicable={false}
                        confirmationType="confirm"
                        data={{ cy: 'confirm-content-visibility' }}
                      />
                      <ConfirmationItem
                        label={t('manage.template.confirmQuestionAccess')}
                        onClick={() => {
                          setFieldValue('confirmations.questionAccess', true)
                        }}
                        confirmed={values.confirmations.questionAccess}
                        notApplicable={false}
                        confirmationType="confirm"
                        data={{ cy: 'confirm-question-access' }}
                      />
                      <ConfirmationItem
                        label={t('manage.template.confirmResourceAccess')}
                        onClick={() => {
                          setFieldValue('confirmations.resourceAccess', true)
                        }}
                        confirmed={values.confirmations.resourceAccess}
                        notApplicable={false}
                        confirmationType="confirm"
                        data={{ cy: 'confirm-resource-access' }}
                      />
                    </div>

                    <div className="mt-4 flex justify-end">
                      <Button
                        onClick={() => setCurrentStep(1)}
                        disabled={
                          !Object.values(values.confirmations).every(
                            (value) => value === true
                          )
                        }
                        data={{ cy: 'template-next-step' }}
                        className={{ root: 'gap-2' }}
                      >
                        <Button.Label>
                          {t('shared.generic.continue')}
                        </Button.Label>
                        <FontAwesomeIcon icon={faArrowRight} />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}

            {currentStep === 1 && (
              <div>
                <div className="text-gray-600">
                  {t('manage.template.templateInformationDescription')}
                </div>
                <EditorField
                  required
                  fieldName="description"
                  label={t('shared.generic.description')}
                  placeholder={t('manage.template.descriptionPlaceholder')}
                  tooltip={t('manage.template.descriptionTooltip')}
                />
                <EditorField
                  required
                  fieldName="instructions"
                  label={t('shared.generic.instructions')}
                  placeholder={t('manage.template.instructionsPlaceholder')}
                  tooltip={t('manage.template.instructionsTooltip')}
                />
                <div className="mt-4 flex justify-between">
                  <Button onClick={() => setCurrentStep(0)}>
                    <Button.Icon icon={faArrowLeft} />
                    <Button.Label>{t('shared.generic.back')}</Button.Label>
                  </Button>
                  <Button
                    primary
                    type="submit"
                    disabled={isSubmitting || !isValid}
                    data={{ cy: 'submit-template-conversion' }}
                  >
                    <Button.Icon icon={faSave} />
                    <Button.Label>
                      {t('manage.template.createTemplate')}
                    </Button.Label>
                  </Button>
                </div>
              </div>
            )}
          </Form>
        )}
      </Formik>
    </Modal>
  )
}

export default TemplateConversionModal
