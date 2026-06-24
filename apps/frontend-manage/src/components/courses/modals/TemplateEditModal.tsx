import { faSave } from '@fortawesome/free-regular-svg-icons'
import { Button, Modal, UserNotification } from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import * as Yup from 'yup'
import { ActivityType } from '../../../lib/constants/activityEnums'
import { trpc, type RouterInputs } from '../../../lib/trpc'
import TemplateFormFields from './TemplateFormFields'

interface TemplateEditModalProps {
  activityId: string
  activityType: ActivityType
  onClose: () => void
  onSuccess: () => void
  onError: () => void
  refetchActivities?: () => Promise<void>
}

function TemplateEditModal({
  activityId,
  activityType,
  onClose,
  onSuccess,
  onError,
  refetchActivities,
}: TemplateEditModalProps) {
  const t = useTranslations()
  const editActivityTemplate = trpc.activity.editTemplate.useMutation()
  const [editSubmitting, setEditSubmitting] = useState(false)
  const editing = editActivityTemplate.isLoading || editSubmitting
  const handleClose = () => {
    if (!editing) {
      onClose()
    }
  }
  const { data, error, isLoading } = trpc.activity.templateInformation.useQuery(
    {
      activityId,
      activityType:
        activityType as RouterInputs['activity']['templateInformation']['activityType'],
    },
    { enabled: Boolean(activityId) }
  )
  const info = data?.templateInformation
  const initialLoading = isLoading && !info
  const infoUnavailable = Boolean((error || !isLoading) && !info)

  return (
    <Modal
      open
      loading={initialLoading}
      title={t('manage.template.editTemplate')}
      onClose={handleClose}
      className={{ content: 'gap-2 pb-2' }}
      data={{ cy: 'edit-template-modal' }}
      dataCloseButton={{ cy: 'close-edit-template-modal' }}
    >
      {infoUnavailable ? (
        <UserNotification
          type="error"
          message={t('shared.generic.systemError')}
        />
      ) : null}

      {info ? (
        <Formik
          validateOnMount
          initialValues={{
            name: info.name,
            description: info.description,
            instructions: info.instructions,
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
          })}
          onSubmit={async (values) => {
            setEditSubmitting(true)
            try {
              const result = await editActivityTemplate.mutateAsync({
                activityId,
                activityType:
                  activityType as RouterInputs['activity']['editTemplate']['activityType'],
                templateId: info.templateId,
                name: values.name,
                description: values.description,
                instructions: values.instructions,
              })

              if (result.editActivityTemplate) {
                await refetchActivities?.()
                onSuccess()
                onClose()
              } else {
                onError()
              }
            } catch (error) {
              console.error(error)
              onError()
            } finally {
              setEditSubmitting(false)
            }
          }}
        >
          {({ isSubmitting, isValid }) => (
            <Form className="flex flex-col gap-2">
              <div>
                <div className="text-gray-600">
                  {t('manage.template.editTemplateDescription')}
                </div>
                <TemplateFormFields />
                <div className="mt-4 flex justify-end">
                  <Button
                    primary
                    type="submit"
                    disabled={!isValid || isSubmitting || editing}
                    loading={isSubmitting || editing}
                    data={{ cy: 'submit-template-edit' }}
                  >
                    <Button.Icon
                      icon={faSave}
                      loading={isSubmitting || editing}
                    />
                    <Button.Label>
                      {t('manage.template.saveChanges')}
                    </Button.Label>
                  </Button>
                </div>
              </div>
            </Form>
          )}
        </Formik>
      ) : null}
    </Modal>
  )
}

export default TemplateEditModal
