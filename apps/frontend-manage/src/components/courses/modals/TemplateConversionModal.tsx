import { useMutation, useQuery } from '@apollo/client'
import { faCopy, faSave } from '@fortawesome/free-regular-svg-icons'
import {
  faArrowLeft,
  faArrowRight,
  faArrowsRotate,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ActivityType,
  CheckTemplateInfoAvailableDocument,
  CreateActivityTemplateDocument,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  FormLabel,
  Modal,
  UserNotification,
} from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'
import * as Yup from 'yup'
import ConfirmationItem from '../../common/ConfirmationItem'
import ConversionTypeMonitor from './ConversionTypeMonitor'
import TemplateFormFields from './TemplateFormFields'

interface TemplateConversionModalProps {
  onClose: () => void
  activityId: string
  activityType: ActivityType
  onSuccess: () => void
  onError: () => void
  refetchActivities?: () => Promise<void>
}

function TemplateConversionModal({
  onClose,
  activityId,
  activityType,
  onSuccess,
  onError,
  refetchActivities,
}: TemplateConversionModalProps) {
  const t = useTranslations()
  const [currentStep, setCurrentStep] = useState(0)
  const [confirmations, setConfirmations] = useState({
    activityConversion: false,
    contentVisibility: false,
    questionAccess: false,
    resourceAccess: false,
  })
  const setActivityConversionConfirmation = useCallback((value: boolean) => {
    setConfirmations((prev) => ({
      ...prev,
      activityConversion: value,
    }))
  }, [])

  // query if any question in the activity requires additional resources and if these exist
  const { data, loading } = useQuery(CheckTemplateInfoAvailableDocument, {
    variables: {
      activityId,
      activityType,
    },
    skip: !open,
    fetchPolicy: 'cache-and-network',
  })
  const templateInfo = data?.checkTemplateInfoAvailable

  // mutation for template creation
  const [createActivityTemplate] = useMutation(CreateActivityTemplateDocument)

  // set corresponding confirmation to true if no resources are required
  useEffect(() => {
    if (templateInfo?.noResourcesRequired) {
      setConfirmations((prev) => ({
        ...prev,
        resourceAccess: true,
      }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateInfo])

  const handleModalClose = () => {
    onClose()
    setCurrentStep(0)
    setConfirmations({
      activityConversion: false,
      contentVisibility: false,
      questionAccess: false,
      resourceAccess: false,
    })
  }

  return (
    <Modal
      open
      escapeDisabled
      loading={loading}
      title={t('manage.template.convertToTemplate', {
        activityType: t(`shared.types.${activityType}`),
      })}
      onClose={handleModalClose}
      className={{ content: 'lg:w-220 gap-2 pb-2' }}
      dataCloseButton={{ cy: 'close-template-conversion-modal' }}
    >
      <Formik
        validateOnMount
        initialValues={{
          name: '',
          description: '',
          instructions: '',
          conversionType: null as 'convert' | 'copy' | null,
        }}
        validationSchema={Yup.object().shape({
          name: Yup.string().required(t('manage.template.nameRequired')),
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
        })}
        onSubmit={async (values) => {
          try {
            const result = await createActivityTemplate({
              variables: {
                activityId,
                activityType,
                templateName: values.name,
                templateDescription: values.description,
                templateInstructions: values.instructions,
                copyBeforeConversion: values.conversionType === 'copy',
              },
            })

            if (result.data?.createActivityTemplate) {
              await refetchActivities?.()
              onSuccess()
              handleModalClose()
            } else {
              onError()
            }
          } catch (error) {
            console.error(error)
            onError()
          }
        }}
      >
        {({ isSubmitting, isValid, values, setFieldValue }) => {
          if (templateInfo?.noInstances) {
            return (
              <UserNotification type="error">
                {t('manage.template.noInstances')}
              </UserNotification>
            )
          }

          if (templateInfo?.resourcesRequiredMissing) {
            return (
              <UserNotification type="error">
                {t('manage.template.resourcesRequiredMissing')}
              </UserNotification>
            )
          }

          return (
            <Form className="flex flex-col gap-2">
              <ConversionTypeMonitor
                conversionType={values.conversionType}
                setConversionConfirmation={setActivityConversionConfirmation}
              />
              {currentStep === 0 && (
                <div>
                  <FormLabel
                    required
                    labelType="small"
                    label={t('manage.template.conversionType')}
                    className={{ label: 'text-lg' }}
                  />
                  <div className="mb-3 text-sm text-gray-600">
                    {t('manage.template.convertCopyTemplateInfo')}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      active={values.conversionType === 'convert'}
                      onClick={() => setFieldValue('conversionType', 'convert')}
                      data={{ cy: 'convert-option-template' }}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <FontAwesomeIcon icon={faArrowsRotate} />
                        <span>{t('manage.template.convertOption')}</span>
                      </div>
                    </Button>
                    <Button
                      active={values.conversionType === 'copy'}
                      onClick={() => setFieldValue('conversionType', 'copy')}
                      data={{ cy: 'copy-option-template' }}
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
                          label={
                            values.conversionType === 'copy'
                              ? t('manage.template.activityRemainsAvailable')
                              : t('manage.template.confirmActivityConversion')
                          }
                          onClick={() => {
                            setConfirmations((prev) => ({
                              ...prev,
                              activityConversion: true,
                            }))
                          }}
                          confirmed={confirmations.activityConversion}
                          notApplicable={values.conversionType === 'copy'}
                          confirmationType="confirm"
                          data={{ cy: 'confirm-activity-unavailability' }}
                        />
                        <ConfirmationItem
                          label={t('manage.template.confirmContentVisibility')}
                          onClick={() => {
                            setConfirmations((prev) => ({
                              ...prev,
                              contentVisibility: true,
                            }))
                          }}
                          confirmed={confirmations.contentVisibility}
                          notApplicable={false}
                          confirmationType="confirm"
                          data={{ cy: 'confirm-content-visibility' }}
                        />
                        <ConfirmationItem
                          label={t('manage.template.confirmQuestionAccess')}
                          onClick={() => {
                            setConfirmations((prev) => ({
                              ...prev,
                              questionAccess: true,
                            }))
                          }}
                          confirmed={confirmations.questionAccess}
                          notApplicable={false}
                          confirmationType="confirm"
                          data={{ cy: 'confirm-question-access' }}
                        />
                        <ConfirmationItem
                          label={
                            templateInfo?.noResourcesRequired
                              ? t('manage.template.noResourceAccessRequired')
                              : t('manage.template.confirmResourceAccess')
                          }
                          onClick={() => {
                            setConfirmations((prev) => ({
                              ...prev,
                              resourceAccess: true,
                            }))
                          }}
                          confirmed={confirmations.resourceAccess}
                          notApplicable={
                            templateInfo?.noResourcesRequired ?? false
                          }
                          confirmationType="confirm"
                          data={{ cy: 'confirm-resource-access' }}
                        />
                      </div>

                      <div className="mt-4 flex justify-end">
                        <Button
                          onClick={() => setCurrentStep(1)}
                          disabled={
                            !Object.values(confirmations).every(
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
                  <div className="text-sm text-gray-600">
                    {t('manage.template.templateInformationDescription')}
                  </div>

                  <TemplateFormFields />

                  <div className="mt-4 flex justify-between">
                    <Button onClick={() => setCurrentStep(0)}>
                      <Button.Icon icon={faArrowLeft} />
                      <Button.Label>{t('shared.generic.back')}</Button.Label>
                    </Button>
                    <Button
                      primary
                      type="submit"
                      disabled={!isValid}
                      loading={isSubmitting}
                      data={{ cy: 'submit-template-creation' }}
                    >
                      <Button.Icon icon={faSave} loading={isSubmitting} />
                      <Button.Label>
                        {t('manage.template.createTemplate')}
                      </Button.Label>
                    </Button>
                  </div>
                </div>
              )}
            </Form>
          )
        }}
      </Formik>
    </Modal>
  )
}

export default TemplateConversionModal
