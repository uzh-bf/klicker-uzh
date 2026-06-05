import { faSave } from '@fortawesome/free-regular-svg-icons'
import { ActivityType } from '@klicker-uzh/graphql/dist/ops'
import { ActivityType as ApiActivityType } from '@klicker-uzh/types'
import { Button, Modal } from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import * as Yup from 'yup'
import { trpc } from '../../../lib/trpc'
import TemplateFormFields from './TemplateFormFields'

interface TemplateEditModalProps {
  activityId: string
  activityType: ActivityType
  onClose: () => void
  onSuccess: () => void
  onError: () => void
  refetchActivities?: () => Promise<void>
}

const trpcActivityTypeByGraphqlActivityType = {
  [ActivityType.GroupActivity]: ApiActivityType.GROUP_ACTIVITY,
  [ActivityType.LiveQuiz]: ApiActivityType.LIVE_QUIZ,
  [ActivityType.MicroLearning]: ApiActivityType.MICRO_LEARNING,
  [ActivityType.PracticeQuiz]: ApiActivityType.PRACTICE_QUIZ,
} satisfies Record<ActivityType, ApiActivityType>

function TemplateEditModal({
  activityId,
  activityType,
  onClose,
  onSuccess,
  onError,
  refetchActivities,
}: TemplateEditModalProps) {
  const t = useTranslations()
  const trpcActivityType = trpcActivityTypeByGraphqlActivityType[activityType]
  const editActivityTemplate = trpc.activity.editTemplate.useMutation()
  const { data, isLoading } = trpc.activity.templateInformation.useQuery(
    {
      activityId,
      activityType: trpcActivityType,
    },
    { enabled: Boolean(activityId) }
  )
  const info = data?.templateInformation

  return (
    <Modal
      open
      loading={isLoading || !info}
      title={t('manage.template.editTemplate')}
      onClose={onClose}
      className={{ content: 'gap-2 pb-2' }}
      data={{ cy: 'edit-template-modal' }}
      dataCloseButton={{ cy: 'close-edit-template-modal' }}
    >
      {info && (
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
            try {
              const result = await editActivityTemplate.mutateAsync({
                activityId,
                activityType: trpcActivityType,
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
                    disabled={!isValid}
                    loading={isSubmitting}
                    data={{ cy: 'submit-template-edit' }}
                  >
                    <Button.Icon icon={faSave} loading={isSubmitting} />
                    <Button.Label>
                      {t('manage.template.saveChanges')}
                    </Button.Label>
                  </Button>
                </div>
              </div>
            </Form>
          )}
        </Formik>
      )}
    </Modal>
  )
}

export default TemplateEditModal
