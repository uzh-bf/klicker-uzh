import { ActivityType } from '@klicker-uzh/types'
import {
  Button,
  FormikDatetimePicker,
  Modal,
  toast,
} from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import * as Yup from 'yup'
import { trpc } from '../../../lib/trpc'

interface ExtensionModalProps {
  type: 'microLearning' | 'groupActivity'
  id: string
  currentEndDate: Date
  courseId: string
  title: string
  description: string
  onClose: () => void
  refetchActivities?: () => Promise<void>
}

function ExtensionModal({
  type,
  id,
  currentEndDate,
  courseId,
  title,
  description,
  onClose,
  refetchActivities,
}: ExtensionModalProps) {
  const t = useTranslations()
  const utils = trpc.useUtils()
  const extendActivity = trpc.activity.extend.useMutation()

  return (
    <Modal
      open
      onClose={onClose}
      hideCloseButton={true}
      title={title}
      className={{
        content: 'max-w-xl pb-2',
        title: 'text-xl',
      }}
    >
      <div className="space-y-3" data-cy="activity-extension-modal">
        <div data-cy="extension-modal-description">{description}</div>
        <Formik
          initialValues={{ endDate: dayjs(currentEndDate).local().toDate() }}
          validationSchema={Yup.object().shape({
            endDate: Yup.date()
              .required()
              .min(new Date(), t('manage.course.futureEndDateRequired')),
          })}
          onSubmit={async (values, { setSubmitting }) => {
            const utcEndDate = dayjs(values.endDate).utc().toDate()
            setSubmitting(true)

            try {
              const result = await extendActivity.mutateAsync({
                activityId: id,
                activityType:
                  type === 'microLearning'
                    ? ActivityType.MICRO_LEARNING
                    : ActivityType.GROUP_ACTIVITY,
                endDate: utcEndDate,
              })
              if (result.extendActivity?.id) {
                void utils.course.detail
                  .invalidate({ courseId })
                  .catch(console.error)
                void refetchActivities?.().catch(console.error)
                onClose()
              } else {
                toast({
                  type: 'error',
                  message: t('shared.generic.systemError'),
                })
              }
            } catch (error) {
              console.error(error)
              toast({
                type: 'error',
                message: t('shared.generic.systemError'),
              })
            } finally {
              setSubmitting(false)
            }
          }}
        >
          {({ isValid, isSubmitting }) => (
            <Form>
              <FormikDatetimePicker
                required
                name="endDate"
                label={t('manage.course.newEndDate')}
                labelType="large"
                granularity="minute"
                className={{ tooltip: 'z-20' }}
                dataTrigger={{ cy: 'extend-activity-date' }}
                dataCalendar={{ cy: 'extend-activity-date-calendar' }}
                dataPreviousMonth={{
                  cy: 'extend-activity-date-previous-month',
                }}
                dataNextMonth={{ cy: 'extend-activity-date-next-month' }}
                dataHours={{ cy: 'extend-activity-date-hours' }}
                dataMinutes={{ cy: 'extend-activity-date-minutes' }}
              />
              <div className="mt-3 flex flex-row justify-between">
                <Button
                  onClick={onClose}
                  data={{ cy: 'extend-activity-cancel' }}
                >
                  <Button.Label>{t('shared.generic.cancel')}</Button.Label>
                </Button>
                <Button
                  primary
                  type="submit"
                  loading={isSubmitting}
                  disabled={!isValid}
                  data={{ cy: 'extend-activity-confirm' }}
                >
                  <Button.Label>{t('shared.generic.confirm')}</Button.Label>
                </Button>
              </div>
            </Form>
          )}
        </Formik>
      </div>
    </Modal>
  )
}

export default ExtensionModal
