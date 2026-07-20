import { useMutation } from '@apollo/client'
import { faClock } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  GetSingleCourseDocument,
  GetUserActivitiesDocument,
  ScheduleLiveQuizDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, FormikDatetimePicker, Modal } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import * as yup from 'yup'

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
  const [scheduleLiveQuiz, { loading: liveQuizScheduling }] = useMutation(
    ScheduleLiveQuizDocument
  )

  return (
    <Modal
      open
      title={
        <div className="flex flex-row items-center">
          <FontAwesomeIcon icon={faClock} className="mr-3" />
          {t('manage.liveQuizzes.scheduleLiveQuiz')}: {title}
        </div>
      }
      onClose={onClose}
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
          await scheduleLiveQuiz({
            variables: {
              id: activityId,
              availableFrom: dayjs(values.availableFrom).utc().format(),
            },
            // TODO: replace with cache update
            refetchQueries: [
              {
                query: GetSingleCourseDocument,
                variables: { courseId },
              },
              { query: GetUserActivitiesDocument },
            ],
          })
          onClose()
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
        {({ isValid }) => {
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
                loading={liveQuizScheduling}
                disabled={!isValid}
                data={{ cy: 'schedule-live-quiz-publication' }}
              >
                <Button.Icon icon={faClock} loading={liveQuizScheduling} />
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
