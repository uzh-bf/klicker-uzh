import { faClock } from '@fortawesome/free-regular-svg-icons'
import { faUserGroup } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ActivityType } from '@klicker-uzh/types'
import {
  Button,
  FormikDatetimePicker,
  H3,
  Modal,
  toast,
} from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import * as yup from 'yup'
import { trpc } from '../../../lib/trpc'

interface PracticeQuizPublishingModalProps {
  activityId: string
  title: string
  courseId: string
  courseStartDate: string
  onClose: () => void
  refetchActivities?: () => Promise<void>
}

function PracticeQuizPublishingModal({
  activityId,
  title,
  courseId,
  courseStartDate,
  onClose,
  refetchActivities,
}: PracticeQuizPublishingModalProps) {
  const t = useTranslations()
  const utils = trpc.useUtils()
  const publishPracticeQuiz = trpc.activity.publish.useMutation()
  const onErrorToast = () =>
    toast({
      type: 'error',
      message: t('shared.generic.systemError'),
    })

  return (
    <Modal
      open
      title={`${t('shared.generic.practiceQuiz')}: ${title}`}
      onClose={onClose}
      className={{ content: 'pb-2 text-base' }}
      dataCloseButton={{ cy: 'cancel-practice-quiz-publication' }}
    >
      <div className="flex w-full flex-col gap-4 md:flex-row">
        <div className="border-uzh-grey-80 w-full border-b border-solid pb-3 md:w-1/2 md:border-b-0 md:border-r md:pr-5">
          <div className="mb-2 flex flex-row items-center gap-2">
            <FontAwesomeIcon icon={faUserGroup} />
            <H3
              className={{ root: 'mb-0' }}
              data={{ cy: 'publish-immediately-header' }}
            >
              {t('manage.course.practiceQuizPublishImmediately')}
            </H3>
          </div>
          <div>{t('manage.course.practiceQuizPublishingHint', { title })}</div>
          <Button
            primary
            onClick={async () => {
              try {
                const result = await publishPracticeQuiz.mutateAsync({
                  activityId,
                  activityType: ActivityType.PRACTICE_QUIZ,
                })
                if (result.publishActivity?.id) {
                  void utils.course.detail
                    .invalidate({ courseId })
                    .catch(console.error)
                  void refetchActivities?.().catch(console.error)
                  onClose()
                } else {
                  onErrorToast()
                }
              } catch (error) {
                console.error(error)
                onErrorToast()
              }
            }}
            loading={publishPracticeQuiz.isLoading}
            disabled={publishPracticeQuiz.isLoading}
            data={{ cy: 'publish-practice-quiz-immediately' }}
            className={{ root: 'float-right mt-3' }}
          >
            <Button.Label>{t('manage.course.confirmPublication')}</Button.Label>
          </Button>
        </div>

        <div className="w-full md:w-1/2 md:pl-3">
          <div className="mb-2 flex flex-row items-center gap-2">
            <FontAwesomeIcon icon={faClock} />
            <H3 className={{ root: 'mb-0' }}>
              {t('manage.course.schedulePublication')}
            </H3>
          </div>
          <div className="mb-2">
            {t('manage.course.practiceQuizSchedulingHint', { title })}
          </div>
          <Formik
            validateOnMount
            initialValues={{ availableFrom: undefined }}
            onSubmit={async (values, { setSubmitting }) => {
              setSubmitting(true)
              try {
                const result = await publishPracticeQuiz.mutateAsync({
                  activityId,
                  activityType: ActivityType.PRACTICE_QUIZ,
                  availableFrom: dayjs(values.availableFrom).utc().toDate(),
                })
                if (result.publishActivity?.id) {
                  void utils.course.detail
                    .invalidate({ courseId })
                    .catch(console.error)
                  void refetchActivities?.().catch(console.error)
                  onClose()
                } else {
                  onErrorToast()
                }
              } catch (error) {
                console.error(error)
                onErrorToast()
              } finally {
                setSubmitting(false)
              }
            }}
            validationSchema={yup.object().shape({
              availableFrom: yup
                .date()
                .required(t('manage.activityWizard.practiceQuizStartRequired'))
                .test(
                  'afterCourseStart',
                  t('manage.activityWizard.practiceQuizStartAfterCourseStart'),
                  (value) => dayjs(value) > dayjs(courseStartDate)
                ),
            })}
          >
            {({ isSubmitting, isValid }) => {
              return (
                <Form>
                  <FormikDatetimePicker
                    required
                    name="availableFrom"
                    label={t('shared.generic.availableFrom')}
                    placeholder={t('shared.generic.startDate')}
                    granularity="minute"
                    className={{ tooltip: 'z-20' }}
                    dataTrigger={{ cy: 'practice-quiz-available-from' }}
                    dataCalendar={{
                      cy: 'practice-quiz-available-from-calendar',
                    }}
                    dataPreviousMonth={{
                      cy: 'practice-quiz-available-from-previous-month',
                    }}
                    dataNextMonth={{
                      cy: 'practice-quiz-available-from-next-month',
                    }}
                    dataHours={{ cy: 'practice-quiz-available-from-hours' }}
                    dataMinutes={{ cy: 'practice-quiz-available-from-minutes' }}
                  />
                  <Button
                    primary
                    type="submit"
                    loading={publishPracticeQuiz.isLoading || isSubmitting}
                    disabled={!isValid || isSubmitting}
                    data={{ cy: 'schedule-practice-quiz-publication' }}
                    className={{ root: 'float-right mt-3' }}
                  >
                    <Button.Label>
                      {t('manage.course.confirmScheduling')}
                    </Button.Label>
                  </Button>
                </Form>
              )
            }}
          </Formik>
        </div>
      </div>
    </Modal>
  )
}

export default PracticeQuizPublishingModal
