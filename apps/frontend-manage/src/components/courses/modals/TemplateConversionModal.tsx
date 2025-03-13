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
  GetUserLiveQuizzesDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import {
  Button,
  FormLabel,
  Modal,
  UserNotification,
} from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import * as Yup from 'yup'
import ConfirmationItem from '../../common/ConfirmationItem'
import TemplateFormFields from './TemplateFormFields'

interface TemplateConversionModalProps {
  open: boolean
  setOpen: (open: boolean) => void
  activityId: string
  activityType: ActivityType
  onSuccess: () => void
  onError: () => void
}

function TemplateConversionModal({
  open,
  setOpen,
  activityId,
  activityType,
  onSuccess,
  onError,
}: TemplateConversionModalProps) {
  const t = useTranslations()
  const [currentStep, setCurrentStep] = useState(0)
  const [confirmations, setConfirmations] = useState({
    contentVisibility: false,
    questionAccess: false,
    resourceAccess: false,
  })

  // query if any question in the activity requires additional resources and if these exist
  const { data, loading } = useQuery(CheckTemplateInfoAvailableDocument, {
    variables: {
      activityId,
      activityType,
    },
    skip: !open,
  })
  const templateInfo = data?.checkTemplateInfoAvailable

  // mutation for template creation
  const [createActivityTemplate] = useMutation(CreateActivityTemplateDocument)

  useEffect(() => {
    if (templateInfo?.noResourcesRequired) {
      setConfirmations({
        ...confirmations,
        resourceAccess: true,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateInfo])

  const handleModalClose = () => {
    setOpen(false)
    setCurrentStep(0)
    setConfirmations({
      contentVisibility: false,
      questionAccess: false,
      resourceAccess: false,
    })
  }

  return (
    <Modal
      escapeDisabled
      title={t('manage.template.convertToTemplate', {
        activityType: t(`shared.types.${activityType}`),
      })}
      open={open}
      onClose={handleModalClose}
      className={{ content: 'gap-2' }}
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
              refetchQueries: [GetUserLiveQuizzesDocument],
            })

            if (result.data?.createActivityTemplate) {
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
          if (loading) {
            return <Loader />
          }

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
                  <div className="text-gray-600">
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
          )
        }}
      </Formik>
    </Modal>
  )
}

export default TemplateConversionModal
