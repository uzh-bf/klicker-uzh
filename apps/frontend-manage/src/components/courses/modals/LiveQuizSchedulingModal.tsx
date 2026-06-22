import { faClock } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  Button,
  FormikDatetimePicker,
  Modal,
  toast,
} from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import * as yup from 'yup'
import { trpc } from '../../../lib/trpc'

function LiveQuizSchedulingModal({
  activityId,
  title,
  courseId,
  courseStartDate,
  onClose,
}: {
  activityId: string
  title: string
  courseId?: string | null
  courseStartDate?: string | null
  onClose: () => void
}) {
  const t = useTranslations()
  const utils = trpc.useUtils()
  const scheduleLiveQuiz = trpc.activity.scheduleLiveQuiz.useMutation()
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false)
  const scheduling = scheduleLiveQuiz.isLoading || scheduleSubmitting
  const handleClose = () => {
    if (!scheduling) {
      onClose()
    }
  }

  return (
    <Modal
      open
      title={
        <div className="flex flex-row items-center">
          <FontAwesomeIcon icon={faClock} className="mr-3" />
          {t('manage.liveQuizzes.scheduleLiveQuiz')}: {title}
        </div>
      }
      onClose={handleClose}
      className={{ content: 'max-w-xl pb-2 text-base' }}
      dataCloseButton={{ cy: 'cancel-live-quiz-scheduling' }}
    >
      <div className="mb-2">
        {t('manage.liveQuizzes.scheduleLiveQuizHint', { title })}
      </div>
      <Formik
        validateOnMount
        initialValues={{ availableFrom: undefined }}
        onSubmit={async (values, { setSubmitting }) => {
          setSubmitting(true)
          setScheduleSubmitting(true)
          try {
            const result = await scheduleLiveQuiz.mutateAsync({
              activityId,
              availableFrom: dayjs(values.availableFrom).utc().toDate(),
            })
            if (result.scheduleLiveQuiz?.id) {
              await Promise.all([
                utils.activity.userActivities.invalidate(),
                courseId
                  ? utils.course.detail.invalidate({ courseId })
                  : Promise.resolve(),
              ]).catch(console.error)
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
            setScheduleSubmitting(false)
          }
        }}
        validationSchema={yup.object().shape({
          availableFrom: yup
            .date()
            .required(t('manage.liveQuizzes.liveQuizSchedulingDateRequired'))
            .test(
              'afterCourseStart',
              t('manage.liveQuizzes.liveQuizSchedulingFutureAfterCourseStart'),
              (value) =>
                dayjs(value) > dayjs() &&
                (!courseStartDate || dayjs(value) > dayjs(courseStartDate))
            ),
        })}
      >
        {({ isValid, isSubmitting }) => {
          return (
            <Form className="flex flex-row items-end justify-between">
              <FormikDatetimePicker
                required
                name="availableFrom"
                label={t('shared.generic.availableFrom')}
                placeholder={t('shared.generic.startDate')}
                granularity="minute"
                className={{ tooltip: 'z-20' }}
                dataTrigger={{ cy: 'live-quiz-available-from' }}
                dataCalendar={{ cy: 'live-quiz-available-from-calendar' }}
                dataPreviousMonth={{
                  cy: 'live-quiz-available-from-previous-month',
                }}
                dataNextMonth={{ cy: 'live-quiz-available-from-next-month' }}
                dataHours={{ cy: 'live-quiz-available-from-hours' }}
                dataMinutes={{ cy: 'live-quiz-available-from-minutes' }}
              />
              <Button
                primary
                type="submit"
                loading={isSubmitting || scheduling}
                disabled={!isValid || isSubmitting || scheduling}
                data={{ cy: 'schedule-live-quiz-publication' }}
              >
                <Button.Icon
                  icon={faClock}
                  loading={isSubmitting || scheduling}
                />
                <Button.Label>
                  {t('manage.course.confirmScheduling')}
                </Button.Label>
              </Button>
            </Form>
          )
        }}
      </Formik>
    </Modal>
  )
}

export default LiveQuizSchedulingModal
